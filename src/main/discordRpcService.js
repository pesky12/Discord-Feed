import { Client } from '@xhayper/discord-rpc'
import { ipcMain } from 'electron'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { initOpenAIService, getOpenAIService } from './openAiService'
import { createTestNotification } from './testNotificationService'

/**
 * In-memory storage for Discord notifications with a maximum limit
 * @type {Array<Object>}
 */
let notifications = []

/**
 * Global state and references
 */
let isConnected = false
let client = null
let guildLookup = []
let mainWindowRef = null

/**
 * Maximum number of notifications to keep in memory
 * Prevents memory leaks while maintaining a reasonable history
 */
const MAX_NOTIFICATIONS = 1000

/**
 * Default application settings
 */
let settings = {
  clientId: '',
  clientSecret: '',
  provider: 'openai',
  openaiApiKey: '',
  openaiApiEndpoint: 'https://api.openai.com/v1',
  geminiApiKey: '',
  geminiApiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
  enableSummarization: false,
  summaryDetectionMode: 'length',
  minLengthForSummary: 100,
  model: 'gpt-4o-mini'
}

/**
 * Gets the path to the settings file in user data directory
 * @returns {string} Full path to settings file
 */
function getSettingsPath() {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'discord-settings.json')
}

/**
 * Loads settings from disk, creating defaults if needed
 * Handles corrupted settings by creating backups
 */
function loadSettings() {
  const settingsPath = getSettingsPath()
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8')
      try {
        const loadedSettings = JSON.parse(data)
        console.log('Loaded settings from:', settingsPath)
        settings = { ...settings, ...loadedSettings }
      } catch (parseError) {
        console.error('Failed to parse settings file:', parseError)
        const backupPath = `${settingsPath}.backup-${Date.now()}`
        fs.copyFileSync(settingsPath, backupPath)
        console.log('Created backup of invalid settings file at:', backupPath)
        saveSettings()
      }
    } else {
      console.log('Settings file does not exist, will create on first save')
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

/**
 * Saves current settings to disk with proper error handling
 * Creates directories if they don't exist
 */
function saveSettings() {
  const settingsPath = getSettingsPath()
  try {
    const directory = join(settingsPath, '..')
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true })
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
    console.log('Saved settings to:', settingsPath)
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

/**
 * Generates an AI summary for a message using the OpenAI service
 * @param {string} message - The message content to summarize
 * @param {Object} context - Additional context about the message
 * @returns {Promise<string|null>} The generated summary or null if unavailable
 */
async function generateMessageSummary(message, context = {}) {
  if (!settings.enableSummarization) return null

  const openAIService = getOpenAIService()
  if (!openAIService.isEnabled()) return null

  try {
    // Use the consolidated method which includes local preprocessing
    const result = await openAIService.processMessage(message, context)
    return result.needsSummary ? result.summary : null
  } catch (error) {
    console.error('Failed to summarize message:', error)
    return null
  }
}

/**
 * Initializes the Discord RPC client and sets up IPC communication
 * Handles connection state, notifications, and settings management
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function initDiscordRpc(mainWindow) {
  console.log('Initializing Discord RPC')
  mainWindowRef = mainWindow
  loadSettings()
  initOpenAIService(settings)

  // IPC Handlers for renderer communication
  ipcMain.handle('discord:update-settings', async (_, newSettings) => {
    settings = { ...settings, ...newSettings }
    saveSettings()
    getOpenAIService().updateSettings(newSettings)
    return { success: true }
  })

  ipcMain.handle('discord:get-settings', async () => {
    return settings
  })

  ipcMain.handle('discord:connect', async () => {
    try {
      if (client) {
        return { success: true, isConnected }
      }

      if (!settings.clientId?.trim() || !settings.clientSecret?.trim()) {
        console.error('Missing or empty client ID or secret')
        return {
          success: false,
          error: 'Missing or empty client ID or secret. Please configure them in settings.'
        }
      }

      client = new Client({
        clientId: settings.clientId.trim(),
        clientSecret: settings.clientSecret.trim(),
        transport: {
          type: 'ipc'
        },
        redirectUri: 'http://localhost:5173'
      })

      client.on('ready', async () => {
        console.log('Connected to Discord')
        isConnected = true
        mainWindow.webContents.send('discord:connection-change', isConnected)

        try {
          await client.subscribe('NOTIFICATION_CREATE')
          console.log('Subscribed to notifications')
        } catch (error) {
          console.error('Failed to subscribe to notifications', error)
        }

        try {
          const guilds = await client.user?.fetchGuilds()

          if (guilds) {
            for (const guild of guilds) {
              const channels = await client.user?.fetchChannels(guild.id)
              if (channels) {
                guildLookup.push({ name: guild.name, id: guild.id, channels: channels })
              }
            }
          }
          console.log('Guilds and channels fetched')
        } catch (error) {
          console.error('Failed to fetch guilds or channels', error)
        }
      })

      client.on('NOTIFICATION_CREATE', async (data) => {
        console.log('Notification received:', data)
        const notification = await processNotification(data)
        notifications.unshift(notification)

        if (notifications.length > MAX_NOTIFICATIONS) {
          notifications = notifications.slice(0, MAX_NOTIFICATIONS)
        }

        mainWindow.webContents.send('discord:notification', notification)
      })

      client.on('disconnect', () => {
        console.log('Disconnected from Discord')
        isConnected = false
        guildLookup = []
        mainWindow.webContents.send('discord:connection-change', isConnected)
      })

      await client.login({
        scopes: ['rpc', 'rpc.notifications.read', 'guilds', 'messages.read', 'rpc.voice.read'],
        prompt: 'none'
      })

      return { success: true, isConnected: true }
    } catch (error) {
      console.error('Failed to connect to Discord', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('discord:disconnect', async () => {
    try {
      if (client) {
        await client.destroy()
        client = null
        isConnected = false
        guildLookup = []
        mainWindow.webContents.send('discord:connection-change', isConnected)
      }
      return { success: true }
    } catch (error) {
      console.error('Error disconnecting from Discord', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('discord:get-notifications', () => {
    return notifications.slice(0, 20)
  })

  ipcMain.handle('discord:get-notifications-page', (_, { page, perPage }) => {
    const startIndex = 0
    const endIndex = page * perPage
    return {
      notifications: notifications.slice(startIndex, endIndex),
      hasMore: endIndex < notifications.length,
      total: notifications.length
    }
  })

  ipcMain.handle('discord:is-connected', () => {
    return isConnected
  })

  // Handle test notification requests
  ipcMain.handle('discord:create-test-notification', () => {
    createTestNotification(mainWindow, processNotification, notifications)
    return { success: true }
  })
}

/**
 * Processes a Discord notification and enriches it with AI features
 * @param {Object} data - Raw notification data from Discord
 * @returns {Promise<Object>} Processed notification with summaries and categories
 */
async function processNotification(data) {
  console.log('Processing notification:', data)
  const serverInfo = getServerFromChannel(data.channel_id)
  const isUnknown = typeof serverInfo === 'string'
  const isDM = !serverInfo || serverInfo === 'Unknown Server'

  let category = null
  let importance = null
  let eventDetails = null
  let summary = null
  let summaryPending = false
  let categoryPending = false
  let eventPending = false

  // Build message context for AI processing
  const context = {
    isDM,
    channel: isDM ? 'Direct Message' : serverInfo.channel,
    author: data.message.nick || 'Unknown User',
    recentMessages: []
  }

  // Add AI enrichment if enabled
  const openAIService = getOpenAIService()
  if (settings.enableSummarization && data.body && openAIService.isEnabled()) {
    try {
      // Set pending flags initially
      categoryPending = true
      eventPending = true
      // Don't set summaryPending yet - we'll set it only if needed

      // First get categorization and determine if we need a summary
      const result = await openAIService.processMessage(data.body, context)
      
      // Extract the metadata insights
      category = result.category
      importance = result.importance
      categoryPending = false
      
      // Determine if we need a summary and only set summaryPending if true
      const needsSummary = result.needsSummary
      summaryPending = needsSummary
      
      // Send initial status update with category and importance
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('discord:notification-update', {
          id: data.message.id,
          category,
          importance,
          categoryPending: false,
          summaryPending, // Will be true only if needsSummary is true
          eventPending: true // Event detection still pending
        })
      }
      
      // Start event detection
      const extractedEventDetails = await openAIService.extractEventDetails(data.body)
      eventPending = false
      
      // Debug log for event extraction
      console.log('Extracted event details:', extractedEventDetails)
      
      // Process event details
      if (extractedEventDetails && extractedEventDetails.hasEvent) {
        // Clone the object without the hasEvent property
        const { hasEvent, ...cleanEventDetails } = extractedEventDetails;
        eventDetails = cleanEventDetails;
        
        console.log('Extracted and cleaned event details for frontend:', eventDetails)
      }
      
      // Send event details update
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('discord:notification-update', {
          id: data.message.id,
          eventDetails,
          eventPending: false,
          // Include previously determined category and importance
          category,
          importance,
          summaryPending
        })
      }

      // Only generate summary if needed - but do this separately from initial analysis
      // This allows the UI to update faster with categorization and event details
      if (needsSummary) {
        // Leave summary generation for later - handled by async call below
      } else {
        // No summary needed, update the UI
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-update', {
            id: data.message.id,
            summaryPending: false,
            noSummaryNeeded: true
          })
        }
      }

    } catch (error) {
      console.error('Error in AI processing:', error)
      summaryPending = false
      categoryPending = false
      eventPending = false

      // Send error state update
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('discord:notification-update', {
          id: data.message.id,
          error: true,
          summaryPending: false,
          categoryPending: false,
          eventPending: false
        })
      }
    }
  }

  // Construct the enriched notification object
  const notification = {
    id: data.message.id,
    title: data.title,
    body: data.body,
    summary,
    summaryPending,
    categoryPending,
    eventPending,
    category,
    importance,
    eventDetails, // Make sure eventDetails is included
    icon: data.icon_url,
    timestamp: data.message.timestamp,
    serverName: isDM ? 'Direct Message' : isUnknown ? 'Unknown Server' : serverInfo.server,
    channelName: isDM ? data.message.nick || 'DM' : isUnknown ? '' : serverInfo.channel,
    serverId: isUnknown ? '' : serverInfo.serverid,
    channelId: data.channel_id,
    messageLink: isUnknown
      ? ''
      : `https://discord.com/channels/${isDM ? '@me' : serverInfo.serverid}/${data.channel_id}/${data.message.id}`,
    author: {
      name: data.message.nick || 'Unknown User',
      avatar: data.icon_url
    }
  }

  console.log('Processed notification with eventDetails:', notification.eventDetails)

  // If summary is pending, generate it asynchronously with streaming
  if (summaryPending) {
    // Use the dedicated streaming summarize function
    let streamedSummary = '';
    
    openAIService.summarizeMessageWithStreaming(
      data.body, 
      context,
      (chunk, fullText) => {
        streamedSummary = fullText;
        
        // Send streaming update to frontend
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-stream-chunk', {
            id: notification.id,
            chunk,
            fullText,
            summaryPending: true,
            isStreaming: true
          });
        }
      }
    ).then((generatedSummary) => {
      if (generatedSummary) {
        // Update notification in memory
        const index = notifications.findIndex((n) => n.id === notification.id)
        if (index !== -1) {
          notifications[index].summary = generatedSummary
          notifications[index].summaryPending = false
        }
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-update', {
            id: notification.id,
            summary: generatedSummary,
            summaryPending: false,
            isStreaming: false
          });
        }
      } else {
        // No summary could be generated
        const index = notifications.findIndex((n) => n.id === notification.id)
        if (index !== -1) {
          notifications[index].summaryPending = false
        }
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-update', {
            id: notification.id,
            summaryPending: false,
            noSummaryNeeded: true
          });
        }
      }
    }).catch((error) => {
      console.error('Error generating summary asynchronously:', error)
      const index = notifications.findIndex((n) => n.id === notification.id)
      if (index !== -1) {
        notifications[index].summaryPending = false
      }
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('discord:summary-update', {
          id: notification.id,
          error: true,
          summaryPending: false
        });
      }
    });
  } else {
    // No summary needed, update the UI
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('discord:summary-update', {
        id: data.message.id,
        summaryPending: false,
        noSummaryNeeded: true
      })
    }
  }

  console.log('Finished processing notification')
  return notification
}

/**
 * Looks up server and channel information from a channel ID
 * @param {string} channelID - Discord channel ID
 * @returns {Object|string} Server info object or 'Unknown Server' if not found
 */
function getServerFromChannel(channelID) {
  for (const guild of guildLookup) {
    for (const channel of guild.channels) {
      if (channel.id === channelID) {
        return { server: guild.name, serverid: guild.id, channel: channel.name }
      }
    }
  }
  return 'Unknown Server'
}

/**
 * Gets the current notifications array
 * @returns {Array} The current notifications array
 */
export function getNotifications() {
  return notifications
}

/**
 * Export processNotification for use by test notification service
 */
export { processNotification as processNotificationFunction }

export { createTestNotification } from './testNotificationService'

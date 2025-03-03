import { Client } from '@xhayper/discord-rpc'
import { ipcMain } from 'electron'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { initOpenAIService, getOpenAIService } from './openAiService'

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
  openaiApiKey: '',
  openaiApiEndpoint: 'https://api.openai.com/v1',
  enableSummarization: false,
  summaryDetectionMode: 'length',
  minLengthForSummary: 100
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
  if (!settings.enableSummarization) return null;
  
  const openAIService = getOpenAIService();
  if (!openAIService.isEnabled()) return null;
  
  try {
    return await openAIService.summarizeMessage(message, context);
  } catch (error) {
    console.error('Failed to summarize message:', error);
    return null;
  }
}

/**
 * Initializes the Discord RPC client and sets up IPC communication
 * Handles connection state, notifications, and settings management
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function initDiscordRpc(mainWindow) {
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
}

/**
 * Processes a Discord notification and enriches it with AI features
 * @param {Object} data - Raw notification data from Discord
 * @returns {Promise<Object>} Processed notification with summaries and categories
 */
async function processNotification(data) {
  const serverInfo = getServerFromChannel(data.channel_id)
  const isUnknown = typeof serverInfo === 'string'
  const isDM = !serverInfo || serverInfo === 'Unknown Server'
  
  let summaryPending = false;
  let category = null;
  let importance = null;
  
  // Add AI enrichment if enabled
  const openAIService = getOpenAIService();
  if (settings.enableSummarization && data.body && openAIService.isEnabled()) {
    try {
      // Categorize non-DM messages
      if (!isDM) {
        const categorization = await openAIService.categorizeMessage(data.body, isDM);
        if (categorization) {
          category = categorization.category;
          importance = categorization.importance;
        }
      }
      
      const needsSummary = await openAIService.shouldSummarize(data.body);
      summaryPending = needsSummary;
    } catch (error) {
      console.error('Error in AI processing:', error);
    }
  }

  // Build message context for AI processing
  const context = {
    isDM,
    channel: isDM ? 'Direct Message' : serverInfo.channel,
    author: data.message.nick || 'Unknown User',
    recentMessages: []
  };
  
  // Construct the enriched notification object
  const notification = {
    id: data.message.id,
    title: data.title,
    body: data.body,
    summary: null,
    summaryPending: summaryPending,
    ...(isDM ? {} : { category, importance }),
    icon: data.icon_url,
    timestamp: data.message.timestamp,
    serverName: isDM ? 'Direct Message' : (isUnknown ? 'Unknown Server' : serverInfo.server),
    channelName: isDM ? data.message.nick || 'DM' : (isUnknown ? '' : serverInfo.channel),
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
  
  // Generate summary asynchronously if needed
  if (summaryPending) {
    generateMessageSummary(data.body, context).then(summary => {
      if (summary) {
        // Update notification in memory
        const index = notifications.findIndex(n => n.id === notification.id)
        if (index !== -1) {
          notifications[index].summary = summary
          notifications[index].summaryPending = false
        }
        
        // Notify renderer of summary update
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-update', { 
            id: notification.id, 
            summary 
          })
        }
      } else {
        // Handle failed summarization
        const index = notifications.findIndex(n => n.id === notification.id)
        if (index !== -1) {
          notifications[index].summaryPending = false
        }
        
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-update', { 
            id: notification.id, 
            summary: null,
            cancelled: true
          })
        }
      }
    }).catch(error => {
      console.error('Error generating summary asynchronously:', error)
      
      // Handle errors gracefully
      const index = notifications.findIndex(n => n.id === notification.id)
      if (index !== -1) {
        notifications[index].summaryPending = false
      }
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('discord:summary-update', { 
          id: notification.id, 
          summary: null,
          cancelled: true
        })
      }
    })
  }

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
 * Creates a test notification for development and testing purposes
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function createTestNotification(mainWindow) {
  if (!mainWindow) return;

  const testMessages = [
    "Hi, how is you!!!",
    "Do you want to grab some coffee?",
    "I like birds",
    "Hey everyone! Just wanted to let you know that we're planning to meet up this Friday at 7PM at the usual place. Please let me know if you can make it so I can get a headcount for the reservation.",
    "I just pushed a major update to our project repository. The changes include performance optimizations, some UI improvements, and a fix for that annoying bug we've been tracking. Please pull the latest changes and let me know if you encounter any issues!",
    "Does anyone have experience with the new React hooks API? I'm trying to refactor our component but I'm running into some issues with useEffect dependencies. I've been stuck on this for hours!",
    "I'm excited to announce that we'll be launching our new product next Tuesday! We've been working hard on this for months and I think you'll all be really impressed with the results. Special thanks to everyone who helped with testing and feedback.",
    "Just a reminder that we have a team meeting tomorrow at 3PM to discuss the upcoming project deadlines and resource allocation. Please come prepared with status updates on your assigned tasks."
  ];

  const randomIndex = Math.floor(Math.random() * testMessages.length);
  const testMessage = testMessages[randomIndex];

  const now = new Date();
  
  const mockNotification = {
    message: {
      id: `test-${Date.now()}`,
      nick: "Test User",
      timestamp: now.toISOString()
    },
    title: "Test Notification",
    body: testMessage,
    icon_url: "https://cdn.discordapp.com/embed/avatars/0.png",
    channel_id: "test-channel"
  };

  processNotification(mockNotification).then(notification => {
    notifications.unshift(notification);
    
    if (notifications.length > MAX_NOTIFICATIONS) {
      notifications = notifications.slice(0, MAX_NOTIFICATIONS);
    }

    mainWindow.webContents.send('discord:notification', notification);
  });
}

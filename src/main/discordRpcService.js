import { Client } from '@xhayper/discord-rpc'
import { ipcMain } from 'electron'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { initOpenAIService, getOpenAIService } from './openAiService'

// Will hold our notification data
let notifications = []
let isConnected = false
let client = null
let guildLookup = []
let mainWindowRef = null // Store reference to the main window

// Maximum number of notifications to keep in memory
const MAX_NOTIFICATIONS = 1000

// Default settings
let settings = {
  clientId: '',
  clientSecret: '',
  openaiApiKey: '',
  openaiApiEndpoint: 'https://api.openai.com/v1',
  enableSummarization: false,
  summaryDetectionMode: 'length', // 'length' or 'smart'
  minLengthForSummary: 100       // Minimum character count for summarization in length mode
}

// Get settings file path
const getSettingsPath = () => {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'discord-settings.json')
}

// Load settings from file
const loadSettings = () => {
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
        // File exists but is invalid JSON, back it up and create a new one
        const backupPath = `${settingsPath}.backup-${Date.now()}`
        fs.copyFileSync(settingsPath, backupPath)
        console.log('Created backup of invalid settings file at:', backupPath)
        saveSettings() // Create a new file with default settings
      }
    } else {
      console.log('Settings file does not exist, will create on first save')
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

// Save settings to file
const saveSettings = () => {
  const settingsPath = getSettingsPath()
  try {
    // Make sure the directory exists
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

// Generate summary for a message using OpenAI
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

// Initialize the Discord RPC client
export function initDiscordRpc(mainWindow) {
  // Store reference to the main window
  mainWindowRef = mainWindow
  
  // Load settings
  loadSettings()
  
  // Initialize OpenAI service with settings
  initOpenAIService(settings)

  // Handle settings update
  ipcMain.handle('discord:update-settings', async (_, newSettings) => {
    // Update settings
    settings = { ...settings, ...newSettings }
    saveSettings()
    
    // Update OpenAI service settings
    getOpenAIService().updateSettings(newSettings)
    
    return { success: true }
  })

  // Handle getting settings
  ipcMain.handle('discord:get-settings', async () => {
    return settings
  })

  // Listen for connection request from renderer
  ipcMain.handle('discord:connect', async () => {
    try {
      if (client) {
        return { success: true, isConnected }
      }

      // Check if client ID and secret are provided and not empty
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
        redirectUri: 'http://localhost:5173'  // Add proper redirect URI
      })

      // Set up event handlers
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

        // Limit the total number of stored notifications
        if (notifications.length > MAX_NOTIFICATIONS) {
          notifications = notifications.slice(0, MAX_NOTIFICATIONS)
        }

        // Send to renderer
        mainWindow.webContents.send('discord:notification', notification)
      })

      client.on('disconnect', () => {
        console.log('Disconnected from Discord')
        isConnected = false
        guildLookup = []
        mainWindow.webContents.send('discord:connection-change', isConnected)
      })

      // Login
      await client.login({
        scopes: ['rpc', 'rpc.notifications.read', 'guilds', 'messages.read', 'rpc.voice.read'],
        prompt: 'none' // Only prompt once
      })

      return { success: true, isConnected: true }
    } catch (error) {
      console.error('Failed to connect to Discord', error)
      return { success: false, error: error.message }
    }
  })

  // Listen for disconnect request
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

  // Listen for request to get all notifications
  ipcMain.handle('discord:get-notifications', () => {
    // Initially return a smaller batch of notifications
    return notifications.slice(0, 20)
  })

  // Listen for request to get paginated notifications
  ipcMain.handle('discord:get-notifications-page', (_, { page, perPage }) => {
    const startIndex = 0
    const endIndex = page * perPage
    return {
      notifications: notifications.slice(startIndex, endIndex),
      hasMore: endIndex < notifications.length,
      total: notifications.length
    }
  })

  // Listen for connection status check
  ipcMain.handle('discord:is-connected', () => {
    return isConnected
  })
}

// Helper function to process a notification
async function processNotification(data) {
  const serverInfo = getServerFromChannel(data.channel_id)
  const isUnknown = typeof serverInfo === 'string'
  const isDM = !serverInfo || serverInfo === 'Unknown Server'
  
  let summaryPending = false;
  let category = null;
  let importance = null;
  
  const openAIService = getOpenAIService();
  if (settings.enableSummarization && data.body && openAIService.isEnabled()) {
    try {
      // Get categorization only for non-DM messages
      if (!isDM) {
        const categorization = await openAIService.categorizeMessage(data.body, isDM);
        if (categorization) {
          category = categorization.category;
          importance = categorization.importance;
        }
      }
      
      // Check if we need a summary
      const needsSummary = await openAIService.shouldSummarize(data.body);
      summaryPending = needsSummary;

    } catch (error) {
      console.error('Error in AI processing:', error);
    }
  }

  // Build context for message processing
  const context = {
    isDM,
    channel: isDM ? 'Direct Message' : serverInfo.channel,
    author: data.message.nick || 'Unknown User',
    recentMessages: []
  };
  
  // Create the notification object
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
  
  // If summarization is enabled and this message is pending summarization,
  // start the summary generation process in the background
  if (summaryPending) {
    generateMessageSummary(data.body, context).then(summary => {
      if (summary) {
        // Find notification in our array and update it
        const index = notifications.findIndex(n => n.id === notification.id)
        if (index !== -1) {
          notifications[index].summary = summary
          notifications[index].summaryPending = false
        }
        
        // Notify the renderer process about the updated summary
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-update', { 
            id: notification.id, 
            summary 
          })
        }
      } else {
        // If no summary was generated, update the pending status to false
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

// Helper function to generate a test notification for development/testing
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
  
  // Create a mock notification object
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

  // Process it like a regular notification
  processNotification(mockNotification).then(notification => {
    // Add to the notifications list
    notifications.unshift(notification);
    
    // Limit the total number of stored notifications
    if (notifications.length > MAX_NOTIFICATIONS) {
      notifications = notifications.slice(0, MAX_NOTIFICATIONS);
    }

    // Send to renderer
    mainWindow.webContents.send('discord:notification', notification);
  });
}

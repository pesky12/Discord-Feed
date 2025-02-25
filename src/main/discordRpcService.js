import { Client } from '@xhayper/discord-rpc'
import { ipcMain } from 'electron'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'

// Will hold our notification data
let notifications = []
let isConnected = false
let client = null
let guildLookup = []

// Maximum number of notifications to keep in memory
const MAX_NOTIFICATIONS = 1000

// Default settings
let settings = {
  clientId: '',
  clientSecret: ''
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

// Initialize the Discord RPC client
export function initDiscordRpc(mainWindow) {
  // Load settings
  loadSettings()

  // Handle settings update
  ipcMain.handle('discord:update-settings', async (_, newSettings) => {
    // Update settings
    settings = { ...settings, ...newSettings }
    saveSettings()
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
        }
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

      client.on('NOTIFICATION_CREATE', (data) => {
        console.log('Notification received:', data)
        const notification = processNotification(data)
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
function processNotification(data) {
  const serverInfo = getServerFromChannel(data.channel_id)
  const isUnknown = typeof serverInfo === 'string'

  return {
    id: data.message.id,
    title: data.title,
    body: data.body,
    icon: data.icon_url,
    timestamp: data.message.timestamp,
    serverName: isUnknown ? 'Unknown Server' : serverInfo.server,
    channelName: isUnknown ? '' : serverInfo.channel,
    serverId: isUnknown ? '' : serverInfo.serverid,
    channelId: data.channel_id,
    messageLink: isUnknown
      ? ''
      : `https://discord.com/channels/${serverInfo.serverid}/${data.channel_id}/${data.message.id}`,
    author: {
      name: data.message.nick || 'Unknown User',
      avatar: data.icon_url
    }
  }
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

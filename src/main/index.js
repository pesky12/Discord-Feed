import { app, shell, BrowserWindow, ipcMain, globalShortcut, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDiscordRpc, createTestNotification } from './discordRpcService'
import { getOpenAIService } from './openAiService'

/**
 * Reference to the main application window
 * Stored globally to prevent garbage collection
 */
let mainWindow = null
let tray = null

/**
 * Creates and configures the main application window
 * Sets up window event handlers and loads the renderer content
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Initialize Discord RPC integration
  initDiscordRpc(mainWindow)

  // Show window when ready
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Handle external links securely
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load appropriate content based on environment
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Create tray icon
  tray = new Tray(join(__dirname, '../../resources/icon.png')) // Make sure you have an icon file

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show()
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('Discord Feed')
  tray.setContextMenu(contextMenu)

  // Handle tray icon click
  tray.on('click', () => {
    mainWindow.show()
  })

  // Update window close behavior
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
    return false
  })
}

// Initialize app when ready
app.whenReady().then(() => {
  // Set app metadata for Windows
  electronApp.setAppUserModelId('com.electron')

  // Enable shortcuts in new windows
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // Register global shortcut for test notifications (Ctrl/Cmd+Shift+T)
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    console.log('Test notification triggered via keyboard shortcut')
    createTestNotification(mainWindow)
  })

  // Handle macOS app activation
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Clean up shortcuts on quit
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
})

// Handle window close behavior
app.on('window-all-closed', (event) => {
  if (process.platform !== 'darwin') {
    event.preventDefault()
  }
})

/**
 * IPC Handlers for renderer communication
 */

// Handle external link opening
ipcMain.on('open-external', (_, url) => {
  if (url && typeof url === 'string') {
    shell.openExternal(url)
  }
})

// Handle message summarization requests
ipcMain.handle('summarize-message', async (_, content) => {
  try {
    if (!content || typeof content !== 'string') {
      return { success: false, error: 'Invalid message content' }
    }

    const summary = await getOpenAIService().summarizeMessage(content)
    return { success: true, summary }
  } catch (error) {
    console.error('Error generating summary:', error)
    return { success: false, error: error.message || 'Failed to generate summary' }
  }
})

// Handle test notification requests
ipcMain.handle('discord:create-test-notification', () => {
  createTestNotification(mainWindow)
  return { success: true }
})

// Handle LLM connection testing
ipcMain.handle('discord:test-llm-connection', async (_, settings) => {
  try {
    const { apiKey, apiEndpoint, model } = settings

    if (!apiEndpoint || !apiEndpoint.trim()) {
      return {
        success: false,
        error: 'API endpoint is required'
      }
    }

    // Use similar code as in OpenAIService but don't reuse the instance
    // This allows testing different settings before saving them

    // Build endpoint URL ensuring no trailing slashes
    const endpoint = `${apiEndpoint.replace(/\/+$/, '')}/chat/completions`


    // Configure headers with optional authentication
    const headers = {
      'Content-Type': 'application/json'
    }

    // Only add Authorization header if API key is provided

    if (apiKey && apiKey.trim() !== '') {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Test the connection with a simple request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo', // Use model from settings or fallback to a common model
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello for a connection test!' }
        ],
        max_tokens: 10,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('LLM test connection error:', errorData)
      return {
        success: false,
        error: `API error: ${errorData.error?.message || errorData.error || 'Unknown error'}`
      }
    }

    // Validate response format
    const data = await response.json()
    if (data.choices && data.choices.length > 0) {
      return {
        success: true,
        modelName: data.model || 'Unknown model'
      }
    } else {
      return {
        success: false,
        error: 'Invalid response from API'
      }
    }
  } catch (error) {
    console.error('LLM test connection failed:', error)
    return {
      success: false,
      error: error.message || 'Connection failed'
    }
  }
})

// Handle minimize to tray
ipcMain.on('minimize-to-tray', () => {
  mainWindow.hide()
})

// Add handler for actual window closing
ipcMain.on('close-window', () => {
  app.isQuitting = true
  app.quit()
})

import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDiscordRpc, createTestNotification } from './discordRpcService'
import { getOpenAIService } from './openAiService'

let mainWindow = null

function createWindow() {
  // Create the browser window.
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

  // Initialize Discord RPC service
  initDiscordRpc(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // Register keyboard shortcut for test notifications (Ctrl+Shift+T)
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    console.log('Test notification triggered via keyboard shortcut')
    createTestNotification(mainWindow)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Unregister shortcuts when app is about to quit
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Handle opening external links
ipcMain.on('open-external', (_, url) => {
  if (url && typeof url === 'string') {
    shell.openExternal(url)
  }
})

// Allow manually triggering a summary for specific content
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

// Add IPC handler for test notification
ipcMain.handle('discord:create-test-notification', () => {
  createTestNotification(mainWindow)
  return { success: true }
})

// Add IPC handler for testing LLM connection
ipcMain.handle('discord:test-llm-connection', async (_, settings) => {
  try {
    const { apiKey, apiEndpoint } = settings

    if (!apiEndpoint || !apiEndpoint.trim()) {
      return { 
        success: false, 
        error: 'API endpoint is required' 
      }
    }

    // Create a test message for a quick connection check
    const testMessage = "Hello, this is a test message to check the connection."
    
    // Use similar code as in OpenAIService but don't reuse the instance
    // This allows testing different settings before saving them
    const endpoint = `${apiEndpoint.replace(/\/+$/, '')}/chat/completions`
    
    const headers = {
      'Content-Type': 'application/json'
    }
    
    // Only add Authorization header if API key is provided
    if (apiKey && apiKey.trim() !== '') {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Use a common model name
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

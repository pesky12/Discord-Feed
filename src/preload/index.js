import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Discord connection management
  discord: {
    connect: () => ipcRenderer.invoke('discord:connect'),
    disconnect: () => ipcRenderer.invoke('discord:disconnect'),
    isConnected: () => ipcRenderer.invoke('discord:is-connected'),
    getSettings: () => ipcRenderer.invoke('discord:get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('discord:update-settings', settings),
    getNotifications: () => ipcRenderer.invoke('discord:get-notifications'),
    getNotificationsPage: (options) => ipcRenderer.invoke('discord:get-notifications-page', options),
    createTestNotification: (options) => ipcRenderer.invoke('discord:create-test-notification', options),
    testLlmConnection: (settings) => ipcRenderer.invoke('discord:test-llm-connection', settings),
    onNotification: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('discord:notification', handler)
      return () => ipcRenderer.removeListener('discord:notification', handler)
    },
    onNotificationUpdate: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('discord:notification-update', handler)
      return () => ipcRenderer.removeListener('discord:notification-update', handler)
    },
    onSummaryUpdate: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('discord:summary-update', handler)
      return () => ipcRenderer.removeListener('discord:summary-update', handler)
    },
    onSummaryStreamChunk: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('discord:summary-stream-chunk', handler)
      return () => ipcRenderer.removeListener('discord:summary-stream-chunk', handler)
    },
    onConnectionChange: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('discord:connection-change', handler)
      return () => ipcRenderer.removeListener('discord:connection-change', handler)
    }
  },
  // Testing and development APIs
  getMessageCategories: () => ipcRenderer.invoke('test:get-message-categories'),
  
  // App management
  getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch'),
  setAutoLaunch: (enable) => ipcRenderer.invoke('app:set-auto-launch', enable),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  closeWindow: () => ipcRenderer.send('close-window')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

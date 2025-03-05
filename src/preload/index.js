import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Discord-related methods
  discord: {
    connect: () => ipcRenderer.invoke('discord:connect'),
    disconnect: () => ipcRenderer.invoke('discord:disconnect'),
    getNotifications: () => ipcRenderer.invoke('discord:get-notifications'),
    getNotificationsPage: (params) => ipcRenderer.invoke('discord:get-notifications-page', params),
    isConnected: () => ipcRenderer.invoke('discord:is-connected'),
    updateSettings: (settings) => ipcRenderer.invoke('discord:update-settings', settings),
    getSettings: () => ipcRenderer.invoke('discord:get-settings'),
    onNotification: (callback) => {
      const listener = (_, notification) => callback(notification)
      ipcRenderer.on('discord:notification', listener)
      return () => ipcRenderer.removeListener('discord:notification', listener)
    },
    onConnectionChange: (callback) => {
      const listener = (_, isConnected) => callback(isConnected)
      ipcRenderer.on('discord:connection-change', listener)
      return () => ipcRenderer.removeListener('discord:connection-change', listener)
    },
    onNotificationUpdate: (callback) => {
      const listener = (_, update) => callback(update)
      ipcRenderer.on('discord:notification-update', listener)
      return () => ipcRenderer.removeListener('discord:notification-update', listener)
    },
    // Method for manual summarization of message content
    summarizeMessage: (content) => ipcRenderer.invoke('summarize-message', content),
    // Method to generate test notifications
    createTestNotification: () => ipcRenderer.invoke('discord:create-test-notification'),
    // Method to test LLM connection before saving settings
    testLlmConnection: (settings) => ipcRenderer.invoke('discord:test-llm-connection', settings)
  },
  // App-related methods
  app: {
    // Methods for auto-launch feature
    getAutoLaunchEnabled: () => ipcRenderer.invoke('app:get-auto-launch'),
    setAutoLaunchEnabled: (enable) => ipcRenderer.invoke('app:set-auto-launch', enable)
  }
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

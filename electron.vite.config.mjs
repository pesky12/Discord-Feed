/**
 * electron-vite configuration
 * Defines build settings for main process, preload scripts, and renderer
 */

import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Main process build configuration
  main: {
    plugins: [externalizeDepsPlugin()]
  },

  // Preload scripts build configuration
  preload: {
    plugins: [externalizeDepsPlugin()]
  },

  // Renderer process build configuration
  renderer: {
    resolve: {
      alias: {
        // Enable @renderer imports from src/renderer/src
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]  // Enable React support
  }
})

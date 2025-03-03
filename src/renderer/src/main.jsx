/**
 * Main entry point for the React renderer process
 * Sets up React with StrictMode for development checks
 */

import './assets/main.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Initialize React application with StrictMode for additional development checks
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

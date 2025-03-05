import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import './App.css'
import CalendarEventButton from './components/CalendarEventButton'
import SettingsModal from './components/settings/SettingsModal'
import { formatTimestamp, formatMessageWithTimestamps } from './utils/timeFormatters'

// Sun icon for light theme toggle
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
  </svg>
)

// Moon icon for dark theme toggle
const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
      clipRule="evenodd"
    />
  </svg>
)

// Minimize icon for minimize button
const MinimizeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M4 12a1 1 0 011-1h14a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
)

// Settings icon for settings button
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.89c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"
      clipRule="evenodd"
    />
  </svg>
)

// A single notification item in the feed
const NotificationItem = ({ notification }) => {
  const [avatarSrc, setAvatarSrc] = useState('https://cdn.discordapp.com/embed/avatars/0.png')
  const [summary, setSummary] = useState(notification.summary)
  const [summaryState, setSummaryState] = useState(
    notification.summary ? 'complete' : 
    notification.summaryPending ? 'loading' : 'none'
  )

  useEffect(() => {
    if (notification?.icon && notification.icon.startsWith('https://cdn.discordapp.com')) {
      window.api.fetchDiscordImage?.(notification.icon).then((localUrl) => {
        if (localUrl) setAvatarSrc(localUrl)
      })
    }

    // Initialize summary state based on notification
    const initialSummaryState = notification.summary ? 'complete' : 
                               notification.summaryPending ? 'loading' : 'none'
    setSummaryState(initialSummaryState)
    setSummary(notification.summary)

    // Check if we need to listen for summary updates
    if (notification.summaryPending && notification.body) {
      // Listen for summary updates for this specific notification
      const handleSummaryUpdate = (_, { id, summary, cancelled }) => {
        if (id === notification.id) {
          if (summary) {
            setSummary(summary)
            setSummaryState('complete')
          } else if (cancelled) {
            setSummaryState('none')
          }
        }
      }

      // Register event listener
      window.electron.ipcRenderer.on('discord:summary-update', handleSummaryUpdate)

      // Cleanup event listener when component unmounts
      return () => {
        window.electron.ipcRenderer.removeListener('discord:summary-update', handleSummaryUpdate)
      }
    }
  }, [notification])

  const getImportanceClass = () => {
    switch (notification.importance) {
      case 'HIGH': return 'importance-high';
      case 'MEDIUM': return 'importance-medium';
      case 'LOW': return 'importance-low';
      default: return '';
    }
  };

  return (
    <div className={`notification-item ${getImportanceClass()}`}>
      <div className="notification-header">
        <img
          src={avatarSrc}
          alt="Avatar"
          className="avatar"
        />
        <div className="notification-user">
          <span className="username">{notification.author?.name || 'Discord User'}</span>
          <span className="timestamp">{formatTimestamp(notification.timestamp)}</span>
        </div>
        {notification.category && (
          <div className="message-category">
            <span className="category-label">{notification.category.replace(/_/g, ' ')}</span>
            {notification.importance && (
              <span className={`importance-indicator ${notification.importance.toLowerCase()}`}>
                {notification.importance}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <p className="notification-body">
          {typeof notification.body === 'string' && notification.body.match(/<t:\d+:[tTdDfFR]>/g) 
            ? formatMessageWithTimestamps(notification.body) 
            : notification.body}
        </p>

        {summaryState === 'loading' && (
          <div className="notification-summary loading">
            <div className="summary-title">Generating summary...</div>
            <div className="summary-loading-indicator">
              <div className="dot-pulse">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        {summaryState === 'complete' && summary && (
          <div className="notification-summary">
            <div className="summary-title">AI Summary</div>
            <p className="summary-text">{summary}</p>
          </div>
        )}
      </div>

      <div className="notification-meta">
        <div className="notification-actions">
          {notification.category === 'EVENT' && (
            <CalendarEventButton eventData={notification} notificationId={notification.id} />
          )}
        </div>
        <span className="server-info">
          {notification.serverName} • #{notification.channelName}
        </span>
        {notification.messageLink && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.electron.ipcRenderer.send('open-external', notification.messageLink)
            }}
            className="message-link"
          >
            View in Discord
          </a>
        )}
      </div>
    </div>
  )
}

// Define PropTypes for the NotificationItem component
NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.string,
    icon: PropTypes.string,
    title: PropTypes.string,
    body: PropTypes.string,
    summary: PropTypes.string,
    timestamp: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.instanceOf(Date)
    ]),
    serverName: PropTypes.string,
    channelName: PropTypes.string,
    messageLink: PropTypes.string,
    author: PropTypes.shape({
      name: PropTypes.string,
      avatar: PropTypes.string
    })
  }).isRequired
}

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [displayedNotifications, setDisplayedNotifications] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalNotifications, setTotalNotifications] = useState(0)
  const notificationsPerPage = 10
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState({
    clientId: '',
    clientSecret: '',
    openaiApiKey: '',
    openaiApiEndpoint: 'https://api.openai.com/v1',
    enableSummarization: false,
    summaryDetectionMode: 'length',
    minLengthForSummary: 100,
    model: 'gpt-4o-mini',
    minimizeToTray: false
  })
  const [theme, setTheme] = useState(() => {
    // Get saved theme or default to system preference
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      return savedTheme
    }

    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [importanceFilter, setImportanceFilter] = useState('ALL');

  // Add state to track if we're viewing a DM
  const [isDMView, setIsDMView] = useState(false);

  // Filter notifications based on category and importance
  const filteredNotifications = displayedNotifications.filter(notification => {
    const matchesCategory = categoryFilter === 'ALL' || notification.category === categoryFilter;
    const matchesImportance = importanceFilter === 'ALL' || notification.importance === importanceFilter;
    return matchesCategory && matchesImportance;
  });

  // Apply theme class to body element
  useEffect(() => {
    document.body.className = `theme-${theme}`
    localStorage.setItem('theme', theme)
  }, [theme])

  // Load notifications with pagination
  const loadNotifications = async (currentPage = 1, append = false) => {
    try {
      setIsLoadingMore(true)
      const result = await window.api.discord.getNotificationsPage({
        page: currentPage,
        perPage: notificationsPerPage
      })

      if (append) {
        setDisplayedNotifications((prev) => [...prev, ...result.notifications])
      } else {
        setDisplayedNotifications(result.notifications)
      }

      setHasMore(result.hasMore)
      setTotalNotifications(result.total)
      setIsLoadingMore(false)
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setIsLoadingMore(false)
    }
  }

  // Handle loading more notifications
  const handleLoadMore = () => {
    if (isLoadingMore) return

    const nextPage = page + 1
    setPage(nextPage)
    loadNotifications(nextPage, true)
  }

  // Toggle between light and dark theme
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  // Load settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const storedSettings = await window.api.discord.getSettings()
        if (storedSettings) {
          console.log('Settings loaded from main process')
          setSettings(storedSettings)
        } else {
          console.log('No settings returned from main process')
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err)
      }
    }

    fetchSettings()
  }, [])

  // Initialize notifications when component mounts
  useEffect(() => {
    if (isConnected) {
      loadNotifications(1, false)
    }
  }, [isConnected])

  // Handle saving settings
  const handleSaveSettings = async (newSettings) => {
    try {
      // Trim whitespace from inputs
      const trimmedSettings = {
        clientId: newSettings.clientId.trim(),
        clientSecret: newSettings.clientSecret.trim(),
        openaiApiKey: newSettings.openaiApiKey.trim(),
        openaiApiEndpoint: newSettings.openaiApiEndpoint.trim() || 'https://api.openai.com/v1',
        enableSummarization: newSettings.enableSummarization,
        summaryDetectionMode: newSettings.summaryDetectionMode,
        minLengthForSummary: newSettings.minLengthForSummary,
        model: newSettings.model,
        minimizeToTray: newSettings.minimizeToTray
      }

      await window.api.discord.updateSettings(trimmedSettings)
      setSettings(trimmedSettings)
      console.log('Settings saved successfully')

      // If the client ID or secret has changed and we're connected, disconnect
      if (
        (trimmedSettings.clientId !== settings.clientId ||
          trimmedSettings.clientSecret !== settings.clientSecret) &&
        isConnected
      ) {
        console.log('Client credentials changed, disconnecting...')
        handleDisconnect()
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  useEffect(() => {
    // Check initial connection status
    window.api.discord.isConnected().then((connected) => {
      setIsConnected(connected)
      if (connected) {
        loadNotifications(1, false)
      }
    })

    // Set up listeners for new notifications and connection changes
    const removeNotificationListener = window.api.discord.onNotification((notification) => {
      console.log('New notification received:', notification.id)
      // Add the new notification to the top of the displayed list
      setDisplayedNotifications((prev) => [notification, ...prev])
      // Increment total count
      setTotalNotifications((prev) => prev + 1)
    })

    const removeConnectionListener = window.api.discord.onConnectionChange((connected) => {
      setIsConnected(connected)
      setIsConnecting(false)

      if (connected) {
        // When connected, load the first page
        setPage(1)
        loadNotifications(1, false)
      } else {
        // When disconnected, clear notifications
        setDisplayedNotifications([])
        setTotalNotifications(0)
      }
    })

    // Add listener for notification updates (category & importance)
    const removeNotificationUpdateListener = window.api.discord.onNotificationUpdate((update) => {
      console.log('Notification update received:', update)
      setDisplayedNotifications((prev) => 
        prev.map(notification => 
          notification.id === update.id
            ? { ...notification, category: update.category, importance: update.importance }
            : notification
        )
      )
    })

    return () => {
      removeNotificationListener()
      removeConnectionListener()
      removeNotificationUpdateListener()
    }
  }, [])

  const handleConnect = async () => {
    if (isConnecting || isConnected) return

    // Check if clientId and clientSecret are set and not just whitespace
    if (!settings.clientId?.trim() || !settings.clientSecret?.trim()) {
      setError('Please enter your Discord client ID and secret in settings.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      console.log('Attempting to connect to Discord...')
      const result = await window.api.discord.connect()
      if (!result.success) {
        throw new Error(result.error || 'Failed to connect to Discord')
      }
      console.log('Successfully connected to Discord')
    } catch (err) {
      console.error('Failed to connect to Discord', err)
      setError(err.message || 'Failed to connect to Discord')
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await window.api.discord.disconnect()
      // Clear notifications when disconnecting
      setDisplayedNotifications([])
      setTotalNotifications(0)
      setPage(1)
      setHasMore(false)
    } catch (err) {
      console.error('Error disconnecting from Discord', err)
    }
  }

  // Add keydown event listener for the test notification shortcut for better accessibility
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check if Ctrl+Shift+T was pressed (keyCode 84 is 'T')
      if (event.ctrlKey && event.shiftKey && event.keyCode === 84) {
        console.log('Test notification keyboard shortcut detected in renderer')
        // Generate test notification via the IPC bridge
        window.api.discord.createTestNotification()
      }
    }

    // Add event listener
    window.addEventListener('keydown', handleKeyDown)

    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Update the view type when notifications change
  useEffect(() => {
    // Check if all current notifications are DMs
    const allDMs = displayedNotifications.every(n => n.serverName === 'Direct Message');
    setIsDMView(allDMs);
  }, [displayedNotifications]);

  const handleClose = () => {
    if (settings.minimizeToTray) {
      window.electron.ipcRenderer.send('minimize-to-tray')
    } else {
      window.electron.ipcRenderer.send('close-window')
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Discord Notifications</h1>

        {/* Only show filter controls if not in DM view */}
        {!isDMView && displayedNotifications.length > 0 && (
          <div className="filter-controls">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Categories</option>
              <option value="EVENT">Events & Planning</option>
              <option value="QUESTION">Questions</option>
              <option value="ANNOUNCEMENT">Announcements</option>
              <option value="CASUAL">Casual Chat</option>
            </select>

            <select
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        )}

        {/* Rest of the header content */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="settings-button"
            title="Settings"
          >
            <SettingsIcon />
          </button>

          {isConnected ? (
            <button onClick={handleDisconnect} className="disconnect-btn">
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className={isConnecting ? 'connect-btn connecting' : 'connect-btn'}
            >
              {isConnecting ? 'Connecting...' : 'Connect to Discord'}
            </button>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {error && (
        <div className="error-message">
          <p className="error-title">Error</p>
          <p>{error}</p>
          <p className="error-info">
            Make sure Discord desktop app is running and you&apos;re logged in.
          </p>
        </div>
      )}

      {isConnected && totalNotifications === 0 && !isLoadingMore && (
        <div className="empty-state">
          <p>No notifications yet.</p>
          <p className="empty-info">
            Notifications will appear here as you receive them in Discord.
          </p>
        </div>
      )}

      {!isConnected && !isConnecting && !error && (
        <div className="empty-state">
          <p>Connect to Discord to view your notifications</p>
          <p className="empty-info">Requires Discord desktop app to be running</p>
          <p className="empty-info" style={{ marginTop: '16px' }}>
            <kbd>Ctrl+Shift+T</kbd> - Generate a test notification
          </p>
        </div>
      )}

      {isConnecting && (
        <div className="empty-state">
          <p>Connecting to Discord...</p>
          <p className="empty-info">You may need to authorize this application in Discord</p>
        </div>
      )}

      {isConnected && (filteredNotifications.length > 0 || isLoadingMore) && (
        <div className="notification-list-container">
          <div className="notification-list">
            {filteredNotifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}

            {isLoadingMore && (
              <div className="loading-indicator">
                <p>Loading more notifications...</p>
              </div>
            )}

            {hasMore && !isLoadingMore && (
              <div className="load-more-container">
                <button onClick={handleLoadMore} className="load-more-button">
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App

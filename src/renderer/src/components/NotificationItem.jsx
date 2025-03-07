import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import CalendarEventButton from './CalendarEventButton'
import { formatTimestamp, formatMessageWithTimestamps } from '../utils/timeFormatters'

// AI Star icon for processing indicator
const AiStarIcon = () => (
  <svg className="ai-star-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L9.0718 8.83688L2 9.27313L7.0359 14.1631L5.90492 21L12 17.7775L18.0951 21L16.9641 14.1631L22 9.27313L14.9282 8.83688L12 2Z" />
  </svg>
)

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
      case 'HIGH':
        return 'importance-high'
      case 'MEDIUM':
        return 'importance-medium'
      case 'LOW':
        return 'importance-low'
      default:
        return ''
    }
  }

  return (
    <div className={`notification-item ${getImportanceClass()}`}>
      <div className="notification-header">
        <img src={avatarSrc} alt="Avatar" className="avatar" />
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
          {typeof notification.body === 'string' && notification.body.match(/<t:\d+:[tTdDfFR]>/g) ? formatMessageWithTimestamps(notification.body) : notification.body}
        </p>

        {summaryState === 'loading' && (
          <div className="notification-summary loading">
            <div className="summary-title">
              <AiStarIcon /> Analyzing message...
            </div>
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

      {summaryState === 'loading' && (
        <div className="processing-indicator">
          <AiStarIcon />
          <span>Processing with AI</span>
        </div>
      )}

      <div className="notification-meta">
        <div className="notification-actions">
          {(notification.category === 'EVENT' || 
            notification.eventStart || 
            notification.eventName) && (
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
    summaryPending: PropTypes.bool,
    timestamp: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.instanceOf(Date)
    ]),
    serverName: PropTypes.string,
    channelName: PropTypes.string,
    messageLink: PropTypes.string,
    category: PropTypes.string,
    importance: PropTypes.string,
    author: PropTypes.shape({
      name: PropTypes.string,
      avatar: PropTypes.string
    }),
    // Event data properties needed by CalendarEventButton
    eventName: PropTypes.string,
    eventDescription: PropTypes.string,
    eventStart: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    eventEnd: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    eventLocation: PropTypes.string
  }).isRequired
}

export default NotificationItem

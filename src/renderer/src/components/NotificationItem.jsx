import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import CalendarEventButton from './CalendarEventButton'
import { formatTimestamp, formatMessageWithTimestamps } from '../utils/timeFormatters'
import TextStreamer from './TextStreamer'

// AI Star icon for processing indicator
const AiStarIcon = () => (
  <svg className="ai-star-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L9.0718 8.83688L2 9.27313L7.0359 14.1631L5.90492 21L12 17.7775L18.0951 21L16.9641 14.1631L22 9.27313L14.9282 8.83688L12 2Z" />
  </svg>
)

const NotificationItem = ({ notification }) => {
  const [avatarSrc, setAvatarSrc] = useState('https://cdn.discordapp.com/embed/avatars/0.png')
  const [summary, setSummary] = useState(notification.summary)
  const [isStreaming, setIsStreaming] = useState(false);
  const [streaming, setStreaming] = useState(false);
  
  // Be extra cautious about the initial state - only set to loading if explicitly true
  const [summaryState, setSummaryState] = useState(() => {
    console.log('Initial summaryState calculation:', {
      summary: !!notification.summary,
      summaryPending: notification.summaryPending,
      result: notification.summary ? 'complete' : 
              notification.summaryPending === true ? 'loading' : 'none'
    });
    return notification.summary ? 'complete' : 
           notification.summaryPending === true ? 'loading' : 'none';
  });
  
  const [eventDetails, setEventDetails] = useState(notification.eventDetails)

  useEffect(() => {
    if (notification?.icon && notification.icon.startsWith('https://cdn.discordapp.com')) {
      window.api.fetchDiscordImage?.(notification.icon).then((localUrl) => {
        if (localUrl) setAvatarSrc(localUrl)
      })
    }

    // Extra defensive check when setting initial state
    const initialSummaryState = notification.summary ? 'complete' : 
                               notification.summaryPending === true ? 'loading' : 'none';
    console.log('Setting initial summaryState:', {
      id: notification.id,
      summary: !!notification.summary, 
      summaryPending: notification.summaryPending,
      state: initialSummaryState
    });
    setSummaryState(initialSummaryState);
    setSummary(notification.summary);
    
    // Ensure eventDetails is set from notification
    if (notification.eventDetails) {
      console.log('NotificationItem - setting eventDetails:', notification.eventDetails)
      console.log('NotificationItem - eventDetails data check:', {
        title: notification.eventDetails.title || 'MISSING',
        date: notification.eventDetails.date || 'MISSING', 
        time: notification.eventDetails.time || 'MISSING'
      })
      setEventDetails(notification.eventDetails)
    } else {
      console.log('NotificationItem - notification has no eventDetails')
    }
    
    // Debug log for eventDetails
    console.log('NotificationItem - eventDetails from notification:', notification.eventDetails)

    // Listen for summary updates
    const handleSummaryUpdate = (_, { id, summary, cancelled, noSummaryNeeded }) => {
      if (id === notification.id) {
        if (summary) {
          setSummary(summary)
          setSummaryState('complete')
          // We don't set isStreaming here anymore since we'll handle real streaming
        } else if (cancelled || noSummaryNeeded) {
          setSummaryState('none')
        }
      }
    }

    // New handler for streaming summary chunks
    const handleSummaryStreamUpdate = (_, { id, chunk, fullText }) => {
      if (id === notification.id) {
        setStreaming(true);
        setSummary(fullText);
        setSummaryState('complete');
      }
    }

    // Listen for notification updates with improved debugging
    const handleNotificationUpdate = (_, update) => {
      console.log('NotificationItem - received update:', {
        matchesId: update.id === notification.id,
        updateId: update.id,
        notificationId: notification.id,
        summaryPending: update.summaryPending,
        debug: update.debug || 'No debug info'
      });
      
      if (update.id === notification.id) {
        if (update.eventDetails) {
          console.log('NotificationItem - received eventDetails update:', update.eventDetails)
          console.log('NotificationItem - eventDetails update check:', {
            hasRequiredFields: !!(
              update.eventDetails?.title && 
              update.eventDetails?.date && 
              update.eventDetails?.time
            ),
            title: update.eventDetails.title || 'MISSING',
            date: update.eventDetails.date || 'MISSING', 
            time: update.eventDetails.time || 'MISSING'
          })
          setEventDetails(update.eventDetails)
        }
        
        // Extra defensive check for summaryPending updates
        if (update.summaryPending !== undefined) {
          const newState = update.summaryPending === true ? 'loading' : 'none';
          console.log('Updating summaryState from update:', {
            id: update.id,
            oldState: summaryState,
            newState,
            summaryPending: update.summaryPending
          });
          setSummaryState(newState);
        }
        
        // If update includes summary, always move to complete state
        if (update.summary) {
          setSummary(update.summary);
          setSummaryState('complete');
        }
      }
    }

    // Register event listeners
    window.electron.ipcRenderer.on('discord:summary-update', handleSummaryUpdate)
    window.electron.ipcRenderer.on('discord:summary-stream-chunk', handleSummaryStreamUpdate);
    window.electron.ipcRenderer.on('discord:notification-update', handleNotificationUpdate)

    // Cleanup event listeners when component unmounts
    return () => {
      window.electron.ipcRenderer.removeListener('discord:summary-update', handleSummaryUpdate)
      window.electron.ipcRenderer.removeListener('discord:summary-stream-chunk', handleSummaryStreamUpdate);
      window.electron.ipcRenderer.removeListener('discord:notification-update', handleNotificationUpdate)
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

  // Add this debug log outside of useEffect to track current state
  console.log('NotificationItem render - current eventDetails:', eventDetails)

  // Add debug output to understand rendering decisions
  console.log('NotificationItem render state:', {
    id: notification.id,
    summaryState,
    shouldShowLoading: summaryState === 'loading',
    shouldShowComplete: summaryState === 'complete' && summary
  });

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

        {/* Extra condition to ensure we only show when truly loading */}
        {summaryState === 'loading' && summaryState !== 'none' && summaryState !== 'complete' && (
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

        {/* Use TextStreamer for the summary text */}
        {summaryState === 'complete' && summary && (
          <div className="notification-summary">
            <div className="summary-title">AI Summary</div>
            <p className="summary-text">
              {isStreaming || streaming ? (
                <TextStreamer 
                  text={summary} 
                  speed={2}  // Faster speed (lower number = faster intervals)
                  onComplete={() => {
                    setIsStreaming(false);
                    setStreaming(false);
                  }} 
                />
              ) : summary}
            </p>
          </div>
        )}
      </div>

      {/* Extra check for processing indicator */}
      {summaryState === 'loading' && summaryState !== 'none' && summaryState !== 'complete' && (
        <div className="processing-indicator">
          <AiStarIcon />
          <span>Processing with AI</span>
        </div>
      )}

      <div className="notification-meta">
        <div className="notification-actions">
          {eventDetails && (
            <>
              <CalendarEventButton 
                eventData={{
                  eventDetails: eventDetails
                }}
              />
              {/* Debug display for fields required for calendar button */}
              {/* <div style={{fontSize: '10px', color: '#666', margin: '5px 0', display: 'block'}}>
                Event found: {eventDetails.title} on {eventDetails.date} at {eventDetails.time}
              </div> */}
            </>
          )}
          {/* {!eventDetails && notification.eventPending && (
            <div style={{fontSize: '10px', color: '#666', margin: '5px 0'}}>
              Checking for event details...
            </div>
          )}
          {!eventDetails && !notification.eventPending && (
            <div style={{fontSize: '10px', color: '#666', margin: '5px 0'}}>
              No event details found
            </div>
          )} */}
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
    eventLocation: PropTypes.string,
    eventDetails: PropTypes.shape({
      title: PropTypes.string,
      date: PropTypes.string,
      time: PropTypes.string,
      endDate: PropTypes.string,
      endTime: PropTypes.string,
      description: PropTypes.string,
      location: PropTypes.string
    })
  }).isRequired
}

export default NotificationItem

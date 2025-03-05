import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import CalendarEventButton from './CalendarEventButton'

/**
 * Formats a Discord timestamp tag into human-readable text
 * @param {string} timestamp - Unix timestamp
 * @param {string} format - Discord format type (t, T, d, D, f, F, R)
 * @returns {string} Formatted timestamp
 */
const formatDiscordTimestamp = (timestamp, format) => {
  const date = new Date(timestamp * 1000);
  
  switch (format) {
    case 't': // Short Time (e.g., 2:30 PM)
      return date.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit'
      });
    case 'T': // Long Time (e.g., 2:30:20 PM)
      return date.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit',
        second: '2-digit'
      });
    case 'd': // Short Date (e.g., 20/12/2023)
      return date.toLocaleDateString();
    case 'D': // Long Date (e.g., December 20, 2023)
      return date.toLocaleDateString(undefined, { 
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'f': // Short Date/Time (e.g., 20 December 2023 2:30 PM)
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    case 'F': // Long Date/Time (e.g., Wednesday, December 20, 2023 2:30 PM)
      return date.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    case 'R': // Relative (e.g., 2 hours ago, in 3 days)
      const diff = date - new Date();
      const absMs = Math.abs(diff);
      const absSec = Math.floor(absMs / 1000);
      const absMin = Math.floor(absSec / 60);
      const absHour = Math.floor(absMin / 60);
      const absDay = Math.floor(absHour / 24);
      
      if (absDay > 0) {
        return diff > 0 ? `in ${absDay} day${absDay === 1 ? '' : 's'}` : `${absDay} day${absDay === 1 ? '' : 's'} ago`;
      }
      if (absHour > 0) {
        return diff > 0 ? `in ${absHour} hour${absHour === 1 ? '' : 's'}` : `${absHour} hour${absHour === 1 ? '' : 's'} ago`;
      }
      if (absMin > 0) {
        return diff > 0 ? `in ${absMin} minute${absMin === 1 ? '' : 's'}` : `${absMin} minute${absMin === 1 ? '' : 's'} ago`;
      }
      return diff > 0 ? 'in a few seconds' : 'a few seconds ago';
    default:
      return date.toLocaleString();
  }
};

/**
 * Formats the message body by replacing Discord timestamp tags with formatted dates
 * @param {string} text - Message text containing Discord timestamp tags
 * @returns {Array} Array of text and formatted timestamp elements
 */
const formatMessageWithTimestamps = (text) => {
  if (!text) return [];
  
  const timestampRegex = /<t:(\d+):([tTdDfFR])>/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = timestampRegex.exec(text)) !== null) {
    // Add text before the timestamp
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add the formatted timestamp
    parts.push(
      <span key={match.index} className="discord-timestamp">
        {formatDiscordTimestamp(match[1], match[2])}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
};

/**
 * Displays a Discord notification with avatar and content
 * Handles loading and caching of Discord avatars locally
 * Formats Discord timestamp tags in the message
 */
const NotificationItem = ({ notification }) => {
  // Default avatar URL if none provided or while loading
  const [avatarSrc, setAvatarSrc] = useState('https://cdn.discordapp.com/embed/avatars/0.png')

  // Load and cache Discord avatar when notification changes
  useEffect(() => {
    if (notification?.icon && notification.icon.startsWith('https://cdn.discordapp.com')) {
      window.api.fetchDiscordImage(notification.icon).then((localUrl) => {
        if (localUrl) setAvatarSrc(localUrl)
      })
    }
  }, [notification?.icon])

  return (
    <div className="notification-item">
      <div className="notification-header">
        <img src={avatarSrc} alt="Avatar" className="avatar" />
        <div className="notification-user">
          <span className="username">{notification.author?.name || 'Discord User'}</span>
          <span className="timestamp">{formatDiscordTimestamp(Math.floor(new Date(notification.timestamp).getTime() / 1000), 'f')}</span>
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
          {formatMessageWithTimestamps(notification.body)}
        </p>
      </div>

      <div className="notification-meta">
        <span className="server-info">
          {notification.serverName} • #{notification.channelName}
        </span>
        <div className="notification-actions">
          {notification.eventDetails && (
            <CalendarEventButton eventData={notification} />
          )}
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
    </div>
  )
}

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.string,
    icon: PropTypes.string,
    title: PropTypes.string,
    body: PropTypes.string,
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
    eventDetails: PropTypes.shape({
      title: PropTypes.string,
      date: PropTypes.string,
      time: PropTypes.string,
      description: PropTypes.string,
      location: PropTypes.string
    }),
    author: PropTypes.shape({
      name: PropTypes.string,
      avatar: PropTypes.string
    })
  }).isRequired
}

export default NotificationItem

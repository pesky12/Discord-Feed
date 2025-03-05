import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

/**
 * Displays a Discord notification with avatar and content
 * Handles loading and caching of Discord avatars locally
 * @param {Object} props - Component props
 * @param {Object} props.notification - The notification data to display
 * @param {string} props.notification.icon - URL of the user/guild avatar
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

  return <img src={avatarSrc} alt="Avatar" className="avatar" />
}

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    icon: PropTypes.string
  })
}

NotificationItem.defaultProps = {
  notification: {}
}

export default NotificationItem

import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

const NotificationItem = ({ notification }) => {
  const [avatarSrc, setAvatarSrc] = useState('https://cdn.discordapp.com/embed/avatars/0.png')

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

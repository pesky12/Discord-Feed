import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

const DiscordSettings = ({ settings, onChange, showValidation }) => {
  const [clientId, setClientId] = useState(settings.clientId || '')
  const [clientSecret, setClientSecret] = useState(settings.clientSecret || '')
  const [minimizeToTray, setMinimizeToTray] = useState(settings.minimizeToTray || false)

  // Update local state when settings prop changes
  useEffect(() => {
    setClientId(settings.clientId || '')
    setClientSecret(settings.clientSecret || '')
    setMinimizeToTray(settings.minimizeToTray || false)
  }, [settings])

  // Update parent component state when local state changes
  const handleClientIdChange = (e) => {
    setClientId(e.target.value)
    onChange({ clientId: e.target.value })
  }

  const handleClientSecretChange = (e) => {
    setClientSecret(e.target.value)
    onChange({ clientSecret: e.target.value })
  }

  const handleMinimizeToTrayChange = (e) => {
    setMinimizeToTray(e.target.checked)
    onChange({ minimizeToTray: e.target.checked })
  }

  return (
    <>
      <div className={`form-group ${showValidation && !clientId.trim() ? 'has-error' : ''}`}>
        <label htmlFor="clientId">Client ID:</label>
        <input
          type="text"
          id="clientId"
          value={clientId}
          onChange={handleClientIdChange}
          placeholder="Enter your Discord application client ID"
        />
        {showValidation && !clientId.trim() && (
          <div className="validation-error">Client ID is required</div>
        )}
      </div>
      <div className={`form-group ${showValidation && !clientSecret.trim() ? 'has-error' : ''}`}>
        <label htmlFor="clientSecret">Client Secret:</label>
        <input
          type="password"
          id="clientSecret"
          value={clientSecret}
          onChange={handleClientSecretChange}
          placeholder="Enter your Discord application client secret"
        />
        {showValidation && !clientSecret.trim() && (
          <div className="validation-error">Client Secret is required</div>
        )}
      </div>
      <div className="form-help">
        <p>
          You can find your Client ID and Secret in the{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.electron.ipcRenderer.send(
                'open-external',
                'https://discord.com/developers/applications'
              )
            }}
          >
            Discord Developer Portal
          </a>
          .
        </p>
        <p className="form-note">
          Important: Make sure to add <code>http://localhost:5173</code> as a redirect URI in your Discord
          application OAuth2 settings.
        </p>
      </div>
      <div className="form-group">
        <label htmlFor="minimizeToTray" className="toggle-label">
          <input
            type="checkbox"
            id="minimizeToTray"
            checked={minimizeToTray}
            onChange={handleMinimizeToTrayChange}
          />
          <span className="toggle-text">Minimize to system tray instead of closing</span>
        </label>
        <div className="form-help">
          <p>When enabled, clicking the close button will minimize the app to the system tray</p>
        </div>
      </div>
    </>
  )
}

DiscordSettings.propTypes = {
  settings: PropTypes.shape({
    clientId: PropTypes.string,
    clientSecret: PropTypes.string,
    minimizeToTray: PropTypes.bool
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  showValidation: PropTypes.bool
}

export default DiscordSettings

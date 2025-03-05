import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import DiscordSettings from './DiscordSettings'
import AiSettings from './AiSettings'
import AppSettings from './AppSettings'

const SettingsModal = ({ isOpen, onClose, settings, onSave }) => {
  const [currentTab, setCurrentTab] = useState('discord')
  const [formData, setFormData] = useState({ ...settings })
  const [showValidation, setShowValidation] = useState(false)
  const [startWithWindows, setStartWithWindows] = useState(false)

  // Update state when settings prop changes
  useEffect(() => {
    if (settings) {
      setFormData({ ...settings })
    }
  }, [settings])

  // Check current auto-launch setting when component mounts
  useEffect(() => {
    const checkAutoLaunch = async () => {
      try {
        const enabled = await window.api.app.getAutoLaunchEnabled();
        setStartWithWindows(enabled);
      } catch (error) {
        console.error('Failed to get auto-launch status:', error);
      }
    };
    
    if (isOpen) {
      checkAutoLaunch();
    }
  }, [isOpen]);

  const handleSave = async () => {
    // Check if Discord fields are empty when on Discord tab
    if (currentTab === 'discord' && (!formData.clientId?.trim() || !formData.clientSecret?.trim())) {
      setShowValidation(true)
      return
    }

    // Check if OpenAI settings are valid when summarization is enabled
    if (currentTab === 'ai' && formData.enableSummarization) {
      // For all cases, only require an endpoint URL
      if (!formData.openaiApiEndpoint?.trim()) {
        setShowValidation(true)
        return
      }
    }

    // Update auto-launch setting
    try {
      await window.api.app.setAutoLaunchEnabled(startWithWindows);
    } catch (error) {
      console.error('Failed to set auto-launch setting:', error);
    }

    // Include startWithWindows in the saved settings
    onSave({
      ...formData,
      // Although startWithWindows is handled separately via the API,
      // we'll pass it to onSave for consistency
    })

    setShowValidation(false)
    onClose()
  }

  const handleChange = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }))
  }

  // Toggle auto-launch setting
  const handleAutoLaunchToggle = (checked) => {
    setStartWithWindows(checked);
  };

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Settings</h2>
          <button onClick={onClose} className="close-button">
            ×
          </button>
        </div>
        <div className="modal-tabs">
          <button
            className={`modal-tab ${currentTab === 'discord' ? 'active' : ''}`}
            onClick={() => setCurrentTab('discord')}
          >
            Discord
          </button>
          <button
            className={`modal-tab ${currentTab === 'ai' ? 'active' : ''}`}
            onClick={() => setCurrentTab('ai')}
          >
            AI Summarization
          </button>
          <button
            className={`modal-tab ${currentTab === 'app' ? 'active' : ''}`}
            onClick={() => setCurrentTab('app')}
          >
            App Settings
          </button>
        </div>
        <div className="modal-body">
          {currentTab === 'discord' && (
            <DiscordSettings
              settings={formData}
              onChange={handleChange}
              showValidation={showValidation}
            />
          )}

          {currentTab === 'ai' && (
            <AiSettings
              settings={formData}
              onChange={handleChange}
              showValidation={showValidation}
            />
          )}
          
          {currentTab === 'app' && (
            <AppSettings
              startWithWindows={startWithWindows}
              onAutoLaunchToggle={handleAutoLaunchToggle}
            />
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button onClick={handleSave} className="save-button">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

SettingsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  settings: PropTypes.shape({
    clientId: PropTypes.string,
    clientSecret: PropTypes.string,
    openaiApiKey: PropTypes.string,
    openaiApiEndpoint: PropTypes.string,
    enableSummarization: PropTypes.bool,
    summaryDetectionMode: PropTypes.string,
    minLengthForSummary: PropTypes.number,
    model: PropTypes.string,
    minimizeToTray: PropTypes.bool
  }).isRequired,
  onSave: PropTypes.func.isRequired
}

export default SettingsModal

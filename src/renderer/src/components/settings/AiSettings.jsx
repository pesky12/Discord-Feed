import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

const AiSettings = ({ settings, onChange, showValidation }) => {
  const [enableSummarization, setEnableSummarization] = useState(settings.enableSummarization || false)
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey || '')
  const [openaiApiEndpoint, setOpenaiApiEndpoint] = useState(settings.openaiApiEndpoint || 'https://api.openai.com/v1')
  const [summaryDetectionMode, setSummaryDetectionMode] = useState(settings.summaryDetectionMode || 'length')
  const [minLengthForSummary, setMinLengthForSummary] = useState(settings.minLengthForSummary || 100)
  const [model, setModel] = useState(settings.model || 'gpt-4o-mini')
  const [testingConnection, setTestingConnection] = useState(false)
  const [testConnectionResult, setTestConnectionResult] = useState(null)

  // Update local state when settings prop changes
  useEffect(() => {
    setEnableSummarization(settings.enableSummarization || false)
    setOpenaiApiKey(settings.openaiApiKey || '')
    setOpenaiApiEndpoint(settings.openaiApiEndpoint || 'https://api.openai.com/v1')
    setSummaryDetectionMode(settings.summaryDetectionMode || 'length')
    setMinLengthForSummary(settings.minLengthForSummary || 100)
    setModel(settings.model || 'gpt-4o-mini')
  }, [settings])

  // Update parent state when local state changes
  const handleEnableSummarizationChange = (e) => {
    setEnableSummarization(e.target.checked)
    onChange({ enableSummarization: e.target.checked })
  }

  const handleApiKeyChange = (e) => {
    setOpenaiApiKey(e.target.value)
    onChange({ openaiApiKey: e.target.value })
  }

  const handleApiEndpointChange = (e) => {
    setOpenaiApiEndpoint(e.target.value)
    onChange({ openaiApiEndpoint: e.target.value })
  }

  const handleDetectionModeChange = (mode) => {
    setSummaryDetectionMode(mode)
    onChange({ summaryDetectionMode: mode })
  }

  const handleMinLengthChange = (e) => {
    const value = parseInt(e.target.value)
    setMinLengthForSummary(value)
    onChange({ minLengthForSummary: value })
  }

  const handleModelChange = (e) => {
    setModel(e.target.value)
    onChange({ model: e.target.value })
  }

  // Function to test the LLM connection
  const testConnection = async () => {
    if (!openaiApiEndpoint.trim()) {
      setTestConnectionResult({
        success: false,
        message: 'API endpoint is required'
      })
      return
    }

    try {
      setTestingConnection(true)
      setTestConnectionResult(null)

      const result = await window.api.discord.testLlmConnection({
        apiKey: openaiApiKey.trim(),
        apiEndpoint: openaiApiEndpoint.trim(),
        model: model.trim() || 'gpt-4o-mini'
      })

      if (result.success) {
        setTestConnectionResult({
          success: true,
          message: `Connection successful! Model: ${result.modelName || model}`
        })
      } else {
        setTestConnectionResult({
          success: false,
          message: `Connection failed: ${result.error || 'Unknown error'}`
        })
      }
    } catch (err) {
      setTestConnectionResult({
        success: false,
        message: `Error: ${err.message || 'Unknown error'}`
      })
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <>
      <div className="form-group">
        <label htmlFor="enableSummarization" className="toggle-label">
          <input
            type="checkbox"
            id="enableSummarization"
            checked={enableSummarization}
            onChange={handleEnableSummarizationChange}
          />
          <span className="toggle-text">Enable AI message summarization</span>
        </label>
      </div>

      {enableSummarization && (
        <>
          <div className="form-group">
            <label htmlFor="openaiApiEndpoint">API Endpoint:</label>
            <input
              type="text"
              id="openaiApiEndpoint"
              value={openaiApiEndpoint}
              onChange={handleApiEndpointChange}
              placeholder="https://api.openai.com/v1"
              className={showValidation && !openaiApiEndpoint.trim() ? 'has-error' : ''}
            />
            {showValidation && !openaiApiEndpoint.trim() && (
              <div className="validation-error">API endpoint is required</div>
            )}
            <div className="form-help">
              <p>Default: <code>https://api.openai.com/v1</code></p>
              <p>You can use any OpenAI-compatible endpoint, including local servers like Ollama, or cloud services.</p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="openaiApiKey">API Key:</label>
            <input
              type="password"
              id="openaiApiKey"
              value={openaiApiKey}
              onChange={handleApiKeyChange}
              placeholder="Enter your OpenAI or compatible API key (optional for some servers)"
            />
            <div className="form-help">
              <p>API key is optional for servers that don't require authentication</p>
              <p>For OpenAI or similar cloud services, an API key is typically required</p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="summaryDetectionMode">Summarization Detection Mode:</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="summaryDetectionMode"
                  value="length"
                  checked={summaryDetectionMode === 'length'}
                  onChange={() => handleDetectionModeChange('length')}
                />
                <span>Simple length-based detection</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="summaryDetectionMode"
                  value="smart"
                  checked={summaryDetectionMode === 'smart'}
                  onChange={() => handleDetectionModeChange('smart')}
                />
                <span>Smart AI-based detection</span>
              </label>
            </div>
            <div className="form-help">
              <p><strong>Simple:</strong> Summarize messages longer than the minimum length</p>
              <p><strong>Smart:</strong> Use AI to determine if a message needs summarization (uses additional API calls)</p>
            </div>
          </div>

          {summaryDetectionMode === 'length' && (
            <div className="form-group">
              <label htmlFor="minLengthForSummary">Minimum Message Length for Summarization:</label>
              <div className="slider-container">
                <input
                  type="range"
                  id="minLengthForSummary"
                  min="50"
                  max="500"
                  step="10"
                  value={minLengthForSummary}
                  onChange={handleMinLengthChange}
                />
                <span className="slider-value">{minLengthForSummary} characters</span>
              </div>
              <div className="form-help">
                <p>Messages shorter than this length will not be summarized</p>
              </div>
            </div>
          )}

          <div className="test-connection-container">
            <button
              onClick={testConnection}
              className="test-connection-button"
              disabled={testingConnection}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>

            {testConnectionResult && (
              <div className={`test-connection-result ${testConnectionResult.success ? 'success' : 'error'}`}>
                {testConnectionResult.message}
              </div>
            )}
          </div>

          <div className="form-note">
            <p>Message summarization uses AI to create short summaries of Discord messages.</p>
            <p>You can use OpenAI's API, a local LLM server like Ollama, or network servers with no authentication.</p>
          </div>
        </>
      )}

      {/* Model selection - always visible in AI tab */}
      <div className="form-group">
        <label htmlFor="model">Model:</label>
        <input
          type="text"
          id="model"
          value={model}
          onChange={handleModelChange}
          placeholder="Enter your OpenAI model name"
        />
        <div className="form-help">
          <p>Default: <code>gpt-4o-mini</code></p>
          <p>Common models: gpt-4o, gpt-3.5-turbo, gpt-4, llama3, claude-3-haiku</p>
          <p>For local LLMs like Ollama, use the model name as configured in your server</p>
        </div>
      </div>
    </>
  )
}

AiSettings.propTypes = {
  settings: PropTypes.shape({
    openaiApiKey: PropTypes.string,
    openaiApiEndpoint: PropTypes.string,
    enableSummarization: PropTypes.bool,
    summaryDetectionMode: PropTypes.string,
    minLengthForSummary: PropTypes.number,
    model: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  showValidation: PropTypes.bool
}

export default AiSettings

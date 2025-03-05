import PropTypes from 'prop-types'

const AppSettings = ({ startWithWindows, onAutoLaunchToggle }) => {
  const handleAutoLaunchChange = (e) => {
    onAutoLaunchToggle(e.target.checked);
  };

  return (
    <>
      <div className="form-group">
        <label htmlFor="startWithWindows" className="toggle-label">
          <input
            type="checkbox"
            id="startWithWindows"
            checked={startWithWindows}
            onChange={handleAutoLaunchChange}
          />
          <span className="toggle-text">Start with Windows</span>
        </label>
        <div className="form-help">
          <p>When enabled, Discord Feed will automatically start when you log in to Windows</p>
        </div>
      </div>
    </>
  )
}

AppSettings.propTypes = {
  startWithWindows: PropTypes.bool.isRequired,
  onAutoLaunchToggle: PropTypes.func.isRequired
}

export default AppSettings

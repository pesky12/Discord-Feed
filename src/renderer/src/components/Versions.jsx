import { useState } from 'react'

/**
 * Displays version information for the app's core dependencies
 * Shows Electron, Chromium, and Node.js versions in a footer bar
 */
function Versions() {
  // Get version info from electron process
  const [versions] = useState(window.electron.process.versions)

  return (
    <ul className="versions">
      <li className="electron-version">Electron v{versions.electron}</li>
      <li className="chrome-version">Chromium v{versions.chrome}</li>
      <li className="node-version">Node v{versions.node}</li>
    </ul>
  )
}

export default Versions

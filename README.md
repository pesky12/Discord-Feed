# Discord Notification Feed

A clean, organized feed for your Discord notifications built with Electron.

![Discord Notification Feed](resources/icon.png)

## Features

- 📋 Clean, organized feed for all Discord notifications
- 🌓 Dark and light theme support
- ⚙️ Customizable settings
- 🔗 Direct links to Discord messages
- 📱 Responsive design
- 📊 Efficient pagination for handling large numbers of notifications

## Installation

### Pre-built Installers

Download the latest release from the [Releases page](https://github.com/yourusername/discord-notification-feed/releases).

Available installers:
- Windows: `.exe` installer
- macOS: `.dmg` installer (coming soon)
- Linux: `.AppImage`, `.deb`, and `.snap` packages (coming soon)

### Manual Installation (Portable)

1. Download the ZIP file from the [Releases page](https://github.com/yourusername/discord-notification-feed/releases)
2. Extract to any location
3. Run the executable directly

## Setup

1. Make sure Discord desktop app is running
2. On first launch, open Settings by clicking the gear icon
3. Enter your Discord Client ID and Secret
4. Click Connect to authorize with Discord
5. Start receiving notifications in a clean feed!

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (included with Node.js)

### Project Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Release Process

### How to Create a New Release

1. Update version in `package.json`
2. Commit your changes
3. Create and push a new tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. The GitHub Action will automatically:
   - Build the application for all platforms
   - Create a new release with all installers
   - Generate release notes

## License

[MIT License](LICENSE)

## Acknowledgements

- [Electron](https://www.electronjs.org/)
- [Discord RPC](https://github.com/xhayper/discord-rpc)

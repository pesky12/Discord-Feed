import { Client } from '@xhayper/discord-rpc'
import { ipcMain } from 'electron'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { initOpenAIService, getOpenAIService } from './openAiService'

/**
 * In-memory storage for Discord notifications with a maximum limit
 * @type {Array<Object>}
 */
let notifications = []

/**
 * Global state and references
 */
let isConnected = false
let client = null
let guildLookup = []
let mainWindowRef = null

/**
 * Maximum number of notifications to keep in memory
 * Prevents memory leaks while maintaining a reasonable history
 */
const MAX_NOTIFICATIONS = 1000

/**
 * Default application settings
 */
let settings = {
  clientId: '',
  clientSecret: '',
  openaiApiKey: '',
  openaiApiEndpoint: 'https://api.openai.com/v1',
  enableSummarization: false,
  summaryDetectionMode: 'length',
  minLengthForSummary: 100
}

/**
 * Gets the path to the settings file in user data directory
 * @returns {string} Full path to settings file
 */
function getSettingsPath() {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'discord-settings.json')
}

/**
 * Loads settings from disk, creating defaults if needed
 * Handles corrupted settings by creating backups
 */
function loadSettings() {
  const settingsPath = getSettingsPath()
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8')
      try {
        const loadedSettings = JSON.parse(data)
        console.log('Loaded settings from:', settingsPath)
        settings = { ...settings, ...loadedSettings }
      } catch (parseError) {
        console.error('Failed to parse settings file:', parseError)
        const backupPath = `${settingsPath}.backup-${Date.now()}`
        fs.copyFileSync(settingsPath, backupPath)
        console.log('Created backup of invalid settings file at:', backupPath)
        saveSettings()
      }
    } else {
      console.log('Settings file does not exist, will create on first save')
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

/**
 * Saves current settings to disk with proper error handling
 * Creates directories if they don't exist
 */
function saveSettings() {
  const settingsPath = getSettingsPath()
  try {
    const directory = join(settingsPath, '..')
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true })
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
    console.log('Saved settings to:', settingsPath)
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

/**
 * Generates an AI summary for a message using the OpenAI service
 * @param {string} message - The message content to summarize
 * @param {Object} context - Additional context about the message
 * @returns {Promise<string|null>} The generated summary or null if unavailable
 */
async function generateMessageSummary(message, context = {}) {
  if (!settings.enableSummarization) return null;
  
  const openAIService = getOpenAIService();
  if (!openAIService.isEnabled()) return null;
  
  try {
    return await openAIService.summarizeMessage(message, context);
  } catch (error) {
    console.error('Failed to summarize message:', error);
    return null;
  }
}

/**
 * Initializes the Discord RPC client and sets up IPC communication
 * Handles connection state, notifications, and settings management
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function initDiscordRpc(mainWindow) {
  mainWindowRef = mainWindow
  loadSettings()
  initOpenAIService(settings)

  // IPC Handlers for renderer communication
  ipcMain.handle('discord:update-settings', async (_, newSettings) => {
    settings = { ...settings, ...newSettings }
    saveSettings()
    getOpenAIService().updateSettings(newSettings)
    return { success: true }
  })

  ipcMain.handle('discord:get-settings', async () => {
    return settings
  })

  ipcMain.handle('discord:connect', async () => {
    try {
      if (client) {
        return { success: true, isConnected }
      }

      if (!settings.clientId?.trim() || !settings.clientSecret?.trim()) {
        console.error('Missing or empty client ID or secret')
        return {
          success: false,
          error: 'Missing or empty client ID or secret. Please configure them in settings.'
        }
      }

      client = new Client({
        clientId: settings.clientId.trim(),
        clientSecret: settings.clientSecret.trim(),
        transport: {
          type: 'ipc'
        },
        redirectUri: 'http://localhost:5173'
      })

      client.on('ready', async () => {
        console.log('Connected to Discord')
        isConnected = true
        mainWindow.webContents.send('discord:connection-change', isConnected)

        try {
          await client.subscribe('NOTIFICATION_CREATE')
          console.log('Subscribed to notifications')
        } catch (error) {
          console.error('Failed to subscribe to notifications', error)
        }

        try {
          const guilds = await client.user?.fetchGuilds()

          if (guilds) {
            for (const guild of guilds) {
              const channels = await client.user?.fetchChannels(guild.id)
              if (channels) {
                guildLookup.push({ name: guild.name, id: guild.id, channels: channels })
              }
            }
          }
          console.log('Guilds and channels fetched')
        } catch (error) {
          console.error('Failed to fetch guilds or channels', error)
        }
      })

      client.on('NOTIFICATION_CREATE', async (data) => {
        console.log('Notification received:', data)
        const notification = await processNotification(data)
        notifications.unshift(notification)

        if (notifications.length > MAX_NOTIFICATIONS) {
          notifications = notifications.slice(0, MAX_NOTIFICATIONS)
        }

        mainWindow.webContents.send('discord:notification', notification)
      })

      client.on('disconnect', () => {
        console.log('Disconnected from Discord')
        isConnected = false
        guildLookup = []
        mainWindow.webContents.send('discord:connection-change', isConnected)
      })

      await client.login({
        scopes: ['rpc', 'rpc.notifications.read', 'guilds', 'messages.read', 'rpc.voice.read'],
        prompt: 'none'
      })

      return { success: true, isConnected: true }
    } catch (error) {
      console.error('Failed to connect to Discord', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('discord:disconnect', async () => {
    try {
      if (client) {
        await client.destroy()
        client = null
        isConnected = false
        guildLookup = []
        mainWindow.webContents.send('discord:connection-change', isConnected)
      }
      return { success: true }
    } catch (error) {
      console.error('Error disconnecting from Discord', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('discord:get-notifications', () => {
    return notifications.slice(0, 20)
  })

  ipcMain.handle('discord:get-notifications-page', (_, { page, perPage }) => {
    const startIndex = 0
    const endIndex = page * perPage
    return {
      notifications: notifications.slice(startIndex, endIndex),
      hasMore: endIndex < notifications.length,
      total: notifications.length
    }
  })

  ipcMain.handle('discord:is-connected', () => {
    return isConnected
  })
}

/**
 * Processes a Discord notification and enriches it with AI features
 * @param {Object} data - Raw notification data from Discord
 * @returns {Promise<Object>} Processed notification with summaries and categories
 */
async function processNotification(data) {
  const serverInfo = getServerFromChannel(data.channel_id)
  const isUnknown = typeof serverInfo === 'string'
  const isDM = !serverInfo || serverInfo === 'Unknown Server'
  
  let summaryPending = false;
  let category = null;
  let importance = null;
  let eventDetails = null;
  
  // Add AI enrichment if enabled
  const openAIService = getOpenAIService();
  if (settings.enableSummarization && data.body && openAIService.isEnabled()) {
    try {
      // Extract event details for all messages
      eventDetails = await openAIService.extractEventDetails(data.body);
      if (eventDetails) {
        category = 'EVENT';
        importance = 'MEDIUM'; // Default importance for events
      }
      
      // For non-DM messages, also check other categories if no event was found
      if (!isDM && !eventDetails) {
        const categorization = await openAIService.categorizeMessage(data.body, isDM);
        if (categorization) {
          category = categorization.category;
          importance = categorization.importance;
        }
      }
      
      // Check if message needs summarization before setting the flag
      const needsSummary = await openAIService.shouldSummarize(data.body);
      if (needsSummary) {
        console.log('Generating summary for message:', data.body);
        summaryPending = true;
      }
    } catch (error) {
      console.error('Error in AI processing:', error);
    }
  }

  // Build message context for AI processing
  const context = {
    isDM,
    channel: isDM ? 'Direct Message' : serverInfo.channel,
    author: data.message.nick || 'Unknown User',
    recentMessages: []
  };
  
  // Construct the enriched notification object
  const notification = {
    id: data.message.id,
    title: data.title,
    body: data.body,
    summary: null,
    summaryPending: summaryPending,
    category,
    importance,
    eventDetails,
    icon: data.icon_url,
    timestamp: data.message.timestamp,
    serverName: isDM ? 'Direct Message' : (isUnknown ? 'Unknown Server' : serverInfo.server),
    channelName: isDM ? data.message.nick || 'DM' : (isUnknown ? '' : serverInfo.channel),
    serverId: isUnknown ? '' : serverInfo.serverid,
    channelId: data.channel_id,
    messageLink: isUnknown
      ? ''
      : `https://discord.com/channels/${isDM ? '@me' : serverInfo.serverid}/${data.channel_id}/${data.message.id}`,
    author: {
      name: data.message.nick || 'Unknown User',
      avatar: data.icon_url
    }
  }
  
  // Generate summary asynchronously if needed
  if (summaryPending) {
    generateMessageSummary(data.body, context).then(summary => {
      if (summary) {
        // Update notification in memory
        const index = notifications.findIndex(n => n.id === notification.id)
        if (index !== -1) {
          notifications[index].summary = summary
          notifications[index].summaryPending = false
        }
        
        // Notify renderer of summary update
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-update', { 
            id: notification.id, 
            summary 
          })
        }
      } else {
        // Handle failed summarization
        const index = notifications.findIndex(n => n.id === notification.id)
        if (index !== -1) {
          notifications[index].summaryPending = false
        }
        
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('discord:summary-update', { 
            id: notification.id, 
            summary: null,
            cancelled: true
          })
        }
      }
    }).catch(error => {
      console.error('Error generating summary asynchronously:', error)
      
      // Handle errors gracefully
      const index = notifications.findIndex(n => n.id === notification.id)
      if (index !== -1) {
        notifications[index].summaryPending = false
      }
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('discord:summary-update', { 
          id: notification.id, 
          summary: null,
          cancelled: true
        })
      }
    })
  }

  return notification
}

/**
 * Looks up server and channel information from a channel ID
 * @param {string} channelID - Discord channel ID
 * @returns {Object|string} Server info object or 'Unknown Server' if not found
 */
function getServerFromChannel(channelID) {
  for (const guild of guildLookup) {
    for (const channel of guild.channels) {
      if (channel.id === channelID) {
        return { server: guild.name, serverid: guild.id, channel: channel.name }
      }
    }
  }
  return 'Unknown Server'
}

/**
 * Creates a test notification for development and testing purposes
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function createTestNotification(mainWindow) {
  if (!mainWindow) return;

  // List of possible channels for test messages
  const testChannels = {
    teamChannels: [
      'team-announcements',
      'general',
      'project-updates',
      'dev-collaboration',
      'tech-discussion',
      'sprint-planning',
      'daily-standup',
      'code-reviews',
      'deployment',
      'design-discussion'
    ],
    socialChannels: [
      'random',
      'off-topic',
      'gaming',
      'events',
      'lunch-buddies',
      'watercooler',
      'celebrations',
      'music',
      'book-club',
      'pets'
    ],
    dmNames: [
      'John Smith',
      'Sarah Wilson',
      'Alex Chen',
      'Maria Garcia',
      'Team Lead',
      'Project Manager',
      'Design Lead',
      'Product Owner',
      'Tech Lead',
      'Mentor'
    ]
  };

  const testMessages = [
    // Messages with explicit date and time combinations
    {
      text: "Team meeting scheduled for {{DATE_PLACEHOLDER}} at {{TIME_PLACEHOLDER}} in Conference Room A"
    },
    {
      text: "Sprint planning will be held {{DATE_PLACEHOLDER}} starting at {{TIME_PLACEHOLDER}} via Zoom"
    },
    {
      text: "Project review meeting {{DATE_PLACEHOLDER}} {{TIME_PLACEHOLDER}} - virtual meeting room"
    },
    {
      text: "Reminder: Team sync {{DATE_PLACEHOLDER}} at {{TIME_PLACEHOLDER}} in the main conference room"
    },
    {
      text: "Mark your calendars - Company all-hands {{DATE_PLACEHOLDER}} {{TIME_PLACEHOLDER}} in the auditorium"
    },
    // More natural event mentions with explicit timing
    {
      text: "We're moving the daily standup to {{TIME_PLACEHOLDER}} starting {{DATE_PLACEHOLDER}}"
    },
    {
      text: "Client presentation scheduled for {{DATE_PLACEHOLDER}} at {{TIME_PLACEHOLDER}} - Conference Room B"
    },
    {
      text: "Don't forget - code freeze starts {{DATE_PLACEHOLDER}} at exactly {{TIME_PLACEHOLDER}}"
    },
    // Messages with both date/time and other content
    {
      text: "Hey team! Just a reminder about our workshop {{DATE_PLACEHOLDER}} at {{TIME_PLACEHOLDER}} in Room 401. Please review the materials I shared earlier."
    },
    {
      text: "Great progress everyone! For the next phase, we'll meet {{DATE_PLACEHOLDER}} at {{TIME_PLACEHOLDER}} to discuss implementation details. Meeting room TBD."
    },
    // Original test messages...
    {
      text: "Let's meet at {{TIME_PLACEHOLDER}} for the planning session (That's {{DATE_PLACEHOLDER}} EST)"
    },
    {
      text: "The deployment window is scheduled for {{TIME_PLACEHOLDER}} PST / {{TIME_PLACEHOLDER}} EST tomorrow"
    },
    {
      text: "Team sync moved to {{TIME_PLACEHOLDER}} (8AM Pacific)"
    },
    {
      text: "Project deadline is {{DATE_PLACEHOLDER}} - all commits must be in by {{TIME_PLACEHOLDER}} EST"
    },
    // International time coordination
    {
      text: "Global team meeting next Tuesday at 15:00 UTC (10AM EST / 7AM PST / 23:00 JST)"
    },
    {
      text: "Release party happening {{TIME_PLACEHOLDER}}! 🎉 Join us across all timezones!"
    },
    // Relative time references
    {
      text: "Emergency hotfix needed, on-call team please respond within the next 2 hours {{TIME_PLACEHOLDER}}"
    },
    {
      text: "Server maintenance starting {{TIME_PLACEHOLDER}} (will last approximately 3 hours)"
    },
    // Mixed timezone and regular messages
    {
      text: "Quick heads up - I'll be presenting at {{TIME_PLACEHOLDER}} PT / {{TIME_PLACEHOLDER}} ET. The recording will be available for those who can't make it."
    },
    {
      text: "Just pushed a critical update. Please test before {{TIME_PLACEHOLDER}} in your local timezone."
    },
    // Original messages with some converted to use Discord timestamps
    {
      text: "Hey! We should catch up soon, it's been ages!"
    },
    {
      text: "The API is throwing some weird errors. Could we jump on a call {{TIME_PLACEHOLDER}}?"
    },
    {
      text: "Thanks for the great work yesterday! By the way, we're planning to roll out the changes {{TIME_PLACEHOLDER}}. Keep an eye out for any issues."
    },
    {
      text: "Just finished the documentation. Also, don't forget we have that important deadline coming up on {{DATE_PLACEHOLDER}}."
    },
    {
      text: "The build is taking longer than usual. Give it another 30 minutes before checking."
    },
    {
      text: "Anyone up for lunch? Thinking about trying that new place around the corner."
    },
    {
      text: "Heads up: We're migrating the database this weekend. Expect some downtime between {{TIME_PLACEHOLDER}} and {{TIME_PLACEHOLDER}}. I'll share the detailed schedule in the migration doc later today."
    },
    // New super long messages
    {
      text: "🚨 **URGENT PRODUCTION ISSUE** 🚨\n\nWe're experiencing critical failures in the payment processing system affecting approximately 43% of transactions. The error logs show timeout exceptions when connecting to the payment gateway. Initial investigation suggests this might be related to the network configuration changes deployed yesterday at {{TIME_PLACEHOLDER}}.\n\nSteps taken so far:\n1. Rolled back the recent API gateway changes\n2. Increased timeout thresholds from 30s to 60s\n3. Rerouted traffic through backup servers\n4. Contacted payment provider support (ticket #38291)\n\nCurrent status: Partial mitigation, but still seeing ~15% failure rate. We need all hands on deck to resolve this before the daily transaction peak at {{TIME_PLACEHOLDER}}. I've set up a war room in the emergency-incidents channel. Please join if you have experience with the payment stack or network infrastructure.\n\nExpected impact: ~$240k in delayed transactions per hour if not resolved.\n\nUpdates will be posted every 30 minutes in the #incident-updates channel."
    },
    {
      text: "📋 **Sprint 34 Planning Notes - PLEASE REVIEW**\n\nHi team,\n\nHere are the comprehensive notes from yesterday's 3-hour planning session. Please review and comment with any corrections or additions by {{TIME_PLACEHOLDER}} tomorrow.\n\n**Sprint Goals:**\n- Complete user authentication refactoring (Priority 1)\n- Implement 80% of the new analytics dashboard features (Priority 2)\n- Begin infrastructure migration to K8s (Priority 3)\n\n**Capacity Planning:**\n- Team velocity: 89 points (3-sprint average)\n- Available team members: 8.5 (Susan at 50% due to conference)\n- Adjusted capacity: 78 points\n\n**Risk Assessment:**\n1. The auth refactoring touches 47 services - we need comprehensive testing\n2. AWS has announced potential maintenance in our region during this sprint\n3. Three team members will be OOO during different parts of the sprint\n\n**Dependency Mapping:**\n- Analytics dashboard blocked by data pipeline enhancement (Team Bravo)\n- Mobile app updates waiting on our authentication endpoints\n- Release timeline coordination needed with Marketing for the announcement\n\n**Detailed Task Breakdown:**\n- AUTH-423: JWT implementation - 13pts - Alex\n- AUTH-424: SSO integration - 8pts - Maria\n- AUTH-425: Legacy system migration - 21pts - David & Sarah\n- DASH-512: Metrics visualization - 8pts - Tom\n- DASH-513: Custom reports - 13pts - Jessica\n- DASH-514: Export functionality - 5pts - Open\n- INFRA-289: K8s initial setup - 8pts - Michael\n- INFRA-290: CI pipeline adaptation - 5pts - Michael\n\n**Upcoming Deadlines:**\n- QA environment ready by {{DATE_PLACEHOLDER}}\n- Beta testing starts {{DATE_PLACEHOLDER}}\n- Production release scheduled for {{DATE_PLACEHOLDER}}\n\nPlease make sure to update your tasks in Jira and join the daily standup at {{TIME_PLACEHOLDER}} sharp. Let me know if you have any questions or concerns."
    },
    {
      text: "Hey everyone! I've just completed a comprehensive analysis of our application performance over the last quarter, and I wanted to share some findings that might help us optimize our codebase. The main issue seems to be excessive database queries in the user dashboard - each page load triggers approximately 32 separate queries, many of which could be combined or cached.\n\nI've created a detailed report with flame graphs and DB query execution plans in the shared drive. The most critical issues appear in the following components:\n\n1. UserProfileController.js - Line 237-419: The recursive fetching of user relationships is causing n+1 query problems\n2. DashboardService.ts - The getRecentActivities() method is being called multiple times with different date parameters instead of using a single query with BETWEEN\n3. NotificationManager.js - We're querying for unread notifications on every component mount rather than using a global store\n\nI've submitted PR #3872 with fixes for the first issue, reducing load times by 47% in my local testing. I'd appreciate reviews from the backend team by {{TIME_PLACEHOLDER}} tomorrow so we can get this merged before the release freeze.\n\nAdditionally, I've scheduled a performance optimization workshop for {{DATE_PLACEHOLDER}} at {{TIME_PLACEHOLDER}} to walk through these patterns and establish better practices for future development. If you're working on user-facing features, please try to attend or watch the recording which will be available afterwards.\n\nLet me know if you have any questions or need clarification on any of the points in the report! I'm available for pair programming sessions this week if anyone wants to tackle their component's performance issues together."
    },
    {
      text: "Good morning team! Just a quick reminder that the annual company picnic is scheduled for {{DATE_PLACEHOLDER}} at Washington Park, starting around {{TIME_PLACEHOLDER}}. The weather forecast looks perfect - sunny and 75°F. Please RSVP through the link in your email by tomorrow EOD so we can finalize the catering order. Feel free to bring family members! There will be activities for kids, a volleyball tournament, and the CEO mentioned something about a surprise announcement. Don't forget sunscreen!"
    },
    {
      text: "**Technical Architecture Decision: Moving from REST to GraphQL**\n\nAfter extensive analysis and prototype testing over the past 3 months, we've made the decision to gradually migrate our API layer from REST to GraphQL. I want to explain the reasoning, implementation strategy, and timeline to ensure everyone understands this significant architectural shift.\n\n**Why GraphQL?**\n- Our client applications currently make 15-20 API calls per view to assemble the required data\n- Mobile apps are suffering from overfetching, which impacts performance on slower networks\n- Front-end teams are spending ~30% of development time just managing API data fetching logistics\n- Analytics show users experiencing 3-5 second delays during navigation due to waterfall API requests\n\n**Implementation Approach:**\n1. We'll introduce a GraphQL gateway layer that sits in front of existing REST services (no need to rewrite everything at once)\n2. Phase 1: User profile, notifications, and activity feed endpoints will be migrated first (starting {{DATE_PLACEHOLDER}})\n3. Phase 2: Transaction history and dashboard metrics (projected for {{DATE_PLACEHOLDER}})\n4. Phase 3: Content management and admin functionality\n5. Phase 4: Full migration completion and legacy REST endpoint deprecation\n\n**Technical Stack:**\n- Apollo Server for the GraphQL implementation\n- DataLoader for efficient batching and caching\n- Persistent queries to minimize request sizes\n- Automatic schema generation from TypeScript interfaces where possible\n\n**Expected Benefits:**\n- 40-60% reduction in HTTP requests from client applications\n- Estimated 30% improvement in initial load time for complex views\n- Better developer experience through typed schemas and self-documenting API\n- More efficient network usage for mobile users (particularly important for international markets)\n\n**Potential Risks and Mitigations:**\n- Learning curve: We'll run 4 training sessions starting {{DATE_PLACEHOLDER}} at {{TIME_PLACEHOLDER}}\n- Performance monitoring: New dashboards are being created to track resolver execution times\n- Schema design: Created a review process to ensure we don't create performance bottlenecks\n\n**Next Steps:**\n1. Please review the detailed RFC document in the architecture folder by {{DATE_PLACEHOLDER}}\n2. Sign up for one of the training sessions (calendar invites sent separately)\n3. Front-end teams: Start exploring Apollo Client documentation to prepare for integration\n\nI've scheduled a Q&A session for {{TIME_PLACEHOLDER}} next Monday to address any concerns or technical questions. This is an exciting change that should significantly improve both our developer experience and end-user performance!"
    }
  ];

  // Helper function to format date in a human-readable way
  const formatHumanReadableDate = (date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatHumanReadableTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Helper function to generate Discord timestamp format
  const generateDiscordTimestamp = (date, format = 'F') => {
    return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
  };

  // Helper function to generate a random future date
  const getRandomFutureDate = (minHours = 1, maxDays = 14) => {
    const now = new Date();
    const futureTime = now.getTime() + 
      (minHours * 3600000) + 
      (Math.random() * (maxDays * 24 - minHours) * 3600000);
    return new Date(futureTime);
  };

  // Helper function to generate a test Discord message link
  const generateTestMessageLink = (serverId, channelId, messageId) => {
    if (serverId === 'dm') {
      return `https://discord.com/channels/@me/${channelId}/${messageId}`;
    }
    return `https://discord.com/channels/${serverId}/${channelId}/${messageId}`;
  };

  const randomIndex = Math.floor(Math.random() * testMessages.length);
  let testMessage = testMessages[randomIndex];
  
  // Replace timestamp placeholders with actual Discord timestamps and human-readable dates
  if (testMessage.text.includes('{{TIME_PLACEHOLDER}}') || testMessage.text.includes('{{DATE_PLACEHOLDER}}')) {
    let modifiedText = testMessage.text;
    let eventDate, eventTime;
    
    // Replace all time placeholders with both Discord timestamp and human-readable time
    while (modifiedText.includes('{{TIME_PLACEHOLDER}}')) {
      const futureDate = getRandomFutureDate();
      const timestamp = generateDiscordTimestamp(futureDate, 't');
      const humanTime = formatHumanReadableTime(futureDate);
      modifiedText = modifiedText.replace('{{TIME_PLACEHOLDER}}', `${timestamp} (${humanTime})`);
      
      // Store the first time for event details
      if (!eventTime) {
        eventTime = `${futureDate.getHours().toString().padStart(2, '0')}:${futureDate.getMinutes().toString().padStart(2, '0')}`;
      }
    }
    
    // Replace all date placeholders with both Discord timestamp and human-readable date
    while (modifiedText.includes('{{DATE_PLACEHOLDER}}')) {
      const futureDate = getRandomFutureDate(24, 30);
      const timestamp = generateDiscordTimestamp(futureDate, 'D');
      const humanDate = formatHumanReadableDate(futureDate);
      modifiedText = modifiedText.replace('{{DATE_PLACEHOLDER}}', `${timestamp} (${humanDate})`);
      
      // Store the first date for event details
      if (!eventDate) {
        eventDate = futureDate.toISOString().split('T')[0];
      }
    }
    
    testMessage = { ...testMessage, text: modifiedText };
    
    // Add event details for messages that contain both date and time
    if (eventDate && eventTime) {
      testMessage.eventDetails = {
        hasEvent: true,
        title: testMessage.text.split('\n')[0].substring(0, 50),
        date: eventDate,
        time: eventTime,
        description: testMessage.text,
        location: testMessage.text.match(/\b(?:in|at|@)\s+(.*?(?:Room|Conference|Hall|Building|Virtual|Zoom|Teams|Meet|Office|Center).*?)(?=[,.!?]|$)/i)?.[1] || null
      };
    }
  }
  
  // Randomly determine if the message should be a DM
  const isDM = Math.random() < 0.3; // 30% chance of being a DM
  
  // Randomly select a channel based on isDM and message content
  let channelName;
  let serverId = `test-server-${Date.now()}`;
  let channelId = `test-channel-${Date.now()}`;
  let messageId = `test-message-${Date.now()}`;
  
  if (isDM) {
    channelName = testChannels.dmNames[Math.floor(Math.random() * testChannels.dmNames.length)];
    serverId = 'dm';
  } else {
    const isTeamRelated = /meeting|review|sprint|standup|project|code|deploy|tech|demo/.test(testMessage.text.toLowerCase());
    const channelList = isTeamRelated ? testChannels.teamChannels : testChannels.socialChannels;
    channelName = channelList[Math.floor(Math.random() * channelList.length)];
  }

  const mockNotification = {
    message: {
      id: messageId,
      nick: isDM ? channelName : "Test User",
      timestamp: new Date().toISOString()
    },
    title: isDM ? `Message from ${channelName}` : `New message in #${channelName}`,
    body: testMessage.text,
    icon_url: "https://cdn.discordapp.com/embed/avatars/0.png",
    channel_id: channelId,
    guild: isDM ? null : {
      id: serverId,
      name: "Test Server"
    },
    channel: {
      id: channelId,
      name: channelName
    }
  };

  // Create a basic notification object to display immediately
  const basicNotification = {
    id: mockNotification.message.id,
    title: mockNotification.title,
    body: mockNotification.body,
    summary: null,
    summaryPending: false,
    category: null,
    importance: null,
    eventDetails: testMessage.eventDetails || null,
    icon: mockNotification.icon_url,
    timestamp: mockNotification.message.timestamp,
    serverName: isDM ? 'Direct Message' : 'Test Server',
    channelName: isDM ? mockNotification.message.nick || 'DM' : mockNotification.channel.name,
    serverId: isDM ? '' : mockNotification.guild.id,
    channelId: mockNotification.channel_id,
    messageLink: generateTestMessageLink(serverId, channelId, messageId),
    author: {
      name: mockNotification.message.nick || 'Test User',
      avatar: mockNotification.icon_url
    }
  };

  // Debug logs
  console.log('Creating test notification:', {
    hasEventDetails: !!testMessage.eventDetails,
    eventDetails: testMessage.eventDetails,
    messageHasDateAndTime: testMessage.text.includes('{{DATE_PLACEHOLDER}}') && testMessage.text.includes('{{TIME_PLACEHOLDER}}'),
    finalNotification: basicNotification
  });

  // Add the notification to our storage
  notifications.unshift(basicNotification);
  
  // Send the notification immediately to the frontend
  mainWindow.webContents.send('discord:notification', basicNotification);
  
  // Process the notification with AI features asynchronously
  processNotification(mockNotification).then(enhancedNotification => {
    // Find and update the notification in our storage
    const index = notifications.findIndex(n => n.id === basicNotification.id);
    if (index !== -1) {
      notifications[index] = enhancedNotification;
      
      // Send update for category, importance, and summaryPending status
      mainWindow.webContents.send('discord:notification-update', {
        id: enhancedNotification.id,
        category: enhancedNotification.category,
        importance: enhancedNotification.importance,
        summaryPending: enhancedNotification.summaryPending
      });
    }
    
    // Note: The summary updates are already handled by the processNotification function
  });
}

/**
 * Test notification service for development and debugging purposes.
 * Provides functionality to create test notifications with event information.
 */

/**
 * Creates a test notification for development and testing purposes
 * @param {BrowserWindow} mainWindow - The main application window
 * @param {Function} processNotification - Function to process notifications with AI features
 * @param {Array} notifications - Array to store notifications
 * @returns {Object} The created notification object
 */
export function createTestNotification(mainWindow, processNotification, notifications) {
  console.log('Creating test notification')
  if (!mainWindow) return;

  // Generate a tomorrow's date for testing
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Generate a specific time for testing
  const testHour = Math.floor(Math.random() * 12) + 9; // Random hour between 9AM-8PM
  const testMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, or 45 minutes
  const testTime = `${testHour}:${testMinute.toString().padStart(2, '0')}`;
  
  // Generate next week date for longer-term events
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  
  // Create various messages with different event types for comprehensive testing
  const testMessages = [
    {
      // Standard meeting notification (HIGH)
      text: `@everyone **🔥 Team Meeting Tomorrow!**
Time: ${tomorrowStr} at ${testTime}
> 📋 Agenda:
> • Project roadmap review
> • Sprint goals discussion
> • Upcoming deadlines
      
📍 Join here: <#${channelId}> or https://discord.gg/meeting-room
*Don't forget to update your status reports in* <#${channelId}-updates>`,
      nick: 'Project Lead',
      channel: 'team-meetings',
      server: 'Project HQ'
    },
    {
      // Multi-day event (MEDIUM)
      text: `<@&dev-team> :tada: **DevCon 2024 is Here!** :tada:

:calendar_spiral: **When:** ${tomorrowStr} - ${nextWeekStr}
:clock1: **Daily Schedule:** 09:00 - 17:00
:link: **Join:** discord.gg/devcon-2024

*Use </join-event:1234567890> to RSVP and get your role!*

> *"Level up your dev skills with amazing workshops and talks!"*`,
      nick: 'Event Bot',
      channel: 'events',
      server: 'Dev Community'
    },
    {
      // Short notice urgent meeting (HIGH)
      text: `@here :warning: **URGENT SECURITY PATCH REVIEW** :warning:

Meeting in <t:${Math.floor(Date.now()/1000) + 1800}:R>
:red_circle: **All senior devs required**

*Jump in the voice channel:* 🔐│security-team
||Emergency contact: <@123456789> if you can't join||`,
      nick: 'Security Bot',
      channel: 'security-alerts',
      server: 'Tech Ops'
    },
    {
      // Recurring event (MEDIUM)
      text: `:arrows_counterclockwise: **Weekly Sprint Planning**
<t:${Math.floor(new Date(tomorrowStr).getTime()/1000)}:F>

:pushpin: **Focus:** Q1 Goals
:microphone2: **Where:** <#${channelId}-standup>

*Use </update-status:1234567890> before the meeting!*
      
*Reminder: Keep your cameras on* :wave:`,
      nick: 'Scrum Bot',
      channel: 'team-sync',
      server: 'Agile Squad'
    },
    {
      // Social event (CASUAL)
      text: `:video_game: **GAME NIGHT HYPE!** :video_game:
      
:calendar: <t:${Math.floor(new Date(nextWeekStr).getTime()/1000) + 66600}:F>
:map: **Location:** GameHub Discord Server

:game_die: **Games:**
• Among Us
• Jackbox Party Pack
• Gartic Phone

*React with :thumbsup: to join!*
||Free pizza for the winners :pizza:||`,
      nick: 'Party Bot',
      channel: 'gaming',
      server: 'Team Hangout'
    },
    {
      // Technical question (MEDIUM)
      text: `Hey devs! :wave:
Getting this weird error with auth:
\`\`\`
TypeError: Cannot read properties of undefined (reading 'token')
\`\`\`
Anyone free for a quick call in <#${channelId}-help> ${testTime}? Been stuck on this for hours :sob:

*Using latest auth package from #resources*`,
      nick: 'New Dev',
      channel: 'help-needed',
      server: 'Code Hub'
    },
    {
      // Casual question (LOW)
      text: `yo anyone else's prettier acting weird with the new update? :thinking:
keeps formatting my code like:
\`\`\`js
const   wat    =    'why'
\`\`\`
:rofl:`,
      nick: 'confused-dev',
      channel: 'random',
      server: 'Dev Chat'
    },
    {
      // Non-event message (LOW)
      text: `:white_check_mark: **Main branch updated**
\`\`\`diff
+ Added user profiles
+ Fixed login bugs
- Removed legacy code
\`\`\`
*CI Status:* All tests passing :test_tube:
https://github.com/org/repo/pull/123`,
      nick: 'GitHub Bot',
      channel: 'git-logs',
      server: 'Dev Ops'
    },
    {
      // Mixed content with multiple dates (MEDIUM)
      text: `**:rocket: Release v2.0 Timeline**

:one: Code Freeze: <t:${Math.floor(new Date(tomorrowStr).getTime()/1000) + 54000}:F>
:two: QA Testing: <t:${Math.floor(new Date(nextWeekStr).getTime()/1000) + 32400}:F>
:three: Release Meeting: <t:${Math.floor(new Date(tomorrowStr).getTime()/1000) + (testHour * 3600 + testMinute * 60)}:F>

*Add these to your calendar using </schedule:1234567890>*
||@qa-team please update your availability||`,
      nick: 'Release Bot',
      channel: 'releases',
      server: 'Product Team'
    },
    {
      // Optional training event (MEDIUM)
      text: `:books: **TypeScript Workshop** :books:

Learn advanced TS features with <@seniordev>!
<t:${Math.floor(new Date(tomorrowStr).getTime()/1000) + 50400}:F>

**Topics:**
> • Generics :brain:
> • Utility Types :wrench:
> • Advanced Patterns :rocket:

*React with :nerd: to get the workshop role*
*Workshop materials will be shared in* <#${channelId}-resources>`,
      nick: 'Learning Bot',
      channel: 'training',
      server: 'TypeScript Community'
    },
    {
      // Casual team sync (LOW)
      text: `:coffee: **Coffee & Code Chat** :cookie:

Hanging out in the break room tomorrow <t:${Math.floor(new Date(tomorrowStr).getTime()/1000) + (testHour * 3600 + testMinute * 60)}:R>!

*Bring your bugs, bring your wins, bring your appetite* :yum:
||I heard <@someone> is bringing their famous brownies :eyes:||`,
      nick: 'Team Mom',
      channel: 'watercooler',
      server: 'Coders Lounge'
    },
    {
      // General announcement (LOW)
      text: `**:notebook_with_decorative_cover: Wiki Update!**

Added new sections:
:small_blue_diamond: Code Style Guide
:small_blue_diamond: PR Templates
:small_blue_diamond: Testing Best Practices

*Check it out when you can:* https://wiki.company.com/standards
*Use </feedback:1234567890> for suggestions*`,
      nick: 'Wiki Bot',
      channel: 'announcements',
      server: 'Dev Resources'
    },
    {
      // Question with potential meeting (MEDIUM)
      text: `**:api: API Integration Issues**

Anyone dealt with these timeouts? :sob:
\`\`\`
Request failed: ETIMEOUT
Endpoint: /api/v2/users
\`\`\`

Could use some help! Free for a call ${tomorrowStr} around ${testTime}?
*Currently in* :speaker: debug-room if anyone's free now!`,
      nick: 'API Warrior',
      channel: 'backend-help',
      server: 'Backend Gang'
    },
    {
      // Comprehensive announcement (MEDIUM)
      text: `@everyone **:tada: Welcome to our New Community Update!** :tada:

:wave: A warm welcome to our newest <@&representative> and <@&creator-rep> members, and welcome back to all current Representatives!

:sparkles: **Major Announcements** :sparkles:
We're excited to introduce our newest department <@&community-relations> who will be improving communication between staff and all communities!

:question: **Frequently Asked Questions** :question:

**Q: Do we need to reapply annually for DevFest?**
:white_check_mark: Once accepted, you're automatically included for future DevFest booth submissions
:warning: *Note: This doesn't apply to TechCon or other special events requiring separate applications*

**Q: I'm a New/Returning Representative - How do I submit a booth?**
:book: Check our new documentation portal for comprehensive guides!

**Booth Submission Options:**
:one: **Template Booth:** Use our Web Booth Creator for image-based showcases
:two: **Custom Booth:** Submit via SDK
> • Add to your Developer Tools
> • Download manually: <https://dev-tools.example.com/sdk>

**Q: Need an Access Code?**
:envelope: We'll DM codes soon! Meanwhile:
• Previous submitters can log in normally
• Haven't received a code in 2 weeks? Ask in <#${channelId}-booth-help>
*Include your Community/Creator name from your application*

**:calendar: Important Dates**
:pushpin: **Booth Submissions Deadline:** <t:${Math.floor(new Date(nextWeekStr).getTime()/1000)}:F>

**:film_frames: Media Submissions**
• Submission form coming soon
• Watch for pings in <#${channelId}-announcements>

**:world_map: Multiple Showcase Worlds**
:white_check_mark: Yes! Separate worlds for:
• Communities
• Individual Creators

*More details: <https://docs.example.com/community-vs-creator>*

**:handshake: Collaboration Policy**
:x: No collaborative booths this year
:white_check_mark: You may display partner logos
:no_entry: No group codes or external links

||*Please react with :eyes: to confirm you've read this update*||

*For additional questions, visit <#${channelId}-help> or contact a <@&community-manager>*

:link: **Useful Links:**
• Documentation: <https://docs.example.com>
• Submission Portal: <https://submit.example.com>
• Guidelines: <https://guidelines.example.com>`,
      nick: 'Community Team',
      channel: 'important-updates',
      server: 'Developer Community'
    }
  ];
  
  // Select a random test message to use
  const randomIndex = Math.floor(Math.random() * testMessages.length);
  const selectedTest = testMessages[randomIndex];
  const eventTestMessage = {
    text: selectedTest.text
  };
  
  // Use this message for the test notification
  let messageId = `test-message-${Date.now()}`;
  let channelId = `test-channel-${Date.now()}`;
  let serverId = `test-server-${Date.now()}`;
  const channelName = selectedTest.channel;

  // Create the mock notification
  const mockNotification = {
    message: {
      id: messageId,
      nick: selectedTest.nick,
      timestamp: new Date().toISOString()
    },
    title: `New message in #${channelName}`,
    body: eventTestMessage.text,
    icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    channel_id: channelId,
    guild: {
      id: serverId,
      name: selectedTest.server
    },
    channel: {
      id: channelId,
      name: channelName
    }
  };

  // Create basic notification with explicitly false summaryPending
  const basicNotification = {
    id: mockNotification.message.id,
    title: mockNotification.title,
    body: mockNotification.body,
    summary: null,
    summaryPending: false, // Explicitly not pending initially
    categoryPending: true,
    eventPending: true,
    category: null,
    importance: null,
    eventDetails: null,
    icon: mockNotification.icon_url,
    timestamp: mockNotification.message.timestamp,
    serverName: selectedTest.server,
    channelName: mockNotification.channel.name,
    serverId: mockNotification.guild.id,
    channelId: mockNotification.channel_id,
    messageLink: `https://discord.com/channels/${serverId}/${channelId}/${messageId}`,
    author: {
      name: mockNotification.message.nick || 'Test User',
      avatar: mockNotification.icon_url
    }
  };

  console.log('Created test notification with event content:', {
    message: basicNotification.body,
    date: tomorrowStr,
    time: testTime
  });

  // Add the notification to our storage
  notifications.unshift(basicNotification);

  // Send the notification immediately to the frontend
  mainWindow.webContents.send('discord:notification', basicNotification);

  // Process the notification with AI features through the normal pipeline
  processNotification(mockNotification).then((enhancedNotification) => {
    // Find and update the notification in our storage
    const index = notifications.findIndex((n) => n.id === basicNotification.id);
    if (index !== -1) {
      // Make a complete copy for the update to avoid partial updates
      notifications[index] = {
        ...basicNotification,
        ...enhancedNotification,
        // Ensure these fields are explicitly set with the right boolean values
        summaryPending: enhancedNotification.summaryPending === true,
        categoryPending: enhancedNotification.categoryPending === true,
        eventPending: enhancedNotification.eventPending === true
      };

      // Send update with explicit boolean values
      mainWindow.webContents.send('discord:notification-update', {
        id: enhancedNotification.id,
        category: enhancedNotification.category,
        importance: enhancedNotification.importance,
        summaryPending: enhancedNotification.summaryPending === true,
        eventDetails: enhancedNotification.eventDetails,
        // Add debug info
        debug: 'Test notification update'
      });
      
      // Debug log to confirm if event details were extracted
      console.log('Test notification processed with AI extraction:', {
        hasEventDetails: !!enhancedNotification.eventDetails,
        eventDetails: enhancedNotification.eventDetails
      });
    }
  });

  console.log('Test notification created');
  return basicNotification;
}

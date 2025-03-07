import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'

// Default model to use for summaries
const DEFAULT_MODEL = 'gpt-4o-mini'

/**
 * Converts Discord timestamp format <t:timestamp:format> to human-readable text
 * @param {string} text - Text that may contain Discord timestamp markup
 * @returns {string} Text with Discord timestamps converted to human-readable format
 */
function convertDiscordTimestampsToText(text) {
  if (!text) return text;
  
  // Discord timestamp format: <t:1234567890:F> (or t, R, D, etc.)
  // Regex to match Discord timestamp format
  const discordTimestampRegex = /<t:(\d+):[A-Za-z]>/g;
  
  return text.replace(discordTimestampRegex, (match, timestamp) => {
    try {
      const date = new Date(parseInt(timestamp) * 1000);
      return date.toLocaleString();
    } catch (e) {
      console.error('Error converting Discord timestamp:', e);
      return match; // Return original if conversion fails
    }
  });
}

/**
 * Service for handling AI-powered message processing using OpenAI or compatible APIs.
 * Supports summarization, categorization, and smart detection of message importance.
 */
export class OpenAIService {
  /**
   * Creates a new OpenAIService instance
   * @param {Object} settings - Configuration settings
   * @param {string} settings.openaiApiKey - API key for authentication (optional for some endpoints)
   * @param {string} settings.openaiApiEndpoint - Base URL for API endpoint
   * @param {boolean} settings.enableSummarization - Whether to enable AI summarization
   * @param {string} settings.summaryDetectionMode - Method to determine if summarization is needed ('length' or 'smart')
   * @param {number} settings.minLengthForSummary - Minimum character length for summarization in length mode
   */
  constructor(settings = {}) {
    this.apiKey = settings.openaiApiKey || ''
    this.apiEndpoint = settings.openaiApiEndpoint || 'https://api.openai.com/v1'
    this.enabled = settings.enableSummarization || false
    this.detectionMode = settings.summaryDetectionMode || 'length'
    this.minLength = settings.minLengthForSummary || 100
    this.model = settings.model || DEFAULT_MODEL
  }

  /**
   * Updates service settings without requiring a new instance
   * @param {Object} settings - New settings to apply
   */
  updateSettings(settings = {}) {
    this.apiKey = settings.openaiApiKey || this.apiKey
    this.apiEndpoint = settings.openaiApiEndpoint || this.apiEndpoint
    this.enabled = settings.enableSummarization !== undefined ? settings.enableSummarization : this.enabled
    this.detectionMode = settings.summaryDetectionMode || this.detectionMode
    this.minLength = settings.minLengthForSummary || this.minLength
    this.model = settings.model || this.model
  }

  /**
   * Checks if the AI service is properly configured and enabled
   * @returns {boolean} True if ready to use, false otherwise
   */
  isEnabled() {
    return this.enabled && this.apiEndpoint && this.apiEndpoint.trim() !== '';
  }

  /**
   * Determines if a message needs AI summarization based on configuration
   * @param {string} messageContent - The message to evaluate
   * @returns {Promise<boolean>} True if summarization is needed
   */
  async shouldSummarize(messageContent) {
    if (!this.isEnabled() || !messageContent || messageContent.trim() === '') {
      return false;
    }

    if (this.detectionMode === 'length') {
      return messageContent.length >= this.minLength;
    }

    if (this.detectionMode === 'smart') {
      try {
        return await this.checkSummarizationNeed(messageContent);
      } catch (error) {
        console.error('Error checking if message needs summarization:', error);
        return messageContent.length >= this.minLength;
      }
    }

    return messageContent.length >= this.minLength;
  }

  /**
   * Uses AI to determine if a message needs summarization based on content and context
   * @param {string} messageContent - The message to evaluate
   * @returns {Promise<boolean>} True if AI determines summarization would be helpful
   */
  async checkSummarizationNeed(messageContent) {
    try {
      const endpoint = `${this.apiEndpoint.replace(/\/+$/, '')}/chat/completions`;

      // Convert any Discord timestamps to human-readable text
      const humanReadableMessage = convertDiscordTimestampsToText(messageContent);

      const prompt = `Analyze the following Discord message and determine if it needs summarization.
Message: "${humanReadableMessage}"

A message needs summarization if:
1. It's information-dense with multiple points
2. It's long or complex
3. It contains announcements or important information

A message does NOT need summarization if:
1. It's a simple greeting
2. It's very short
3. It's a personal/private message
4. It's just small talk
5. It's just an emoji or sticker

Respond with ONLY "YES" or "NO" - should this message be summarized?`;

      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey && this.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that determines if Discord messages need summarization.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 5,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        console.error('LLM API error when checking for summarization need');
        return messageContent.length >= this.minLength;
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const answer = data.choices[0].message.content.trim().toUpperCase();
        return answer === 'YES';
      }

      return messageContent.length >= this.minLength;
    } catch (error) {
      console.error('Error in checkSummarizationNeed:', error);
      return messageContent.length >= this.minLength;
    }
  }

  /**
   * Generates a concise summary of a Discord message using AI
   * @param {string} messageContent - The message to summarize
   * @param {Object} context - Additional context about the message
   * @param {string} context.channel - The channel name
   * @param {string} context.author - The message author
   * @param {Array} context.recentMessages - Recent messages in the conversation
   * @param {boolean} context.isDM - Whether this is a direct message
   * @returns {Promise<string|null>} The generated summary or null if unavailable
   */
  async summarizeMessage(messageContent, context = {}) {
    if (!this.enabled || !messageContent || messageContent.trim() === '') {
      return null;
    }

    const needsSummary = await this.shouldSummarize(messageContent);
    if (!needsSummary) {
      return null;
    }

    try {
      const endpoint = `${this.apiEndpoint.replace(/\/+$/, '')}/chat/completions`;

      // Convert any Discord timestamps to human-readable text
      const humanReadableMessage = convertDiscordTimestampsToText(messageContent);

      let systemPrompt = `You are a helpful assistant that summarizes Discord messages in a brief and concise way.
You understand conversation context and Discord's communication style.
Consider the following context when analyzing messages:`;

      if (context.channel) systemPrompt += `\n- Channel: ${context.channel}`;
      if (context.author) systemPrompt += `\n- Author: ${context.author}`;
      if (context.recentMessages) {
        systemPrompt += `\n- Recent conversation context:\n${context.recentMessages.map(m => `  ${m.author}: ${m.content}`).join('\n')}`;
      }
      if (context.isDM) systemPrompt += `\n- This is a direct message conversation`;

      const prompt = `Please provide a brief, concise summary (1-2 sentences) of the following Discord message${context.isDM ? ' from this DM conversation' : ''}: "${humanReadableMessage}"`;

      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey && this.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const error = await response.json()
        console.error('LLM API error:', error)
        return null
      }

      const data = await response.json()
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return data.choices[0].message.content.trim()
      }

      return null
    } catch (error) {
      console.error('Failed to generate summary:', error)
      return null
    }
  }

  /**
   * Analyzes a message to determine its category and importance level
   * @param {string} messageContent - The message to categorize
   * @param {boolean} isDM - Whether this is a direct message
   * @returns {Promise<Object|null>} Categorization result with category and importance, or null
   */
  async categorizeMessage(messageContent, isDM = false) {
    if (isDM) {
      return null;
    }

    if (!this.enabled || !messageContent || messageContent.trim() === '') {
      return null;
    }

    try {
      const endpoint = `${this.apiEndpoint.replace(/\/+$/, '')}/chat/completions`;

      // Convert any Discord timestamps to human-readable text
      const humanReadableMessage = convertDiscordTimestampsToText(messageContent);

      // Define the analysis prompt with clear criteria
      const prompt = `Analyze the following Discord message and categorize it:
Message: "${humanReadableMessage}"

Respond in JSON format with two fields:
1. "category" - One of: "EVENT" (meetings, planning, scheduling), "QUESTION" (help requests, inquiries), "ANNOUNCEMENT" (important updates), or "CASUAL" (general chat, social)
2. "importance" - One of: "HIGH", "MEDIUM", "LOW"

Base the importance on:
- HIGH: Critical announcements, time-sensitive events, urgent questions
- MEDIUM: Regular updates, general questions, upcoming events
- LOW: Casual conversation, social chat`;

      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey && this.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that categorizes Discord messages. You understand the context and flow of Discord conversations. Respond only with the requested JSON format.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        console.error('LLM API error when categorizing message');
        return null;
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        try {
          const categorization = JSON.parse(data.choices[0].message.content.trim());

          if (categorization.category && categorization.importance) {
            return categorization;
          }
        } catch (parseError) {
          console.error('Error parsing categorization response:', parseError);
        }
      }

      return null;
    } catch (error) {
      console.error('Error in categorizeMessage:', error);
      return null;
    }
  }

  /**
   * Validates extracted event details to ensure they are complete and make sense
   * @param {Object} eventDetails - The event details to validate
   * @returns {boolean} True if the event details are valid
   */
  validateEventDetails(eventDetails) {
    if (!eventDetails || !eventDetails.hasEvent) return false;
    
    try {
      // Check required fields
      if (!eventDetails.title || !eventDetails.date || !eventDetails.time) {
        console.log('Missing required fields:', { eventDetails });
        return false;
      }

      // Clean up date format
      const dateMatch = eventDetails.date.match(/^\d{4}-\d{2}-\d{2}$/);
      if (!dateMatch) {
        console.log('Invalid date format:', eventDetails.date);
        return false;
      }

      // Clean up time format and allow more variations
      let time = eventDetails.time;
      // Remove any leading/trailing whitespace
      time = time.trim();
      // Convert 12-hour format to 24-hour if needed
      if (time.match(/^(1[0-2]|0?[1-9]):[0-5][0-9](:[0-5][0-9])?\s*[AaPp][Mm]$/)) {
        const [_, hours, minutes, __, meridiem] = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
        const hr = parseInt(hours, 10) % 12 + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
        time = `${hr.toString().padStart(2, '0')}:${minutes}`;
      }
      // Validate final time format
      if (!time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
        console.log('Invalid time format after conversion:', time);
        return false;
      }
      eventDetails.time = time;

      // If end time is provided, validate it
      if (eventDetails.endTime) {
        let endTime = eventDetails.endTime;
        // Remove any leading/trailing whitespace
        endTime = endTime.trim();
        // Convert 12-hour format to 24-hour if needed
        if (endTime.match(/^(1[0-2]|0?[1-9]):[0-5][0-9](:[0-5][0-9])?\s*[AaPp][Mm]$/)) {
          const [_, hours, minutes, __, meridiem] = endTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
          const hr = parseInt(hours, 10) % 12 + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
          endTime = `${hr.toString().padStart(2, '0')}:${minutes}`;
        }
        // Validate final time format
        if (!endTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
          console.log('Invalid end time format after conversion:', endTime);
          eventDetails.endTime = ''; // Clear invalid end time
        } else {
          eventDetails.endTime = endTime;
        }
      }

      // If end date is provided, validate it
      if (eventDetails.endDate) {
        const endDateMatch = eventDetails.endDate.match(/^\d{4}-\d{2}-\d{2}$/);
        if (!endDateMatch) {
          console.log('Invalid end date format:', eventDetails.endDate);
          eventDetails.endDate = eventDetails.date; // Default to start date if invalid
        }
      }

      // Validate the combined date and time is not in the past
      const eventDate = new Date(`${eventDetails.date}T${eventDetails.time}`);
      if (isNaN(eventDate.getTime())) {
        console.log('Invalid date/time combination:', eventDetails.date, eventDetails.time);
        return false;
      }

      // Allow events starting within the last hour to account for slight time differences
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      if (eventDate < oneHourAgo) {
        console.log('Event is in the past:', eventDate);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating event details:', error);
      return false;
    }
  }

  /**
   * Extracts event details from a message if it contains event information
   * @param {string} messageContent - The message to analyze
   * @returns {Promise<Object|null>} Event details or null if no event found
   */
  async extractEventDetails(messageContent) {
    if (!this.isEnabled() || !messageContent) {
      return null;
    }

    try {
      const endpoint = `${this.apiEndpoint.replace(/\/+$/, '')}/chat/completions`;
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0];

      // Convert any Discord timestamps to human-readable text first
      const humanReadableMessage = convertDiscordTimestampsToText(messageContent);

      // Log the conversion for debugging
      console.log('Original message:', messageContent);
      console.log('Converted message:', humanReadableMessage);

      const prompt = `You are an assistant that extracts event details from Discord messages.
Current date: ${today}
Current time: ${currentTime}

Analyze this Discord message for event details:
"${humanReadableMessage}"

Instructions:
1. Look for mentions of:
   - Specific dates (e.g., "March 15th", "next Tuesday", "tomorrow")
   - Specific times (e.g., "2pm", "14:00", "3:30 EST")
   - End times (e.g., "from 2pm to 4pm", "2-4pm", "until 3:30pm")
   - Event durations (e.g., "2 hour meeting", "90 minute session")
   - Locations (physical or virtual)
   - Meeting/event purposes

2. Convert relative dates to YYYY-MM-DD format:
   - "tomorrow" → "${new Date(now.getTime() + 86400000).toISOString().split('T')[0]}"
   - "next week" → date 7 days from now
   - Use ${today} as reference date

3. Convert times to 24-hour format (HH:MM):
   - "2pm" → "14:00"
   - "2:30pm" → "14:30"
   - Use local time if no timezone specified

4. Determine end time and date:
   - If specific end time is mentioned (e.g., "2pm to 4pm"), extract it
   - If duration is mentioned (e.g., "2 hour meeting"), calculate end time
   - If neither is specified, leave end time/date empty (client will default to 1 hour later)

5. Location handling:
   - Use exact location if mentioned
   - Use "Virtual Meeting" if mentions online/virtual
   - Use null if no location found

If you find an event with both a date and time, output this JSON:
{
  "hasEvent": true,
  "title": "Clear event title",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "endDate": "YYYY-MM-DD or empty if same as start date",
  "endTime": "HH:MM or empty if not specified",
  "location": "Location or null",
  "description": "Event description"
}

Example inputs that should return events:
1. "Team meeting tomorrow at 2pm" → Extract event with tomorrow's date and 14:00
2. "Sprint review on Tuesday 15:00" → Calculate next Tuesday's date
3. "Project deadline March 15th at 3pm EST" → Convert to YYYY-MM-DD and 15:00
4. "Meeting from 2pm to 4pm tomorrow" → Extract both start and end times

Output exactly "NO_EVENT" only if:
1. No date AND time are mentioned together
2. Time references are vague ("later", "soon")
3. The event is clearly in the past

Think step by step:
1. Is there a time mentioned? (required)
2. Is there a date mentioned? (required)
3. Is there an end time or duration? (optional)
4. Is there a location? (optional)
5. What's the event about? (required for title)
6. Are all required fields clear and specific?`;

      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey && this.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that extracts event details from messages. You are optimistic about finding events when both a date and time are mentioned.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3, // Increased from 0.1 to allow more flexibility
          max_tokens: 500 // Increased to ensure full response
        })
      });

      if (!response.ok) {
        console.error('LLM API error when extracting event details');
        return null;
      }

      const data = await response.json();
      
      // Log the LLM response for debugging
      console.log('LLM Response:', data?.choices?.[0]?.message?.content);

      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const result = data.choices[0].message.content.trim();
        
        if (result === 'NO_EVENT') {
          return null;
        }

        try {
          const eventDetails = JSON.parse(result);
          if (this.validateEventDetails(eventDetails)) {
            console.log('Valid event details extracted:', eventDetails);
            return eventDetails;
          } else {
            console.log('Invalid event details:', eventDetails);
          }
        } catch (parseError) {
          console.error('Failed to parse event details:', parseError);
        }
      }

      return null;
    } catch (error) {
      console.error('Error in extractEventDetails:', error);
      return null;
    }
  }
}

// Singleton instance of the service
let openAIService = null

/**
 * Initialize the OpenAI service with settings
 * @param {Object} settings - Service configuration settings
 * @returns {OpenAIService} The initialized service instance
 */
export function initOpenAIService(settings = {}) {
  openAIService = new OpenAIService(settings)
  return openAIService
}

/**
 * Get the current OpenAI service instance or create one with defaults
 * @returns {OpenAIService} The service instance
 */
export function getOpenAIService() {
  if (!openAIService) {
    openAIService = new OpenAIService()
  }
  return openAIService
}

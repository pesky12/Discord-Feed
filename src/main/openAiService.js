import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'

// Default model to use for summaries
const DEFAULT_MODEL = 'gpt-4o-mini'

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

      const prompt = `Analyze the following Discord message and determine if it needs summarization.
Message: "${messageContent}"

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

      let systemPrompt = `You are a helpful assistant that summarizes Discord messages in a brief and concise way.
You understand conversation context and Discord's communication style.
Consider the following context when analyzing messages:`;

      if (context.channel) systemPrompt += `\n- Channel: ${context.channel}`;
      if (context.author) systemPrompt += `\n- Author: ${context.author}`;
      if (context.recentMessages) {
        systemPrompt += `\n- Recent conversation context:\n${context.recentMessages.map(m => `  ${m.author}: ${m.content}`).join('\n')}`;
      }
      if (context.isDM) systemPrompt += `\n- This is a direct message conversation`;

      const prompt = `Please provide a brief, concise summary (1-2 sentences) of the following Discord message${context.isDM ? ' from this DM conversation' : ''}: "${messageContent}"`;

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

      // Define the analysis prompt with clear criteria
      const prompt = `Analyze the following Discord message and categorize it:
Message: "${messageContent}"

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

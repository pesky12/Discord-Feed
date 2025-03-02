// filepath: p:\Projects\Discord-Feed\src\main\openAiService.js
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'

// Default model to use for summaries
const DEFAULT_MODEL = 'gpt-3.5-turbo'

// OpenAI API client
export class OpenAIService {
  constructor(settings = {}) {
    this.apiKey = settings.openaiApiKey || ''
    this.apiEndpoint = settings.openaiApiEndpoint || 'https://api.openai.com/v1'
    this.enabled = settings.enableSummarization || false
    this.detectionMode = settings.summaryDetectionMode || 'length'
    this.minLength = settings.minLengthForSummary || 100
  }

  updateSettings(settings = {}) {
    this.apiKey = settings.openaiApiKey || this.apiKey
    this.apiEndpoint = settings.openaiApiEndpoint || this.apiEndpoint
    this.enabled = settings.enableSummarization !== undefined ? settings.enableSummarization : this.enabled
    this.detectionMode = settings.summaryDetectionMode || this.detectionMode
    this.minLength = settings.minLengthForSummary || this.minLength
  }

  /**
   * Check if the AI summarization service is enabled and configured
   */
  isEnabled() {
    // Only require that summarization is enabled and an endpoint is provided
    // API key is now optional for all endpoints
    return this.enabled && this.apiEndpoint && this.apiEndpoint.trim() !== '';
  }

  /**
   * Check if a message needs summarization based on configured detection mode
   * @param {string} messageContent - The message content to check
   * @returns {Promise<boolean>} - Whether the message needs summarization
   */
  async shouldSummarize(messageContent) {
    if (!this.isEnabled() || !messageContent || messageContent.trim() === '') {
      return false;
    }

    // Simple length-based check
    if (this.detectionMode === 'length') {
      return messageContent.length >= this.minLength;
    }
    
    // Smart AI-based check
    if (this.detectionMode === 'smart') {
      try {
        return await this.checkSummarizationNeed(messageContent);
      } catch (error) {
        console.error('Error checking if message needs summarization:', error);
        // Fall back to length check if smart check fails
        return messageContent.length >= this.minLength;
      }
    }
    
    // Default to length check if mode is invalid
    return messageContent.length >= this.minLength;
  }

  /**
   * Use AI to determine if a message needs summarization
   * @param {string} messageContent - The message to analyze
   * @returns {Promise<boolean>} - Whether the message needs summarization
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
          model: DEFAULT_MODEL,
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
        return messageContent.length >= this.minLength; // Fall back to length check
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const answer = data.choices[0].message.content.trim().toUpperCase();
        return answer === 'YES';
      }
      
      return messageContent.length >= this.minLength; // Fall back to length check
    } catch (error) {
      console.error('Error in checkSummarizationNeed:', error);
      return messageContent.length >= this.minLength; // Fall back to length check
    }
  }

  /**
   * Create a summary of a message using OpenAI API
   * @param {string} messageContent - The Discord message content to summarize
   * @returns {Promise<string|null>} - The summary or null if failed
   */
  async summarizeMessage(messageContent) {
    if (!this.enabled || !messageContent || messageContent.trim() === '') {
      return null
    }

    // First check if the message needs summarization
    const needsSummary = await this.shouldSummarize(messageContent);
    if (!needsSummary) {
      return null; // Skip summarization for messages that don't need it
    }

    try {
      // Use native fetch instead of node-fetch
      // In Electron, we can use the native fetch API in the main process
      
      // Construct API endpoint based on configured base URL
      const endpoint = `${this.apiEndpoint.replace(/\/+$/, '')}/chat/completions`
      
      // Format the message for the API
      const prompt = `Please provide a brief, concise summary (1-2 sentences) of the following Discord message: "${messageContent}"`
      
      const headers = {
        'Content-Type': 'application/json'
      }
      
      // Only add Authorization header if API key is provided
      // This allows usage with any LLM servers that don't require auth
      if (this.apiKey && this.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes Discord messages in a brief and concise way.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.3
        })
      })

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
}

// Global instance
let openAIService = null

/**
 * Initialize the OpenAI service with settings from config file
 */
export function initOpenAIService(settings = {}) {
  openAIService = new OpenAIService(settings)
  return openAIService
}

/**
 * Get the OpenAI service instance
 */
export function getOpenAIService() {
  if (!openAIService) {
    openAIService = new OpenAIService()
  }
  return openAIService
}
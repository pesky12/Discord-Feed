import React from 'react';

/**
 * Format the timestamp into a human-readable form
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Formatted timestamp string
 */
export const formatTimestamp = (timestamp) => {
  // Check if the timestamp is in Discord's <t:timestamp:format> format
  if (typeof timestamp === 'string') {
    const discordTimestampRegex = /<t:(\d+):([tTdDfFR])>/g;
    const match = discordTimestampRegex.exec(timestamp);
    
    if (match) {
      const unixTimestamp = parseInt(match[1]);
      const format = match[2];
      return formatDiscordTimestamp(unixTimestamp, format);
    }
  }
  
  // Fall back to regular timestamp handling
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Formats a Discord timestamp tag into human-readable text
 * @param {string} timestamp - Unix timestamp
 * @param {string} format - Discord format type (t, T, d, D, f, F, R)
 * @returns {string} Formatted timestamp
 */
export const formatDiscordTimestamp = (timestamp, format) => {
  const date = new Date(timestamp * 1000);
  
  switch (format) {
    case 't': // Short Time (e.g., 2:30 PM)
      return date.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit'
      });
    case 'T': // Long Time (e.g., 2:30:20 PM)
      return date.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit',
        second: '2-digit'
      });
    case 'd': // Short Date (e.g., 20/12/2023)
      return date.toLocaleDateString();
    case 'D': // Long Date (e.g., December 20, 2023)
      return date.toLocaleDateString(undefined, { 
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'f': // Short Date/Time (e.g., 20 December 2023 2:30 PM)
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    case 'F': // Long Date/Time (e.g., Wednesday, December 20, 2023 2:30 PM)
      return date.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    case 'R': // Relative (e.g., 2 hours ago, in 3 days)
      const diff = date - new Date();
      const diffSeconds = Math.abs(Math.round(diff / 1000));
      const diffMinutes = Math.abs(Math.round(diff / (1000 * 60)));
      const diffHours = Math.abs(Math.round(diff / (1000 * 60 * 60)));
      const diffDays = Math.abs(Math.round(diff / (1000 * 60 * 60 * 24)));
      
      if (diffDays > 0) {
        return diff > 0 ? `in ${diffDays} day${diffDays === 1 ? '' : 's'}` : `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
      }
      if (diffHours > 0) {
        return diff > 0 ? `in ${diffHours} hour${diffHours === 1 ? '' : 's'}` : `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      }
      if (diffMinutes > 0) {
        return diff > 0 ? `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}` : `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
      }
      return diff > 0 ? 'in a few seconds' : 'a few seconds ago';
    default:
      return date.toLocaleString();
  }
};

/**
 * Formats the message body by replacing Discord timestamp tags with formatted dates
 * @param {string} text - Message text containing Discord timestamp tags
 * @returns {Array} Array of text and formatted timestamp elements
 */
export const formatMessageWithTimestamps = (text) => {
  if (!text) return [];
  
  const timestampRegex = /<t:(\d+):([tTdDfFR])>/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = timestampRegex.exec(text)) !== null) {
    // Add text before the timestamp
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add the formatted timestamp
    const timestamp = parseInt(match[1]);
    const format = match[2];
    parts.push(
      <span key={match.index} className="discord-timestamp">
        {formatDiscordTimestamp(timestamp, format)}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
};

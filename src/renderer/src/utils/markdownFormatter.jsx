import React from 'react';

// Map of Discord emoji names to their Unicode equivalents
const emojiMap = {
  'thinking': '🤔',
  'smile': '😊',
  'warn': '⚠️',
  'warning': '⚠️',
  'red_circle': '🔴',
  'white_check_mark': '✅',
  'x': '❌',
  'question': '❓',
  'exclamation': '❗',
  'lock': '🔒',
  'unlock': '🔓',
  'star': '⭐',
  'heart': '❤️',
  'thumbsup': '👍',
  'thumbsdown': '👎',
  'ok': '👌',
  'eyes': '👀',
  'wave': '👋',
  'rocket': '🚀',
  'tada': '🎉',
  'calendar': '📅',
  'bell': '🔔',
  'no_bell': '🔕',
  'pushpin': '📌',
  'scroll': '📜',
  'book': '📚',
  'bookmark': '🔖',
  'clipboard': '📋',
  'pencil': '✏️',
  'memo': '📝',
  'bulb': '💡',
  'gear': '⚙️',
  'wrench': '🔧',
  'link': '🔗',
  'clock': '🕐',
};

/**
 * Convert Discord-style emoji markup to Unicode emojis
 * @param {string} text - Text containing Discord emoji markup
 * @returns {string} Text with emojis converted
 */
function convertEmojis(text) {
  if (!text) return text;
  
  // Match :emoji_name: pattern, but not within code blocks
  return text.replace(/:([\w_]+):/g, (match, emojiName) => {
    return emojiMap[emojiName] || match;
  });
}

/**
 * Parse Discord markdown formatting in text
 * @param {string} text - Text that may contain Discord markdown
 * @returns {Array} Array of React elements with formatted text
 */
export const parseDiscordMarkdown = (text) => {
  if (!text) return [];
  
  console.log('%c MARKDOWN INPUT ', 'background: #e91e63; color: white; font-weight: bold', { text });

  // First convert emojis in the text, but preserve code blocks
  const codeBlocks = [];
  const textWithoutCode = text.replace(/```[\s\S]*?```|`[^`]*`/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Convert emojis in the non-code text
  let processedText = convertEmojis(textWithoutCode);

  // Restore code blocks
  processedText = processedText.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => codeBlocks[index]);

  // Continue with existing code block processing
  const codeBlockRegex = /```([\w-]*)\s*([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(processedText)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textBefore = processedText.substring(lastIndex, match.index);
      parts.push(...processText(textBefore));
    }

    const language = (match[1] || '').trim().toLowerCase();
    let code = match[2];
    
    // Trim only the first newline if it exists
    if (code.startsWith('\n')) {
      code = code.substring(1);
    }
    // Trim only the last newline if it exists
    if (code.endsWith('\n')) {
      code = code.substring(0, code.length - 1);
    }

    // Special handling for diff blocks - check multiple possible identifiers
    if (['diff', 'difference', 'dif'].includes(language)) {
      const lines = code.split('\n');
      // Remove any leading/trailing empty lines while preserving internal whitespace
      while (lines.length > 0 && lines[0].trim() === '') lines.shift();
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
      
      parts.push(
        <pre key={`code-${match.index}`} className="discord-code-block diff">
          {lines.map((line, i) => {
            // Check for empty lines first to preserve them in the output
            if (line.trim() === '') {
              return <div key={`line-${i}`}>{' '}</div>;
            }

            const trimmedLine = line.trim();
            // Handle various diff syntaxes including Discord's format and standard git diff
            if (line.startsWith('+') || trimmedLine.startsWith('+') || line.startsWith('> ')) {
              const displayLine = line.startsWith('+') ? line : line.startsWith('> ') ? line.substring(2) : line;
              return <div key={`line-${i}`} className="diff-add">{displayLine}</div>;
            } else if (line.startsWith('-') || trimmedLine.startsWith('-') || line.startsWith('< ')) {
              const displayLine = line.startsWith('-') ? line : line.startsWith('< ') ? line.substring(2) : line;
              return <div key={`line-${i}`} className="diff-remove">{displayLine}</div>;
            } else {
              return <div key={`line-${i}`}>{line || ' '}</div>;
            }
          })}
        </pre>
      );
    } else {
      parts.push(
        <pre key={`code-${match.index}`} className="discord-code-block">
          <code className={language ? `language-${language}` : ''}>
            {code}
          </code>
        </pre>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < processedText.length) {
    const remainingText = processedText.substring(lastIndex);
    parts.push(...processText(remainingText));
  }

  return parts.length ? parts : text;
};

/**
 * Process text content, splitting by lines and handling inline formatting
 * @param {string} text - Text to process
 * @returns {Array} Array of processed elements
 */
function processText(text) {
  // Split by lines to handle block-level formatting
  const lines = text.split('\n');
  let result = [];
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    // Add a line break between processed lines, except for the first line
    if (i > 0) {
      result.push(<br key={`br-${i}`} />);
    }
    
    // Process inline formatting in this line
    const processedLine = processInlineFormatting(lines[i]);
    result.push(processedLine);
  }
  
  return result;
}

/**
 * Process inline markdown formatting (bold, italic, etc.)
 * @param {string} text - Text to process
 * @returns {Array} Array of processed text and React elements
 */
function processInlineFormatting(text) {
  // If the text is empty, return as is
  if (!text || text.trim() === '') {
    return text;
  }

  // First, handle code blocks as they should not have other formatting inside
  let segments = [];
  let currentText = text;
  let inlineCodeRegex = /`([^`]+)`/;
  let match;
  let lastIndex = 0;

  // Process inline code blocks
  while ((match = inlineCodeRegex.exec(currentText.substring(lastIndex))) !== null) {
    // Add text before the code block
    const beforeText = currentText.substring(lastIndex, lastIndex + match.index);
    if (beforeText) {
      segments.push(beforeText);
    }
    
    // Add the code block
    segments.push(
      <code key={`code-${lastIndex + match.index}`} className="discord-inline-code">
        {match[1]}
      </code>
    );
    
    lastIndex += match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < currentText.length) {
    segments.push(currentText.substring(lastIndex));
  }
  
  // If no code blocks were found, keep the original text
  if (segments.length === 0) {
    segments = [currentText];
  }
  
  // Process each segment for other formatting
  const result = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    // Skip React elements (code blocks)
    if (React.isValidElement(segment)) {
      result.push(segment);
      continue;
    }
    
    // Apply formatting for text segments
    // We'll process them in order: bold-italic, bold, italic, underline, strikethrough
    let formattedText = processFormattingTags(segment);
    
    result.push(formattedText);
  }
  
  return result.length === 1 ? result[0] : result;
}

/**
 * Process formatting tags in a text segment
 * @param {string} text - Text segment to process
 * @returns {string|React.Element|Array} - Processed text or React elements
 */
function processFormattingTags(text) {
  if (typeof text !== 'string') return text;
  
  // Helper function to create formatted elements
  const createFormattedElement = (type, content, key) => {
    switch (type) {
      case 'bold-italic':
        return <span key={key} className="discord-bold-italic">{content}</span>;
      case 'bold':
        return <strong key={key} className="discord-bold">{content}</strong>;
      case 'italic':
        return <em key={key} className="discord-italic">{content}</em>;
      case 'underline':
        return <span key={key} className="discord-underline">{content}</span>;
      case 'strikethrough':
        return <span key={key} className="discord-strikethrough">{content}</span>;
      default:
        return content;
    }
  };
  
  // Process bold-italic (***text***)
  if (text.includes('***')) {
    const parts = [];
    const boldItalicRegex = /\*\*\*([^*]+?)\*\*\*/g;
    let match;
    let lastIndex = 0;
    let count = 0;
    
    while ((match = boldItalicRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(processFormattingTags(text.substring(lastIndex, match.index)));
      }
      
      // Add the formatted element
      parts.push(createFormattedElement('bold-italic', match[1], `bi-${count++}`));
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(processFormattingTags(text.substring(lastIndex)));
    }
    
    return parts;
  }
  
  // Process bold (**text**)
  if (text.includes('**')) {
    const parts = [];
    const boldRegex = /\*\*([^*]+?)\*\*/g;
    let match;
    let lastIndex = 0;
    let count = 0;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(processFormattingTags(text.substring(lastIndex, match.index)));
      }
      
      // Add the formatted element
      parts.push(createFormattedElement('bold', match[1], `b-${count++}`));
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(processFormattingTags(text.substring(lastIndex)));
    }
    
    return parts;
  }
  
  // Process underline (__text__)
  if (text.includes('__')) {
    const parts = [];
    const underlineRegex = /__([^_]+?)__/g;
    let match;
    let lastIndex = 0;
    let count = 0;
    
    while ((match = underlineRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(processFormattingTags(text.substring(lastIndex, match.index)));
      }
      
      // Add the formatted element
      parts.push(createFormattedElement('underline', match[1], `u-${count++}`));
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(processFormattingTags(text.substring(lastIndex)));
    }
    
    return parts;
  }
  
  // Process italic (*text* or _text_)
  if (text.includes('*') || text.includes('_')) {
    // Process * first
    if (text.includes('*')) {
      const parts = [];
      const italicRegex = /\*([^*]+?)\*/g;
      let match;
      let lastIndex = 0;
      let count = 0;
      
      while ((match = italicRegex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }
        
        // Add the formatted element
        parts.push(createFormattedElement('italic', match[1], `i-${count++}`));
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }
      
      text = parts;
    }
    
    // Then process _ for any remaining strings
    if (typeof text === 'string' && text.includes('_')) {
      const parts = [];
      const italicRegex = /_([^_]+?)_/g;
      let match;
      let lastIndex = 0;
      let count = 0;
      
      while ((match = italicRegex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }
        
        // Add the formatted element
        parts.push(createFormattedElement('italic', match[1], `i-${count++}`));
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }
      
      return parts;
    }
    
    return text;
  }
  
  // Process strikethrough (~~text~~)
  if (text.includes('~~')) {
    const parts = [];
    const strikeRegex = /~~([^~]+?)~~/g;
    let match;
    let lastIndex = 0;
    let count = 0;
    
    while ((match = strikeRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(processFormattingTags(text.substring(lastIndex, match.index)));
      }
      
      // Add the formatted element
      parts.push(createFormattedElement('strikethrough', match[1], `s-${count++}`));
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(processFormattingTags(text.substring(lastIndex)));
    }
    
    return parts;
  }
  
  // No special formatting found
  return text;
}

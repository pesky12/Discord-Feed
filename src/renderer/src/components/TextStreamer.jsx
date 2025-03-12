import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Component that gradually reveals text with a typewriter-like effect
 */
const TextStreamer = ({ text, speed = 5, onComplete = () => {} }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    // Reset state when the text input changes
    setDisplayedText('');
    setIsComplete(false);
    
    // Don't start animation for empty text
    if (!text) {
      setIsComplete(true);
      onComplete();
      return;
    }
    
    // Use faster typing by processing multiple characters per interval
    let currentIndex = 0;
    const charsPerInterval = 3; // Process multiple characters at once for faster typing
    
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        const nextIndex = Math.min(currentIndex + charsPerInterval, text.length);
        setDisplayedText(text.substring(0, nextIndex));
        currentIndex = nextIndex;
        
        // Check if animation is complete
        if (currentIndex >= text.length) {
          clearInterval(interval);
          setIsComplete(true);
          onComplete();
        }
      } else {
        clearInterval(interval);
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);
  
  return (
    <span className={`streamed-text ${isComplete ? 'complete' : 'streaming'}`}>
      {displayedText}
      {!isComplete && <span className="text-cursor"></span>}
    </span>
  );
};

TextStreamer.propTypes = {
  text: PropTypes.string.isRequired,
  speed: PropTypes.number,
  onComplete: PropTypes.func
};

export default TextStreamer;

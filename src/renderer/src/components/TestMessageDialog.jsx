import React, { useState, useEffect } from 'react';
import styles from './TestMessageDialog.module.css';

/**
 * Dialog for generating test notifications with specific categories
 * @param {Object} props Component props
 * @param {Function} props.onGenerate Callback when notification is generated
 * @param {boolean} props.isOpen Whether the dialog is open
 * @param {Function} props.onClose Callback to close dialog
 * @returns {JSX.Element} Component
 */
export default function TestMessageDialog({ onGenerate, isOpen, onClose }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [counts, setCounts] = useState({});
  
  useEffect(() => {
    // Fetch message categories from the backend when dialog opens
    if (isOpen) {
      window.api.getMessageCategories().then((result) => {
        setCategories(result.categories);
        setCounts(result.counts);
        setSelectedCategory(result.categories[0] || '');
      });
    }
  }, [isOpen]);

  const handleGenerate = () => {
    onGenerate({
      category: selectedCategory,
      messageIndex: parseInt(messageIndex, 10)
    });
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setMessageIndex(0); // Reset index when category changes
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>Generate Test Notification</h2>
        
        <div className={styles.field}>
          <label htmlFor="category">Message Category:</label>
          <select 
            id="category"
            value={selectedCategory}
            onChange={handleCategoryChange}
            className={styles.select}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)} ({counts[category] || 0})
              </option>
            ))}
            <option value="">Random (Any Category)</option>
          </select>
        </div>

        {selectedCategory && (
          <div className={styles.field}>
            <label htmlFor="messageIndex">Message Variant:</label>
            <select
              id="messageIndex"
              value={messageIndex}
              onChange={(e) => setMessageIndex(e.target.value)}
              className={styles.select}
            >
              {Array.from({ length: counts[selectedCategory] || 0 }, (_, i) => (
                <option key={i} value={i}>Variant {i + 1}</option>
              ))}
              <option value="-1">Random</option>
            </select>
          </div>
        )}
        
        <div className={styles.buttons}>
          <button 
            onClick={handleCancel}
            className={`${styles.button} ${styles.cancelButton}`}
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            className={`${styles.button} ${styles.generateButton}`}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

import firebase from 'firebase/compat/app';
import { TimestampType } from '../../models/chatTypes';

/**
 * Get current timestamp as Firebase Timestamp
 */
export function getCurrentTimestamp(): firebase.firestore.Timestamp {
  return firebase.firestore.Timestamp.now();
}

/**
 * Normalize timestamp to Firebase Timestamp regardless of input format
 * @param timestamp - Timestamp in any format
 * @returns Firebase Timestamp or current timestamp if input is invalid
 */
export function normalizeTimestamp(timestamp: any): firebase.firestore.Timestamp {
  if (!timestamp) {
    return getCurrentTimestamp();
  }
  
  if (timestamp instanceof firebase.firestore.Timestamp) {
    return timestamp;
  }
  
  if (timestamp instanceof Date) {
    return firebase.firestore.Timestamp.fromDate(timestamp);
  }
  
  if (typeof timestamp === 'object' && timestamp.seconds !== undefined) {
    // Handle serialized Timestamp objects
    try {
      return new firebase.firestore.Timestamp(
        timestamp.seconds,
        timestamp.nanoseconds || 0
      );
    } catch (e) {
      console.warn('Failed to convert serialized timestamp:', e);
      return getCurrentTimestamp();
    }
  }
  
  if (typeof timestamp === 'string') {
    try {
      return firebase.firestore.Timestamp.fromDate(new Date(timestamp));
    } catch (e) {
      console.warn('Failed to parse timestamp string:', e);
      return getCurrentTimestamp();
    }
  }
  
  if (typeof timestamp === 'number') {
    try {
      return firebase.firestore.Timestamp.fromMillis(timestamp);
    } catch (e) {
      console.warn('Failed to convert timestamp number:', e);
      return getCurrentTimestamp();
    }
  }
  
  // Fallback to current timestamp
  return getCurrentTimestamp();
}

/**
 * Format timestamp for display in messages
 * @param timestamp - Timestamp in any format
 * @returns Formatted time string (e.g. "10:30 AM" or "Yesterday" or "Mon" or "2022-01-01")
 */
export function formatMessageTime(timestamp: TimestampType): string {
  if (!timestamp) return '';
  
  try {
    let date: Date;
    
    if (timestamp instanceof firebase.firestore.Timestamp) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return '';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today: Show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Ayer';
    } else if (diffDays < 7) {
      // In the last week: show weekday
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days[date.getDay()];
    } else {
      // Older dates: short format
      return date.toLocaleDateString();
    }
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
}

/**
 * Format timestamp for display in conversation list
 * @param timestamp - Timestamp in any format
 * @returns Formatted time string optimized for conversation list
 */
export function formatConversationTime(timestamp: TimestampType): string {
  if (!timestamp) return '';
  
  try {
    let date: Date;
    
    if (timestamp instanceof firebase.firestore.Timestamp) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return '';
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffDays = Math.round((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today: Show time only
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Ayer';
    } else if (diffDays < 7) {
      // Current week: Show day name
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days[date.getDay()];
    } else if (date.getFullYear() === now.getFullYear()) {
      // Same year: Show day and month
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      // Different year: Show day, month and year
      return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }
  } catch (error) {
    console.error('Error formatting conversation time:', error);
    return '';
  }
}

/**
 * Safely sanitize text input
 * @param text - Input text
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Trim and handle basic sanitization
  const trimmed = text.trim();
  
  // Replace dangerous characters with their HTML entities
  return trimmed
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Validate if a string is a valid URL
 * @param url - URL to validate
 * @returns True if valid URL
 */
export function isValidURL(url: string): boolean {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get initial for avatar placeholder
 * @param name - User name
 * @returns Single character for avatar placeholder
 */
export function getNameInitial(name?: string): string {
  if (!name) return '?';
  
  const trimmedName = name.trim();
  if (!trimmedName) return '?';
  
  return trimmedName.charAt(0).toUpperCase();
}

/**
 * Generate avatar color based on user ID
 * @param userId - User ID
 * @returns HEX color code
 */
export function getAvatarColor(userId?: string): string {
  if (!userId) return '#007AFF';
  
  // Predefined colors that look good as avatar backgrounds
  const colors = [
    '#007AFF', // Blue
    '#34C759', // Green
    '#FF9500', // Orange
    '#FF2D55', // Pink
    '#AF52DE', // Purple
    '#5856D6', // Indigo
    '#FF3B30', // Red
    '#5AC8FA', // Light Blue
    '#FFCC00', // Yellow
    '#4CD964'  // Light Green
  ];
  
  // Simple hash function to get a consistent color for the same ID
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i)) % colors.length;
  }
  
  return colors[hash];
}

/**
 * Get message status text
 * @param status - Message status
 * @returns Human-readable status
 */
export function getMessageStatusText(status?: string): string {
  switch (status) {
    case 'sending':
      return 'Enviando...';
    case 'sent':
      return 'Enviado';
    case 'delivered':
      return 'Entregado';
    case 'read':
      return 'Leído';
    case 'error':
      return 'Error';
    default:
      return '';
  }
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
}
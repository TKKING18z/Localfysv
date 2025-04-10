/**
 * Chat Types - Core data models for chat functionality
 */
import firebase from 'firebase/compat/app';

/**
 * Timestamp type to handle different timestamp formats across the application.
 * Supports Firebase Timestamp, JavaScript Date, or ISO string format.
 */
export type TimestampType = firebase.firestore.Timestamp | Date | string | null;

/**
 * Message delivery status types
 */
export enum MessageStatus {
  SENDING = 'sending',  // Message is being sent
  SENT = 'sent',        // Successfully sent to server
  DELIVERED = 'delivered', // Delivered to recipient device
  READ = 'read',        // Read by recipient
  ERROR = 'error'       // Failed to send
}

/**
 * Message content type
 */
export enum MessageType {
  TEXT = 'text',       // Plain text message
  IMAGE = 'image',     // Image message
  SYSTEM = 'system'    // System notification
}

/**
 * Reply info structure for replies to messages
 */
export interface ReplyInfo {
  /** ID of the message being replied to */
  messageId: string;
  /** Text of the original message */
  text: string;
  /** Sender ID of the original message */
  senderId: string;
  /** Sender name of the original message */
  senderName?: string;
  /** Type of the original message */
  type: MessageType | string;
  /** URL to image (for image messages) */
  imageUrl?: string;
}

/**
 * Message model - Represents a single chat message
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Message content text */
  text: string;
  /** User ID of sender */
  senderId: string;
  /** Display name of sender */
  senderName?: string;
  /** Profile photo URL of sender */
  senderPhoto?: string;
  /** When the message was sent */
  timestamp: TimestampType;
  /** Current delivery status */
  status?: MessageStatus;
  /** Whether message has been read by recipient */
  read: boolean;
  /** Content type of the message */
  type: MessageType | string;
  /** URL to image (for image messages) */
  imageUrl?: string;
  /** Reply information if this message is a reply */
  replyTo?: ReplyInfo;
  /** Additional data for specialized messages */
  metadata?: Record<string, any>;
}

/**
 * Conversation model - Represents a chat thread between users
 */
export interface Conversation {
  /** Unique conversation identifier */
  id: string;
  /** Array of user IDs in the conversation */
  participants: string[];
  /** Mapping of user IDs to display names */
  participantNames: Record<string, string>;
  /** Mapping of user IDs to profile photos */
  participantPhotos?: Record<string, string>;
  /** Most recent message in the conversation */
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: TimestampType;
  };
  /** Associated business ID, if this is a business conversation */
  businessId?: string;
  /** Business name if applicable */
  businessName?: string;
  /** Count of unread messages per user */
  unreadCount: Record<string, number>;
  /** Whether conversation is marked deleted by certain users */
  deletedFor?: Record<string, boolean>;
  /** When the conversation was created */
  createdAt: TimestampType;
  /** When the conversation was last updated */
  updatedAt: TimestampType;
  /** Additional data for extensibility */
  metadata?: Record<string, any>;
  /** Support for additional properties */
  [key: string]: any;
}

/**
 * User model specific to chat functionality
 */
export interface ChatUser {
  /** User identifier */
  id: string;
  /** Display name */
  name: string;
  /** Profile image URL */
  photoURL?: string;
  /** Online status */
  isOnline?: boolean;
  /** When user was last active */
  lastSeen?: TimestampType;
  /** User role for permission purposes */
  role?: 'customer' | 'business_owner' | 'admin';
}

/**
 * Data required to create a new message
 */
export interface NewMessageData {
  /** Message text content */
  text: string;
  /** Optional image URL */
  imageUrl?: string;
  /** Message content type */
  type?: MessageType | string;
  /** Additional custom data */
  metadata?: Record<string, any>;
}

/**
 * Standard response format for chat service operations
 */
export interface ChatResult<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** Response data (when success is true) */
  data?: T;
  /** Error information (when success is false) */
  error?: {
    /** User-friendly error message */
    message: string;
    /** Error code for programmatic handling */
    code?: string;
    /** Original error object for debugging */
    originalError?: any;
  };
}
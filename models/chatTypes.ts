import firebase from 'firebase/compat/app';

// Base timestamp type to handle different timestamp formats
export type TimestampType = firebase.firestore.Timestamp | Date | string;

// Message status enum for better type safety
export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  ERROR = 'error'
}

// Message types enum for better type safety
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system'
}

// Enhanced Message interface
export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  senderPhoto?: string;
  timestamp: TimestampType;
  status?: MessageStatus;
  read: boolean;
  type: MessageType | string; // Using enum but allowing string for backward compatibility
  imageUrl?: string;
  metadata?: Record<string, any>; // For future extensibility
}

// Enhanced Conversation interface
export interface Conversation {
  id: string;
  participants: string[]; // IDs de los usuarios participantes
  participantNames: Record<string, string>; // Mapeo de IDs a nombres
  participantPhotos?: Record<string, string>; // Mapeo de IDs a fotos
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: TimestampType;
  };
  businessId?: string; // ID del negocio relacionado (si aplica)
  businessName?: string; // Nombre del negocio relacionado
  unreadCount: Record<string, number>; // Conteo de mensajes no leídos por usuario
  deletedFor?: Record<string, boolean>; // Mapeo de IDs de usuario a estado de eliminación
  createdAt: TimestampType;
  updatedAt: TimestampType;
  metadata?: Record<string, any>; // For future extensibility
  // For typing purposes
  [key: string]: any;
}

export interface ChatUser {
  id: string;
  name: string;
  photoURL?: string;
  isOnline?: boolean;
  lastSeen?: TimestampType;
  role?: 'customer' | 'business_owner';
}

export interface NewMessageData {
  text: string;
  imageUrl?: string;
  type?: MessageType | string;
  metadata?: Record<string, any>;
}

// Standard response type for chat service
export interface ChatResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    originalError?: any;
  };
}
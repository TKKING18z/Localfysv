import firebase from 'firebase/compat/app';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  senderPhoto?: string;
  timestamp: firebase.firestore.Timestamp | Date | string;
  read: boolean;
  type: 'text' | 'image' | 'system';
  imageUrl?: string;
}

export interface Conversation {
  id: string;
  participants: string[]; // IDs de los usuarios participantes
  participantNames: Record<string, string>; // Mapeo de IDs a nombres
  participantPhotos?: Record<string, string>; // Mapeo de IDs a fotos
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: firebase.firestore.Timestamp | Date | string;
  };
  businessId?: string; // ID del negocio relacionado (si aplica)
  businessName?: string; // Nombre del negocio relacionado
  unreadCount: Record<string, number>; // Conteo de mensajes no leídos por usuario
  deletedFor?: Record<string, boolean>; // Mapeo de IDs de usuario a estado de eliminación (soft delete)
  createdAt: firebase.firestore.Timestamp | Date | string;
  updatedAt: firebase.firestore.Timestamp | Date | string;
}

export interface ChatUser {
  id: string;
  name: string;
  photoURL?: string;
  isOnline?: boolean;
  lastSeen?: firebase.firestore.Timestamp | Date | string;
}

export interface NewMessageData {
  text: string;
  imageUrl?: string;
  type?: 'text' | 'image' | 'system';
}
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { Message, Conversation, NewMessageData } from '../models/chatTypes';

interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export const chatService = {
  // Obtener conversaciones de un usuario
  getUserConversations: async (userId: string): Promise<Result<Conversation[]>> => {
    try {
      const snapshot = await firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];

      return { success: true, data: conversations };
    } catch (error) {
      console.error('Error getting conversations:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al obtener conversaciones',
          code: 'chat/get-conversations-failed'
        } 
      };
    }
  },

  // Obtener una conversación específica
  getConversation: async (conversationId: string): Promise<Result<Conversation>> => {
    try {
      const doc = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();

      if (!doc.exists) {
        return {
          success: false,
          error: {
            message: 'La conversación no existe',
            code: 'chat/conversation-not-found'
          }
        };
      }

      const conversation = {
        id: doc.id,
        ...doc.data()
      } as Conversation;

      return { success: true, data: conversation };
    } catch (error) {
      console.error('Error getting conversation:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al obtener la conversación',
          code: 'chat/get-conversation-failed'
        } 
      };
    }
  },

  // Obtener mensajes de una conversación
  getMessages: async (conversationId: string, limit = 50): Promise<Result<Message[]>> => {
    try {
      const snapshot = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

      return { success: true, data: messages };
    } catch (error) {
      console.error('Error getting messages:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al obtener mensajes',
          code: 'chat/get-messages-failed'
        } 
      };
    }
  },

  // Enviar un mensaje
  sendMessage: async (
    conversationId: string, 
    senderId: string,
    messageData: NewMessageData,
    senderName?: string,
    senderPhoto?: string
  ): Promise<Result<Message>> => {
    try {
      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      const conversationRef = firebase.firestore().collection('conversations').doc(conversationId);
      const messageRef = conversationRef.collection('messages').doc();

      // Datos del mensaje
      const messageObj: any = {
        id: messageRef.id,
        text: messageData.text,
        senderId,
        senderName: senderName || '',
        senderPhoto: senderPhoto || '',
        timestamp,
        read: false,
        type: messageData.type || 'text',
      };

      if (messageData.imageUrl) {
        messageObj.imageUrl = messageData.imageUrl;
      }

      // Obtener la conversación para actualizar metadatos
      const conversationDoc = await conversationRef.get();
      if (!conversationDoc.exists) {
        throw new Error('La conversación no existe');
      }

      const conversationData = conversationDoc.data() as Conversation;
      const participants = conversationData.participants || [];
      
      // Actualizar contadores de no leídos para todos excepto el remitente
      const unreadCount: Record<string, number> = conversationData.unreadCount ? { ...conversationData.unreadCount } : {};
      participants.forEach(participantId => {
        if (participantId !== senderId) {
          unreadCount[participantId] = (unreadCount[participantId] || 0) + 1;
        }
      });

      // Actualizar transacción atomica
      await firebase.firestore().runTransaction(async transaction => {
        // Agregar mensaje
        transaction.set(messageRef, messageObj);
        
        // Actualizar conversación
        transaction.update(conversationRef, {
          lastMessage: {
            text: messageData.text,
            senderId,
            timestamp
          },
          unreadCount,
          updatedAt: timestamp
        });
      });

      // Devolver el mensaje con timestamp actualizado para la interfaz
      const message: Message = {
        ...messageObj,
        timestamp: firebase.firestore.Timestamp.now(),
      };

      return { success: true, data: message };
    } catch (error) {
      console.error('Error sending message:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al enviar mensaje',
          code: 'chat/send-message-failed'
        } 
      };
    }
  },

  // Marcar mensajes como leídos
  markMessagesAsRead: async (conversationId: string, userId: string): Promise<Result<void>> => {
    try {
      const conversationRef = firebase.firestore().collection('conversations').doc(conversationId);
      
      // Obtener los mensajes no leídos enviados por otros
      const snapshot = await conversationRef
        .collection('messages')
        .where('read', '==', false)
        .where('senderId', '!=', userId)
        .get();
      
      if (snapshot.empty) {
        // No hay mensajes para marcar
        return { success: true };
      }

      // Actualizar en una transacción
      await firebase.firestore().runTransaction(async transaction => {
        // Marcar cada mensaje como leído
        snapshot.docs.forEach(doc => {
          transaction.update(doc.ref, { read: true });
        });
        
        // Actualizar contador de no leídos a 0 para este usuario
        transaction.update(conversationRef, {
          [`unreadCount.${userId}`]: 0
        });
      });

      return { success: true };
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al marcar mensajes como leídos',
          code: 'chat/mark-read-failed'
        } 
      };
    }
  },

  // Crear una nueva conversación
  createConversation: async (
    participants: string[],
    participantNames: Record<string, string>,
    participantPhotos?: Record<string, string>,
    businessId?: string,
    businessName?: string,
    initialMessage?: string
  ): Promise<Result<{ conversationId: string, messageId?: string }>> => {
    try {
      if (participants.length < 2) {
        throw new Error('Se requieren al menos 2 participantes');
      }

      const sender = participants[0]; // El primer participante es quien crea la conversación
      
      // Verificar si ya existe una conversación entre estos participantes
      let existingConversation: firebase.firestore.QuerySnapshot;
      
      if (businessId) {
        // Si es relacionado con un negocio, buscar conversación existente con mismo businessId
        existingConversation = await firebase.firestore()
          .collection('conversations')
          .where('participants', 'array-contains', sender)
          .where('businessId', '==', businessId)
          .get();
      } else {
        // Si no hay businessId, simplemente buscar por participantes exactos
        // Esto es una simplificación, en la vida real necesitaríamos una lógica más robusta
        existingConversation = await firebase.firestore()
          .collection('conversations')
          .where('participants', 'array-contains', sender)
          .get();
          
        // Filtrar manualmente para encontrar una conversación con los mismos participantes exactos
        const docs = existingConversation.docs.filter(doc => {
          const convoData = doc.data();
          const participantsArray = convoData.participants || [];
          return participants.every((p: string) => participantsArray.includes(p)) &&
                 participantsArray.every((p: string) => participants.includes(p));
        });
        
        if (docs.length > 0) {
          const conversationId = docs[0].id;
          
          // Si hay un mensaje inicial, enviarlo
          if (initialMessage) {
            const messageResult = await chatService.sendMessage(
              conversationId,
              sender,
              { text: initialMessage },
              participantNames[sender],
              participantPhotos?.[sender]
            );
            
            if (messageResult.success && messageResult.data) {
              return { 
                success: true, 
                data: { 
                  conversationId,
                  messageId: messageResult.data.id
                } 
              };
            }
          }
          
          return { success: true, data: { conversationId } };
        }
      }
      
      // Si no existe, crear nueva conversación
      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      
      // Inicializar contador de no leídos
      const unreadCount: Record<string, number> = {};
      participants.forEach((p: string) => {
        unreadCount[p] = 0;
      });
      
      const conversationRef = firebase.firestore().collection('conversations').doc();
      
      const conversationData: any = {
        participants,
        participantNames,
        unreadCount,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      if (participantPhotos) {
        conversationData.participantPhotos = participantPhotos;
      }
      
      if (businessId) {
        conversationData.businessId = businessId;
      }
      
      if (businessName) {
        conversationData.businessName = businessName;
      }
      
      await conversationRef.set(conversationData);
      
      // Si hay un mensaje inicial, enviarlo
      if (initialMessage) {
        const messageResult = await chatService.sendMessage(
          conversationRef.id,
          sender,
          { text: initialMessage },
          participantNames[sender],
          participantPhotos?.[sender]
        );
        
        if (messageResult.success && messageResult.data) {
          return { 
            success: true, 
            data: { 
              conversationId: conversationRef.id,
              messageId: messageResult.data.id
            } 
          };
        }
      }
      
      return { success: true, data: { conversationId: conversationRef.id } };
    } catch (error) {
      console.error('Error creating conversation:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al crear conversación',
          code: 'chat/create-conversation-failed'
        } 
      };
    }
  },

  // Subir una imagen para un mensaje
  uploadMessageImage: async (uri: string, conversationId: string): Promise<Result<string>> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storageRef = firebase.storage().ref();
      const imageRef = storageRef.child(`chat/${conversationId}/${Date.now()}.jpg`);
      
      await imageRef.put(blob);
      const downloadUrl = await imageRef.getDownloadURL();
      
      return { success: true, data: downloadUrl };
    } catch (error) {
      console.error('Error uploading message image:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al subir imagen de mensaje',
          code: 'chat/upload-image-failed'
        } 
      };
    }
  },

  // Escuchar por cambios en una conversación (para tiempo real)
  listenToConversation: (
    conversationId: string,
    onUpdate: (conversation: Conversation) => void,
    onError: (error: Error) => void
  ): (() => void) => {
    const unsubscribe = firebase.firestore()
      .collection('conversations')
      .doc(conversationId)
      .onSnapshot(
        snapshot => {
          if (snapshot.exists) {
            const conversationData = {
              id: snapshot.id,
              ...snapshot.data()
            } as Conversation;
            onUpdate(conversationData);
          }
        },
        error => {
          console.error('Error listening to conversation:', error);
          onError(error);
        }
      );
      
    return unsubscribe;
  },

  // Escuchar por cambios en los mensajes (para tiempo real)
  listenToMessages: (
    conversationId: string,
    onUpdate: (messages: Message[]) => void,
    onError: (error: Error) => void,
    limit = 50
  ): (() => void) => {
    const unsubscribe = firebase.firestore()
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .onSnapshot(
        snapshot => {
          const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Message[];
          onUpdate(messages);
        },
        error => {
          console.error('Error listening to messages:', error);
          onError(error);
        }
      );
      
    return unsubscribe;
  },

  // Escuchar por cambios en todas las conversaciones de un usuario (para tiempo real)
  listenToUserConversations: (
    userId: string,
    onUpdate: (conversations: Conversation[]) => void,
    onError: (error: Error) => void
  ): (() => void) => {
    const unsubscribe = firebase.firestore()
      .collection('conversations')
      .where('participants', 'array-contains', userId)
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        snapshot => {
          const conversations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Conversation[];
          onUpdate(conversations);
        },
        error => {
          console.error('Error listening to user conversations:', error);
          onError(error);
        }
      );
      
    return unsubscribe;
  }
};

// Integración con el servicio de Firebase general
export const firebaseServiceAddition = {
  chat: chatService
};
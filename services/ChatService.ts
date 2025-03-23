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
      if (!userId) {
        console.error('getUserConversations: missing userId');
        return { success: false, error: { message: 'ID de usuario requerido', code: 'chat/missing-user-id' }};
      }

      const snapshot = await firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];

      // Asegurar que cada conversación tenga las propiedades necesarias
      const validatedConversations = conversations.map(conv => {
        // Asegurar que existe unreadCount con valor por defecto
        if (!conv.unreadCount) {
          conv.unreadCount = {};
          conv.participants.forEach(p => {
            conv.unreadCount[p] = 0;
          });
        }

        // Asegurar que todos los participantes tienen un nombre
        if (!conv.participantNames) {
          conv.participantNames = {};
        }

        return conv;
      });

      return { success: true, data: validatedConversations };
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
      if (!conversationId) {
        console.error('getConversation: missing conversationId');
        return { success: false, error: { message: 'ID de conversación requerido', code: 'chat/missing-conversation-id' }};
      }

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

      // Validar datos mínimos
      if (!conversation.participants || conversation.participants.length < 2) {
        console.warn(`Conversation ${conversationId} has invalid participants data`);
      }

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
      console.log(`ChatService: Sending message to conversation ${conversationId}`);
      
      if (!conversationId) {
        console.error('ChatService: Missing conversationId');
        return { 
          success: false, 
          error: { 
            message: 'ID de conversación no proporcionado',
            code: 'chat/missing-conversation-id'
          } 
        };
      }
      
      if (!senderId) {
        console.error('ChatService: Missing senderId');
        return { 
          success: false, 
          error: { 
            message: 'ID de remitente no proporcionado',
            code: 'chat/missing-sender-id'
          } 
        };
      }
      
      // Verificar que la conversación existe
      const conversationRef = firebase.firestore().collection('conversations').doc(conversationId);
      const conversationDoc = await conversationRef.get();
      
      if (!conversationDoc.exists) {
        console.error('ChatService: Conversation does not exist');
        return { 
          success: false, 
          error: { 
            message: 'La conversación no existe',
            code: 'chat/conversation-not-found'
          } 
        };
      }

      const conversationData = conversationDoc.data() as Conversation;
      const participants = conversationData.participants || [];
      
      // Verificar que el remitente es parte de la conversación
      if (!participants.includes(senderId)) {
        console.error('ChatService: Sender not part of conversation');
        return { 
          success: false, 
          error: { 
            message: 'El remitente no es parte de esta conversación',
            code: 'chat/unauthorized-sender'
          } 
        };
      }
      
      // Verificar si el mensaje tiene contenido
      if (!messageData.text && !messageData.imageUrl) {
        console.error('ChatService: Message has no content');
        return { 
          success: false, 
          error: { 
            message: 'El mensaje no tiene contenido',
            code: 'chat/empty-message'
          } 
        };
      }

      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      const messageRef = conversationRef.collection('messages').doc();

      // Datos del mensaje
      const messageObj: any = {
        id: messageRef.id,
        text: messageData.text || '',
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
      
      // Actualizar contadores de no leídos para todos excepto el remitente
      const unreadCount: Record<string, number> = conversationData.unreadCount ? { ...conversationData.unreadCount } : {};
      participants.forEach(participantId => {
        if (participantId !== senderId) {
          unreadCount[participantId] = (unreadCount[participantId] || 0) + 1;
        }
      });

      // Actualizar transacción atomica
      try {
        await firebase.firestore().runTransaction(async transaction => {
          // Agregar mensaje
          transaction.set(messageRef, messageObj);
          
          // Actualizar conversación
          transaction.update(conversationRef, {
            lastMessage: {
              text: messageData.text || (messageData.imageUrl ? '[Imagen]' : ''),
              senderId,
              timestamp
            },
            unreadCount,
            updatedAt: timestamp
          });
        });
        
        console.log('ChatService: Message sent successfully');
        
        // Devolver el mensaje con timestamp actualizado para la interfaz
        const message: Message = {
          ...messageObj,
          timestamp: firebase.firestore.Timestamp.now(),
        };

        return { success: true, data: message };
      } catch (transactionError) {
        console.error('ChatService: Transaction failed:', transactionError);
        return { 
          success: false, 
          error: { 
            message: 'Error al guardar el mensaje en la base de datos',
            code: 'chat/transaction-failed'
          } 
        };
      }
    } catch (error) {
      console.error('ChatService: Error sending message:', error);
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
      if (!conversationId || !userId) {
        return { 
          success: false, 
          error: { 
            message: 'ID de conversación y usuario requeridos',
            code: 'chat/missing-parameters'
          } 
        };
      }

      const conversationRef = firebase.firestore().collection('conversations').doc(conversationId);
      
      // Verificar que la conversación existe
      const conversationDoc = await conversationRef.get();
      if (!conversationDoc.exists) {
        return { 
          success: false, 
          error: { 
            message: 'La conversación no existe',
            code: 'chat/conversation-not-found'
          } 
        };
      }

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
      let existingConversationId: string | null = null;
      
      if (businessId) {
        // Buscar conversación existente con mismo businessId y participantes
        const existingQuery = await firebase.firestore()
          .collection('conversations')
          .where('participants', 'array-contains', sender)
          .where('businessId', '==', businessId)
          .get();
        
        // Verificar exactamente los mismos participantes
        existingQuery.docs.forEach(doc => {
          const data = doc.data();
          const docParticipants = data.participants || [];
          
          // Verificar que contenga exactamente los mismos participantes (sin importar el orden)
          const hasSameParticipants = 
            participants.every(p => docParticipants.includes(p)) && 
            docParticipants.every(p => participants.includes(p));
          
          if (hasSameParticipants) {
            existingConversationId = doc.id;
          }
        });
      } else {
        // Buscar conversación sin businessId entre los mismos participantes
        const existingQuery = await firebase.firestore()
          .collection('conversations')
          .where('participants', 'array-contains', sender)
          .get();
        
        existingQuery.docs.forEach(doc => {
          const data = doc.data();
          // Solo considerar si no tiene businessId
          if (data.businessId) {
            return;
          }
          
          const docParticipants = data.participants || [];
          // Verificar mismos participantes
          const hasSameParticipants = 
            participants.every(p => docParticipants.includes(p)) && 
            docParticipants.every(p => participants.includes(p));
          
          if (hasSameParticipants) {
            existingConversationId = doc.id;
          }
        });
      }
      
      // Si ya existe, usar esa conversación
      if (existingConversationId) {
        console.log(`Using existing conversation: ${existingConversationId}`);
        
        // Si hay un mensaje inicial, enviarlo
        if (initialMessage) {
          const messageResult = await chatService.sendMessage(
            existingConversationId,
            sender,
            { text: initialMessage },
            participantNames[sender],
            participantPhotos?.[sender]
          );
          
          if (messageResult.success && messageResult.data) {
            return { 
              success: true, 
              data: { 
                conversationId: existingConversationId,
                messageId: messageResult.data.id
              } 
            };
          }
        }
        
        return { success: true, data: { conversationId: existingConversationId } };
      }
      
      // Si no existe, crear nueva conversación
      console.log('Creating new conversation');
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
      console.log(`Created new conversation with ID: ${conversationRef.id}`);
      
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
    console.log(`Configurando listener para mensajes de conversación: ${conversationId}`);
    
    try {
      const unsubscribe = firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .onSnapshot(
          (snapshot) => {
            console.log(`Listener de mensajes recibió actualización: ${snapshot.docs.length} mensajes`);
            
            if (snapshot.empty) {
              console.log('No hay mensajes en esta conversación');
              onUpdate([]);
              return;
            }
            
            const messages = snapshot.docs.map(doc => {
              const data = doc.data();
              console.log(`Mensaje procesado: ${doc.id} - Tipo: ${data.type || 'text'}`);
              
              // Asegurarse de que los campos obligatorios existan
              return {
                id: doc.id,
                text: data.text || '',
                senderId: data.senderId || '',
                senderName: data.senderName || '',
                senderPhoto: data.senderPhoto || '',
                timestamp: data.timestamp || firebase.firestore.Timestamp.now(),
                read: data.read || false,
                type: data.type || 'text',
                imageUrl: data.imageUrl || undefined
              } as Message;
            });
            
            onUpdate(messages);
          },
          (error) => {
            console.error('Error en listener de mensajes:', error);
            onError(error);
          }
        );
        
      return unsubscribe;
    } catch (error) {
      console.error('Error al configurar listener de mensajes:', error);
      onError(error as Error);
      // Retornar una función vacía como fallback
      return () => {};
    }
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
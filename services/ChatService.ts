import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { Message, Conversation, NewMessageData, ChatResult, MessageStatus, MessageType, ReplyInfo } from '../models/chatTypes';
import { getCurrentTimestamp, normalizeTimestamp, isValidURL, sanitizeText } from '../src/utils/chatUtils';

/**
 * Chat Service - Handles all Firebase interactions for the chat functionality
 */
export const chatService = {
  // Get conversations for a user
  getUserConversations: async (userId: string): Promise<ChatResult<Conversation[]>> => {
    try {
      if (!userId) {
        console.error('[ChatService] getUserConversations: missing userId');
        return { 
          success: false, 
          error: { 
            message: 'ID de usuario requerido', 
            code: 'chat/missing-user-id' 
          }
        };
      }

      console.log(`[ChatService] Fetching conversations for user ${userId}`);

      // Get all conversations for the user
      const snapshot = await firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      console.log(`[ChatService] Retrieved ${snapshot.docs.length} conversations from Firestore`);

      // Strictly filter conversations marked as deleted
      const conversations = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          
          // Check if conversation is marked as deleted for this user
          const isDeleted = data.deletedFor && data.deletedFor[userId] === true;
          
          if (isDeleted) {
            console.log(`[ChatService] Filtering out deleted conversation: ${doc.id}`);
          }
          
          return !isDeleted;
        })
        .map(doc => {
          const data = doc.data();
          
          // Normalize timestamps
          const createdAt = normalizeTimestamp(data.createdAt);
          const updatedAt = normalizeTimestamp(data.updatedAt);
          
          let lastMessage = data.lastMessage;
          if (lastMessage) {
            lastMessage = {
              ...lastMessage,
              timestamp: normalizeTimestamp(lastMessage.timestamp)
            };
          }
          
          return {
            id: doc.id,
            ...data,
            createdAt,
            updatedAt,
            lastMessage
          };
        }) as Conversation[];

      console.log(`[ChatService] After filtering, ${conversations.length} conversations remain`);

      // Ensure each conversation has required properties with default values
      const validatedConversations = conversations.map(conv => {
        // Ensure unreadCount exists with default value
        if (!conv.unreadCount) {
          conv.unreadCount = {};
          conv.participants.forEach((p: string) => {
            conv.unreadCount[p] = 0;
          });
        }

        // Ensure all participants have a name
        if (!conv.participantNames) {
          conv.participantNames = {};
          conv.participants.forEach((p: string) => {
            conv.participantNames[p] = 'Usuario';
          });
        }

        return conv;
      });

      return { success: true, data: validatedConversations };
    } catch (error) {
      console.error('[ChatService] Error getting conversations:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al obtener conversaciones',
          code: 'chat/get-conversations-failed',
          originalError: error
        } 
      };
    }
  },

  // Get a specific conversation
  getConversation: async (conversationId: string): Promise<ChatResult<Conversation>> => {
    try {
      if (!conversationId) {
        console.error('[ChatService] getConversation: missing conversationId');
        return { 
          success: false, 
          error: { 
            message: 'ID de conversación requerido', 
            code: 'chat/missing-conversation-id'
          }
        };
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

      const data = doc.data();
      
      // Normalize timestamps
      const createdAt = normalizeTimestamp(data?.createdAt);
      const updatedAt = normalizeTimestamp(data?.updatedAt);
      
      let lastMessage = data?.lastMessage;
      if (lastMessage) {
        lastMessage = {
          ...lastMessage,
          timestamp: normalizeTimestamp(lastMessage.timestamp)
        };
      }
      
      const conversation = {
        id: doc.id,
        ...data,
        createdAt,
        updatedAt,
        lastMessage
      } as Conversation;

      // Validate minimum data
      if (!conversation.participants || conversation.participants.length < 1) {
        console.warn(`[ChatService] Conversation ${conversationId} has invalid participants data`);
      }

      return { success: true, data: conversation };
    } catch (error) {
      console.error('[ChatService] Error getting conversation:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al obtener la conversación',
          code: 'chat/get-conversation-failed',
          originalError: error
        } 
      };
    }
  },

  // Get messages for a conversation
  getMessages: async (conversationId: string, limit = 50): Promise<ChatResult<Message[]>> => {
    try {
      if (!conversationId) {
        console.error('[ChatService] getMessages: missing conversationId');
        return { 
          success: false, 
          error: { 
            message: 'ID de conversación requerido', 
            code: 'chat/missing-conversation-id'
          }
        };
      }
      
      const snapshot = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Normalize the timestamp
        const timestamp = normalizeTimestamp(data.timestamp);
        
        return {
          id: doc.id,
          ...data,
          timestamp,
          // Ensure message type is valid
          type: data.type || MessageType.TEXT,
          // Ensure read property exists
          read: data.read === true
        } as Message;
      });

      return { success: true, data: messages };
    } catch (error) {
      console.error('[ChatService] Error getting messages:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al obtener mensajes',
          code: 'chat/get-messages-failed',
          originalError: error
        } 
      };
    }
  },

  // Send a message
  sendMessage: async (
    conversationId: string, 
    senderId: string,
    messageData: NewMessageData,
    senderName?: string,
    senderPhoto?: string,
    replyTo?: ReplyInfo
  ): Promise<ChatResult<Message>> => {
    try {
      console.log(`[ChatService] Sending message to conversation ${conversationId}`);
      
      if (!conversationId) {
        console.error('[ChatService] SendMessage: Missing conversationId');
        return { 
          success: false, 
          error: { 
            message: 'ID de conversación no proporcionado',
            code: 'chat/missing-conversation-id'
          } 
        };
      }
      
      if (!senderId) {
        console.error('[ChatService] SendMessage: Missing senderId');
        return { 
          success: false, 
          error: { 
            message: 'ID de remitente no proporcionado',
            code: 'chat/missing-sender-id'
          } 
        };
      }
      
      // Verify conversation exists
      const conversationRef = firebase.firestore().collection('conversations').doc(conversationId);
      const conversationDoc = await conversationRef.get();
      
      if (!conversationDoc.exists) {
        console.error('[ChatService] SendMessage: Conversation does not exist');
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
      
      // Verify sender is part of the conversation
      if (!participants.includes(senderId)) {
        console.error('[ChatService] SendMessage: Sender not part of conversation');
        return { 
          success: false, 
          error: { 
            message: 'El remitente no es parte de esta conversación',
            code: 'chat/unauthorized-sender'
          } 
        };
      }
      
      // Verify message has content
      const cleanText = sanitizeText(messageData.text || '');
      if (!cleanText && !messageData.imageUrl) {
        console.error('[ChatService] SendMessage: Message has no content');
        return { 
          success: false, 
          error: { 
            message: 'El mensaje no tiene contenido',
            code: 'chat/empty-message'
          } 
        };
      }
      
      // Verify URL if it's an image message
      if (messageData.imageUrl && !isValidURL(messageData.imageUrl)) {
        console.error('[ChatService] SendMessage: Invalid image URL');
        return { 
          success: false, 
          error: { 
            message: 'URL de imagen no válida',
            code: 'chat/invalid-image-url'
          } 
        };
      }

      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      const messageRef = conversationRef.collection('messages').doc();

      // Message data
      const messageObj: any = {
        id: messageRef.id,
        text: cleanText,
        senderId,
        senderName: senderName || '',
        senderPhoto: senderPhoto || '',
        timestamp,
        status: MessageStatus.SENT,
        read: false,
        type: messageData.type || MessageType.TEXT,
      };

      if (messageData.imageUrl) {
        messageObj.imageUrl = messageData.imageUrl;
      }
      
      if (messageData.metadata) {
        messageObj.metadata = messageData.metadata;
      }
      
      // Añadir información de respuesta si es una respuesta
      if (replyTo) {
        // Limpiar objeto replyTo para evitar valores undefined que Firestore no acepta
        const sanitizedReplyTo: ReplyInfo = {
          messageId: replyTo.messageId,
          text: replyTo.text || '',
          senderId: replyTo.senderId,
          type: replyTo.type,
          senderName: replyTo.senderName || ''
        };
        
        // Solo incluir imageUrl si existe, Firestore no acepta undefined
        if (replyTo.imageUrl) {
          sanitizedReplyTo.imageUrl = replyTo.imageUrl;
        }
        
        messageObj.replyTo = sanitizedReplyTo;
      }
      
      // Update unread counts for everyone except sender
      const unreadCount: Record<string, number> = conversationData.unreadCount ? { ...conversationData.unreadCount } : {};
      participants.forEach((participantId: string) => {
        if (participantId !== senderId) {
          unreadCount[participantId] = (unreadCount[participantId] || 0) + 1;
        } else {
          // Ensure sender has an entry with 0 unread
          unreadCount[participantId] = 0;
        }
      });

      // Atomic transaction
      try {
        await firebase.firestore().runTransaction(async transaction => {
          // Add message
          transaction.set(messageRef, messageObj);
          
          // Update conversation
          transaction.update(conversationRef, {
            lastMessage: {
              text: cleanText || (messageData.imageUrl ? '[Imagen]' : ''),
              senderId,
              timestamp
            },
            unreadCount,
            updatedAt: timestamp,
            // If conversation was deleted for any user, mark as undeleted
            deletedFor: participants.reduce((acc, id) => {
              acc[id] = false;
              return acc;
            }, {} as Record<string, boolean>)
          });
        });
        
        console.log('[ChatService] Message sent successfully');
        
        // Enviar notificaciones cuando se reciben mensajes nuevos
        try {
          // Solo en desarrollo, enviar notificación local para pruebas
          if (__DEV__) {
            try {
              // Importar el servicio de notificaciones de manera dinámica
              const { notificationService } = require('../services/NotificationService');
              
              // Preparar datos para la notificación
              const senderDisplayName = senderName || 'Usuario';
              
              // Crear texto para la notificación
              const notificationBody = messageData.imageUrl 
                ? `${senderDisplayName} te ha enviado una imagen` 
                : cleanText.length > 100 
                  ? `${cleanText.substring(0, 100)}...` 
                  : cleanText;
              
              // Enviar una notificación local para pruebas
              // Esto evita los problemas de permisos con Firestore
              await notificationService.sendLocalNotification(
                senderDisplayName,
                notificationBody,
                {
                  type: 'chat',
                  conversationId: conversationId,
                  messageId: messageRef.id
                }
              );
              
              console.log('[ChatService] Sent local notification for development testing');
            } catch (localNotificationError) {
              console.error('[ChatService] Error sending local notification:', localNotificationError);
            }
          } else {
            // En producción, registramos la intención pero no hacemos consultas a Firestore
            // para evitar errores de permisos
            
            // Identificar otros participantes
            const otherParticipants = participants.filter(id => id !== senderId);
            
            if (otherParticipants.length > 0) {
              console.log(`[ChatService] In production, would send notifications to ${otherParticipants.length} participants`);
              // En producción, esto sería manejado por Cloud Functions con los permisos adecuados
            }
          }
        } catch (notificationError) {
          // No queremos que un error de notificación haga fallar el envío del mensaje
          console.error('[ChatService] Error in notification handling:', notificationError);
        }
        
        // Return message with current timestamp for UI
        const message: Message = {
          ...messageObj,
          timestamp: getCurrentTimestamp(),
        };

        return { success: true, data: message };
      } catch (transactionError) {
        console.error('[ChatService] Transaction failed:', transactionError);
        return { 
          success: false, 
          error: { 
            message: 'Error al guardar el mensaje en la base de datos',
            code: 'chat/transaction-failed',
            originalError: transactionError
          } 
        };
      }
    } catch (error) {
      console.error('[ChatService] Error sending message:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al enviar mensaje',
          code: 'chat/send-message-failed',
          originalError: error
        } 
      };
    }
  },

  // Mark messages as read
  markMessagesAsRead: async (conversationId: string, userId: string): Promise<ChatResult<void>> => {
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
      
      // Verify conversation exists
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

      // Get unread messages sent by others
      const snapshot = await conversationRef
        .collection('messages')
        .where('read', '==', false)
        .where('senderId', '!=', userId)
        .get();
      
      if (snapshot.empty) {
        // No messages to mark
        return { success: true };
      }

      // Update in a transaction
      await firebase.firestore().runTransaction(async transaction => {
        // Mark each message as read
        snapshot.docs.forEach(doc => {
          transaction.update(doc.ref, { 
            read: true,
            status: MessageStatus.READ
          });
        });
        
        // Update unread count to 0 for this user
        transaction.update(conversationRef, {
          [`unreadCount.${userId}`]: 0
        });
      });

      return { success: true };
    } catch (error) {
      console.error('[ChatService] Error marking messages as read:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al marcar mensajes como leídos',
          code: 'chat/mark-read-failed',
          originalError: error
        } 
      };
    }
  },

  // Create a new conversation
  createConversation: async (
    participants: string[],
    participantNames: Record<string, string>,
    participantPhotos?: Record<string, string>,
    businessId?: string,
    businessName?: string,
    initialMessage?: string
  ): Promise<ChatResult<{ conversationId: string, messageId?: string }>> => {
    try {
      if (participants.length < 2) {
        throw new Error('Se requieren al menos 2 participantes');
      }

      const sender = participants[0]; // First participant is the creator
      
      // Check if a conversation already exists between these participants
      let existingConversationId: string | null = null;
      
      if (businessId) {
        // Look for existing conversation with same businessId and participants
        const existingQuery = await firebase.firestore()
          .collection('conversations')
          .where('participants', 'array-contains', sender)
          .where('businessId', '==', businessId)
          .get();
        
        // Check for exactly the same participants
        existingQuery.docs.forEach(doc => {
          const data = doc.data();
          const docParticipants = data.participants || [];
          
          // Check if contains exactly the same participants (regardless of order)
          const hasSameParticipants = 
            participants.every((p: string) => docParticipants.includes(p)) && 
            docParticipants.every((p: string) => participants.includes(p));
          
          if (hasSameParticipants) {
            // If it was marked as deleted for this user, unmark it
            if (data.deletedFor && data.deletedFor[sender]) {
              firebase.firestore()
                .collection('conversations')
                .doc(doc.id)
                .update({
                  [`deletedFor.${sender}`]: false,
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                })
                .catch(err => console.error('[ChatService] Error unmarking conversation as deleted:', err));
            }
            
            existingConversationId = doc.id;
          }
        });
      } else {
        // Look for conversation without businessId between the same participants
        const existingQuery = await firebase.firestore()
          .collection('conversations')
          .where('participants', 'array-contains', sender)
          .get();
        
        existingQuery.docs.forEach(doc => {
          const data = doc.data();
          // Only consider if it doesn't have a businessId
          if (data.businessId) {
            return;
          }
          
          const docParticipants = data.participants || [];
          // Check if same participants
          const hasSameParticipants = 
            participants.every((p: string) => docParticipants.includes(p)) && 
            docParticipants.every((p: string) => participants.includes(p));
          
          if (hasSameParticipants) {
            // If it was marked as deleted for this user, unmark it
            if (data.deletedFor && data.deletedFor[sender]) {
              firebase.firestore()
                .collection('conversations')
                .doc(doc.id)
                .update({
                  [`deletedFor.${sender}`]: false,
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                })
                .catch(err => console.error('[ChatService] Error unmarking conversation as deleted:', err));
            }
            
            existingConversationId = doc.id;
          }
        });
      }
      
      // If it already exists, use that conversation
      if (existingConversationId) {
        console.log(`[ChatService] Using existing conversation: ${existingConversationId}`);
        
        // If there's an initial message, send it
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
      
      // If it doesn't exist, create a new conversation
      console.log('[ChatService] Creating new conversation');
      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      
      // Initialize unread counts
      const unreadCount: Record<string, number> = {};
      participants.forEach((p: string) => {
        unreadCount[p] = 0;
      });
      
      // Initialize deletedFor state
      const deletedFor: Record<string, boolean> = {};
      participants.forEach((p: string) => {
        deletedFor[p] = false;
      });
      
      const conversationRef = firebase.firestore().collection('conversations').doc();
      
      const conversationData: any = {
        participants,
        participantNames,
        unreadCount,
        deletedFor,
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
      console.log(`[ChatService] Created new conversation with ID: ${conversationRef.id}`);
      
      // If there's an initial message, send it
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
      console.error('[ChatService] Error creating conversation:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al crear conversación',
          code: 'chat/create-conversation-failed',
          originalError: error
        } 
      };
    }
  },

  // Upload an image for a message
  uploadMessageImage: async (uri: string, conversationId: string): Promise<ChatResult<string>> => {
    try {
      // Validate input
      if (!uri || !conversationId) {
        return {
          success: false,
          error: {
            message: 'URI y ID de conversación son requeridos',
            code: 'chat/missing-parameters'
          }
        };
      }
      
      // Verificar que el usuario esté autenticado
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        console.error('[ChatService] No user is logged in for uploading image');
        return {
          success: false,
          error: {
            message: 'Debe iniciar sesión para subir imágenes',
            code: 'chat/authentication-required'
          }
        };
      }
      
      console.log(`[ChatService] Uploading image for conversation ${conversationId} by user ${currentUser.uid}`);
      
      try {
        // Fetch the image
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Validate blob
        if (!blob || blob.size === 0) {
          return {
            success: false,
            error: {
              message: 'No se pudo obtener la imagen',
              code: 'chat/invalid-image'
            }
          };
        }
        
        // Cambiar la ruta de almacenamiento para usar el directorio del usuario
        // Esto ayudará con los permisos si las reglas de seguridad permiten a los usuarios
        // escribir sólo en sus propios directorios
        const timestamp = Date.now();
        const fileName = `${timestamp}.jpg`;
        
        // Usar una ruta que incluya el ID del usuario para mejor gestión de permisos
        // Formato: message_images/{userId}/{conversationId}/{timestamp}.jpg
        const imageRef = firebase.storage()
          .ref()
          .child(`message_images/${currentUser.uid}/${conversationId}/${fileName}`);
        
        // Set metadata for caching
        const metadata = {
          contentType: 'image/jpeg',
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
          customMetadata: {
            'userId': currentUser.uid,
            'conversationId': conversationId,
            'uploadTime': timestamp.toString()
          }
        };
        
        console.log(`[ChatService] Starting upload to path: message_images/${currentUser.uid}/${conversationId}/${fileName}`);
        
        // Subir la imagen con los metadatos
        const uploadTask = await imageRef.put(blob, metadata);
        console.log('[ChatService] Upload completed, getting download URL');
        
        // Obtener la URL de descarga
        const downloadUrl = await imageRef.getDownloadURL();
        console.log(`[ChatService] Image uploaded successfully. URL length: ${downloadUrl.length}`);
        
        return { success: true, data: downloadUrl };
      } catch (uploadError) {
        // Intentar subir a un directorio alternativo en caso de fallo
        console.error('[ChatService] First upload attempt failed, trying alternate location:', uploadError);
        
        try {
          // Alternativa: Intentar un directorio público
          const timestamp = Date.now();
          const imageRef = firebase.storage()
            .ref()
            .child(`public_uploads/chat_images/${timestamp}.jpg`);
            
          // Fetch the image again
          const response = await fetch(uri);
          const blob = await response.blob();
            
          await imageRef.put(blob, { contentType: 'image/jpeg' });
          const downloadUrl = await imageRef.getDownloadURL();
          
          console.log('[ChatService] Successfully uploaded to alternate location');
          return { success: true, data: downloadUrl };
        } catch (altError) {
          console.error('[ChatService] Both upload attempts failed:', altError);
          throw altError; // Propagar para que el catch externo lo maneje
        }
      }
    } catch (error) {
      console.error('[ChatService] Error uploading message image:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al subir imagen de mensaje',
          code: 'chat/upload-image-failed',
          originalError: error
        } 
      };
    }
  },

  // Delete (mark as deleted) a conversation
  deleteConversation: async (conversationId: string, userId: string): Promise<ChatResult<void>> => {
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

      // Verify conversation exists
      const conversationRef = firebase.firestore().collection('conversations').doc(conversationId);
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
      
      // Verify user is part of the conversation
      const conversationData = conversationDoc.data();
      if (!conversationData?.participants.includes(userId)) {
        return { 
          success: false, 
          error: { 
            message: 'No tienes permiso para eliminar esta conversación', 
            code: 'chat/unauthorized' 
          } 
        };
      }
      
      console.log(`[ChatService] Marking conversation ${conversationId} as deleted for user ${userId}`);
      
      try {
        // Using soft delete strategy
        await conversationRef.update({
          [`deletedFor.${userId}`]: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`[ChatService] Conversation ${conversationId} marked as deleted for user ${userId}`);
        return { success: true };
      } catch (updateError) {
        console.error('[ChatService] Error marking conversation as deleted:', updateError);
        return { 
          success: false, 
          error: { 
            message: 'Error al marcar la conversación como eliminada',
            code: 'chat/update-failed',
            originalError: updateError
          } 
        };
      }
    } catch (error) {
      console.error('[ChatService] Error deleting conversation:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al eliminar conversación',
          code: 'chat/delete-failed',
          originalError: error
        } 
      };
    }
  },

  // Listen for changes in a conversation (real-time)
  listenToConversation: (
    conversationId: string,
    onUpdate: (conversation: Conversation) => void,
    onError: (error: Error) => void
  ): (() => void) => {
    try {
      if (!conversationId) {
        const error = new Error('ID de conversación requerido');
        onError(error);
        return () => {}; // Return empty function as fallback
      }
      
      const unsubscribe = firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .onSnapshot(
          {
            includeMetadataChanges: true,
          },
          (snapshot) => {
            if (snapshot.exists) {
              const data = snapshot.data();
              
              // Normalize timestamps
              const createdAt = normalizeTimestamp(data?.createdAt);
              const updatedAt = normalizeTimestamp(data?.updatedAt);
              
              let lastMessage = data?.lastMessage;
              if (lastMessage) {
                lastMessage = {
                  ...lastMessage,
                  timestamp: normalizeTimestamp(lastMessage.timestamp)
                };
              }
              
              const conversationData = {
                id: snapshot.id,
                ...data,
                createdAt,
                updatedAt,
                lastMessage
              } as Conversation;
              
              onUpdate(conversationData);
            }
          },
          error => {
            console.error('[ChatService] Error listening to conversation:', error);
            onError(error);
          }
        );
        
      return unsubscribe;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error desconocido');
      console.error('[ChatService] Error setting up conversation listener:', err);
      onError(err);
      return () => {}; // Return empty function as fallback
    }
  },

  // Listen for changes in messages (real-time)
  listenToMessages: (
    conversationId: string,
    onUpdate: (messages: Message[]) => void,
    onError: (error: Error) => void,
    limit = 50
  ): (() => void) => {
    try {
      if (!conversationId) {
        const error = new Error('ID de conversación requerido');
        onError(error);
        return () => {}; // Return empty function as fallback
      }
      
      console.log(`[ChatService] Setting up message listener for conversation: ${conversationId}`);
      
      // Use more robust approach to sort messages
      const unsubscribe = firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .onSnapshot(
          // First parameter: options object with includeMetadataChanges
          { includeMetadataChanges: true },
          // Second parameter: observer object with next and error callbacks
          {
            next: (snapshot) => {
              // Check if we have server data or just cache
              const hasServerData = snapshot.metadata.fromCache === false;
              console.log(`[ChatService] Message listener update: ${snapshot.docs.length} messages, server data: ${hasServerData}`);
              
              if (snapshot.empty) {
                console.log('[ChatService] No messages in this conversation');
                onUpdate([]);
                return;
              }
              
              // Process messages
              const messagesData = snapshot.docs.map(doc => {
                const data = doc.data();
                
                // Normalize timestamp
                const timestamp = normalizeTimestamp(data.timestamp);
                
                // Build normalized Message object
                return {
                  id: doc.id,
                  text: data.text || '',
                  senderId: data.senderId || '',
                  senderName: data.senderName || '',
                  senderPhoto: data.senderPhoto || '',
                  timestamp: timestamp,
                  status: data.status || MessageStatus.SENT,
                  read: !!data.read,
                  type: data.type || MessageType.TEXT,
                  imageUrl: data.imageUrl || undefined,
                  metadata: data.metadata || undefined
                } as Message;
              });
              
              // Sort messages by timestamp (oldest to newest)
              // This is important to display the conversation in the correct order
              const sortedMessages = messagesData.sort((a, b) => {
                const timeA = getMessageTimestamp(a);
                const timeB = getMessageTimestamp(b);
                return timeA - timeB; // Sort from oldest to newest
              });
              
              onUpdate(sortedMessages);
            },
            error: (error) => {
              console.error('[ChatService] Error in message listener:', error);
              onError(error);
            }
          }
        );
        
      return unsubscribe;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error desconocido');
      console.error('[ChatService] Error setting up message listener:', err);
      onError(err);
      return () => {}; // Return empty function as fallback
    }
  },

  // Listen for changes in all user conversations (real-time)
  listenToUserConversations: (
    userId: string,
    onUpdate: (conversations: Conversation[]) => void,
    onError: (error: Error) => void
  ): (() => void) => {
    try {
      if (!userId) {
        const error = new Error('ID de usuario requerido');
        onError(error);
        return () => {}; // Return empty function as fallback
      }
      
      console.log(`[ChatService] Setting up conversations listener for user: ${userId}`);
      
      const unsubscribe = firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .onSnapshot(
          { includeMetadataChanges: true },
          {
            next: (snapshot) => {
              // Log data source (server vs cache)
              const hasServerData = snapshot.metadata.fromCache === false;
              console.log(`[ChatService] Conversation listener update: ${snapshot.docs.length} conversations, server data: ${hasServerData}`);
              
              // Filter deleted conversations
              const conversations = snapshot.docs
                .filter(doc => {
                  const data = doc.data();
                  // Check if conversation was marked as deleted for this user
                  const isDeleted = data.deletedFor && data.deletedFor[userId] === true;
                  return !isDeleted;
                })
                .map(doc => {
                  const data = doc.data();
                  
                  // Normalize timestamps
                  const createdAt = normalizeTimestamp(data.createdAt);
                  const updatedAt = normalizeTimestamp(data.updatedAt);
                  
                  let lastMessage = data.lastMessage;
                  if (lastMessage) {
                    lastMessage = {
                      ...lastMessage,
                      timestamp: normalizeTimestamp(lastMessage.timestamp)
                    };
                  }
                  
                  return {
                    id: doc.id,
                    ...data,
                    createdAt,
                    updatedAt,
                    lastMessage
                  };
                }) as Conversation[];
                
              // Validate conversation data
              const validatedConversations = conversations.map(conv => {
                // Ensure unreadCount exists with default values
                if (!conv.unreadCount) {
                  conv.unreadCount = {};
                  conv.participants.forEach((p: string) => {
                    conv.unreadCount[p] = 0;
                  });
                }
                
                // Ensure participant names exist
                if (!conv.participantNames) {
                  conv.participantNames = {};
                  conv.participants.forEach((p: string) => {
                    conv.participantNames[p] = 'Usuario';
                  });
                }
                
                return conv;
              });
              
              onUpdate(validatedConversations);
            },
            error: (error) => {
              console.error('[ChatService] Error in conversation listener:', error);
              onError(error);
            }
          }
        );
        
      return unsubscribe;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error desconocido');
      console.error('[ChatService] Error setting up conversation listener:', err);
      onError(err);
      return () => {}; // Return empty function as fallback
    }
  },

  // Function to check or create a conversation between user and business owner
  checkOrCreateBusinessConversation: async (
    userId: string,
    userName: string,
    businessOwnerId: string,
    businessOwnerName: string,
    businessId: string,
    businessName: string
  ): Promise<ChatResult<{conversationId: string}>> => {
    try {
      // Validate required data
      if (!userId || !businessOwnerId || !businessId) {
        const missing = [];
        if (!userId) missing.push('userId');
        if (!businessOwnerId) missing.push('businessOwnerId');
        if (!businessId) missing.push('businessId');
        
        console.error(`[ChatService] Missing parameters: ${missing.join(', ')}`);
        return { 
          success: false, 
          error: { 
            message: `Faltan datos obligatorios para crear la conversación: ${missing.join(', ')}`,
            code: 'chat/missing-parameters'
          } 
        };
      }

      // Log all parameters for debugging
      console.log('[ChatService] checkOrCreateBusinessConversation parameters:');
      console.log(`  userId: ${userId}, userName: ${userName}`);
      console.log(`  businessOwnerId: ${businessOwnerId}, businessOwnerName: ${businessOwnerName}`);
      console.log(`  businessId: ${businessId}, businessName: ${businessName}`);

      // Verify that user IDs are different
      if (userId === businessOwnerId) {
        console.log('[ChatService] Cannot create conversation between same user:', userId);
        return { 
          success: false, 
          error: { 
            message: 'No puedes iniciar una conversación contigo mismo',
            code: 'chat/same-user-conversation'
          } 
        };
      }

      console.log(`[ChatService] Checking for existing conversation between ${userId} and ${businessOwnerId} for business ${businessId}`);
      
      // Fetch business main image to use as owner's avatar
      let businessImageUrl: string | undefined;
      try {
        const businessDoc = await firebase.firestore()
          .collection('businesses')
          .doc(businessId)
          .get();
        
        if (businessDoc.exists) {
          const businessData = businessDoc.data();
          if (businessData?.images && Array.isArray(businessData.images) && businessData.images.length > 0) {
            // First look for the main image
            const mainImage = businessData.images.find((img: any) => img && img.isMain);
            if (mainImage && mainImage.url) {
              businessImageUrl = mainImage.url;
            } else if (businessData.images[0].url) {
              // If no main image is marked, use the first one
              businessImageUrl = businessData.images[0].url;
            }
          }
        }
        
        if (businessImageUrl) {
          console.log(`[ChatService] Found business image to use as avatar: ${businessImageUrl}`);
        }
      } catch (imageError) {
        console.error('[ChatService] Error fetching business image:', imageError);
        // Continue without image if there's an error
      }
      
      // MEJORADO: Enfoque más directo para verificar conversaciones existentes
      // 1. Consulta más específica para conversaciones con el usuario y el negocio
      const existingConvQuery = firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .where('businessId', '==', businessId)
        .limit(5); // Limitamos a 5 para evitar cargar demasiados datos
      
      const existingConvSnapshot = await existingConvQuery.get();
      console.log(`[ChatService] Found ${existingConvSnapshot.docs.length} potential existing conversations`);
      
      // 2. Filtrar localmente para encontrar una coincidencia exacta
      let existingConversationId: string | null = null;
      
      if (!existingConvSnapshot.empty) {
        for (const doc of existingConvSnapshot.docs) {
          const data = doc.data();
          
          // Log para depuración
          console.log(`[ChatService] Checking conversation ${doc.id}:`);
          console.log(`  participants: ${JSON.stringify(data.participants || [])}`);
          
          // Verificar participantes exactos
          if (data.participants && 
              data.participants.includes(businessOwnerId) &&
              data.participants.length === 2) {
            
            console.log(`[ChatService] Found matching conversation: ${doc.id}`);
            
            // Si está marcada como eliminada para este usuario, reactivarla
            if (data.deletedFor && data.deletedFor[userId] === true) {
              console.log(`[ChatService] Conversation was deleted, reactivating: ${doc.id}`);
              
              try {
                await firebase.firestore()
                  .collection('conversations')
                  .doc(doc.id)
                  .update({
                    [`deletedFor.${userId}`]: false,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                
                console.log(`[ChatService] Successfully reactivated conversation ${doc.id}`);
              } catch (updateError) {
                console.error('[ChatService] Error reactivating conversation:', updateError);
                // Continuamos y usamos la conversación de todos modos
              }
            }
            
            // Si encontramos una imagen del negocio y la conversación no tiene la foto del propietario,
            // actualicemos la foto en la conversación existente
            if (businessImageUrl && (!data.participantPhotos || !data.participantPhotos[businessOwnerId])) {
              try {
                console.log(`[ChatService] Updating business owner photo in conversation ${doc.id}`);
                
                const participantPhotos = data.participantPhotos || {};
                participantPhotos[businessOwnerId] = businessImageUrl;
                
                await firebase.firestore()
                  .collection('conversations')
                  .doc(doc.id)
                  .update({
                    participantPhotos,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                
                console.log(`[ChatService] Successfully updated business owner photo`);
              } catch (photoUpdateError) {
                console.error('[ChatService] Error updating business owner photo:', photoUpdateError);
                // Continuamos aunque falle la actualización de la foto
              }
            }
            
            existingConversationId = doc.id;
            break;
          }
        }
      }
      
      // Si encontramos una conversación existente, la devolvemos
      if (existingConversationId) {
        console.log(`[ChatService] Using existing conversation: ${existingConversationId}`);
        return { success: true, data: { conversationId: existingConversationId } };
      }
      
      // Si no existe, crear una nueva conversación (enfoque simplificado)
      console.log('[ChatService] No existing conversation found, creating new one');
      
      // Crear referencia para el nuevo documento
      const conversationRef = firebase.firestore().collection('conversations').doc();
      const conversationId = conversationRef.id;
      console.log(`[ChatService] Generated new conversation ID: ${conversationId}`);
      
      // Preparar datos de la conversación
      const participants = [userId, businessOwnerId];
      const participantNames: Record<string, string> = {
        [userId]: userName || 'Usuario',
        [businessOwnerId]: businessOwnerName || 'Propietario'
      };
      
      // Preparar las fotos de los participantes si tenemos la imagen del negocio
      const participantPhotos: Record<string, string> = {};
      if (businessImageUrl) {
        participantPhotos[businessOwnerId] = businessImageUrl;
      }
      
      // Inicializar contadores de no leídos
      const unreadCount: Record<string, number> = {};
      participants.forEach(id => {
        unreadCount[id] = 0;
      });
      
      // Inicializar estado de eliminación
      const deletedFor: Record<string, boolean> = {};
      participants.forEach(id => {
        deletedFor[id] = false;
      });
      
      // Datos completos de la conversación
      const conversationData: any = {
        participants,
        participantNames,
        businessId,
        businessName,
        unreadCount,
        deletedFor,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Agregar fotos de participantes si hay alguna
      if (Object.keys(participantPhotos).length > 0) {
        conversationData.participantPhotos = participantPhotos;
      }
      
      console.log('[ChatService] Creating conversation with data:', JSON.stringify({
        participants,
        participantNames: { ...participantNames },
        businessId,
        businessName,
        hasPhotos: Object.keys(participantPhotos).length > 0
      }));
      
      try {
        // CAMBIO IMPORTANTE: Usar set() directo en lugar de transacción
        // Las transacciones pueden fallar por problemas de conectividad o limitaciones de Firestore
        await conversationRef.set(conversationData);
        
        console.log(`[ChatService] Successfully created conversation with ID: ${conversationId}`);
        return { success: true, data: { conversationId } };
      } catch (error) {
        console.error('[ChatService] Error creating conversation:', error);
        
        // Intento final: Comprobar si la conversación se creó a pesar del error
        try {
          const checkDoc = await conversationRef.get();
          if (checkDoc.exists) {
            console.log(`[ChatService] Conversation was actually created despite error: ${conversationId}`);
            return { success: true, data: { conversationId } };
          }
        } catch (checkError) {
          console.error('[ChatService] Error checking if conversation was created:', checkError);
        }
        
        return { 
          success: false, 
          error: { 
            message: 'Error al crear conversación',
            code: 'chat/create-conversation-failed',
            originalError: error
          } 
        };
      }
    } catch (error) {
      console.error('[ChatService] Unexpected error in checkOrCreateBusinessConversation:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido',
          code: 'chat/business-conversation-failed',
          originalError: error
        } 
      };
    }
  },
};

// Helper functions

// Get message timestamp as a number
function getMessageTimestamp(message: Message): number {
  if (!message.timestamp) return 0;
  
  if (message.timestamp instanceof firebase.firestore.Timestamp) {
    return message.timestamp.toMillis();
  } else if (message.timestamp instanceof Date) {
    return message.timestamp.getTime();
  } else if (typeof message.timestamp === 'string') {
    return new Date(message.timestamp).getTime();
  }
  
  return 0;
}

// Exportamos el servicio directamente
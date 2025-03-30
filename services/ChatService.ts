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

      console.log(`Fetching conversations for user ${userId}`);

      // Obtener todas las conversaciones del usuario
      const snapshot = await firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      console.log(`Retrieved ${snapshot.docs.length} conversations from Firestore`);

      // Filtrar estrictamente conversaciones marcadas como eliminadas
      const conversations = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          
          // Comprobar si la conversación está marcada como eliminada para este usuario
          const isDeleted = data.deletedFor && data.deletedFor[userId] === true;
          
          if (isDeleted) {
            console.log(`Filtering out deleted conversation: ${doc.id}`);
          }
          
          return !isDeleted;
        })
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Conversation[];

      console.log(`After filtering, ${conversations.length} conversations remain`);

      // Asegurar que cada conversación tenga las propiedades necesarias
      const validatedConversations = conversations.map(conv => {
        // Asegurar que existe unreadCount con valor por defecto
        if (!conv.unreadCount) {
          conv.unreadCount = {};
          conv.participants.forEach((p: string) => {
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
      participants.forEach((participantId: string) => {
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
            participants.every((p: string) => docParticipants.includes(p)) && 
            docParticipants.every((p: string) => participants.includes(p));
          
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
            participants.every((p: string) => docParticipants.includes(p)) && 
            docParticipants.every((p: string) => participants.includes(p));
          
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

  // Eliminar (marcar como eliminada) una conversación
  deleteConversation: async (conversationId: string, userId: string): Promise<Result<void>> => {
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

      // Verificar que la conversación existe
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
      
      // Verificar que el usuario es parte de la conversación
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
      
      console.log(`Marking conversation ${conversationId} as deleted for user ${userId}`);
      
      try {
        // Usando la estrategia de marcado como eliminado ("soft delete")
        // Esto funciona dentro de las restricciones de las reglas de seguridad
        await conversationRef.update({
          [`deletedFor.${userId}`]: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Conversation ${conversationId} marked as deleted for user ${userId}`);
        return { success: true };
      } catch (updateError) {
        console.error('Error marking conversation as deleted:', updateError);
        return { 
          success: false, 
          error: { 
            message: 'Error al marcar la conversación como eliminada',
            code: 'chat/update-failed' 
          } 
        };
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al eliminar conversación',
          code: 'chat/delete-failed' 
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
    console.log(`Setting up message listener for conversation: ${conversationId}`);
    
    try {
      // Usar un enfoque más robusto para ordenar mensajes
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
              // Verificar si tenemos datos del servidor o solo del caché
              const hasServerData = snapshot.metadata.fromCache === false;
              console.log(`Message listener update: ${snapshot.docs.length} messages, server data: ${hasServerData}`);
              
              if (snapshot.empty) {
                console.log('No messages in this conversation');
                onUpdate([]);
                return;
              }
              
              // Procesar mensajes
              const messagesData = snapshot.docs.map(doc => {
                const data = doc.data();
                
                // Normalizar timestamp (este es un área problemática común)
                let timestamp;
                if (data.timestamp) {
                  if (data.timestamp instanceof firebase.firestore.Timestamp) {
                    timestamp = data.timestamp;
                  } else if (typeof data.timestamp === 'object' && data.timestamp.seconds) {
                    // Manejar objetos serializados de Timestamp
                    timestamp = new firebase.firestore.Timestamp(
                      data.timestamp.seconds, 
                      data.timestamp.nanoseconds || 0
                    );
                  } else if (typeof data.timestamp === 'string') {
                    // Convertir string a Date y luego a Timestamp
                    const date = new Date(data.timestamp);
                    timestamp = firebase.firestore.Timestamp.fromDate(date);
                  } else {
                    // Usar tiempo actual como fallback
                    timestamp = firebase.firestore.Timestamp.now();
                  }
                } else {
                  // Si no hay timestamp, usar el actual
                  timestamp = firebase.firestore.Timestamp.now();
                }
                
                // Construir objeto Message normalizado
                return {
                  id: doc.id,
                  text: data.text || '',
                  senderId: data.senderId || '',
                  senderName: data.senderName || '',
                  senderPhoto: data.senderPhoto || '',
                  timestamp: timestamp,
                  read: !!data.read,
                  type: data.type || 'text',
                  imageUrl: data.imageUrl || undefined
                } as Message;
              });
              
              // Ordenar mensajes por timestamp (de más antiguo a más reciente)
              // Esto es importante para mostrar la conversación en el orden correcto
              const sortedMessages = messagesData.sort((a, b) => {
                const timeA = a.timestamp instanceof firebase.firestore.Timestamp 
                  ? a.timestamp.toMillis() 
                  : a.timestamp instanceof Date 
                    ? a.timestamp.getTime() 
                    : typeof a.timestamp === 'string' 
                      ? new Date(a.timestamp).getTime() 
                      : 0;
                      
                const timeB = b.timestamp instanceof firebase.firestore.Timestamp 
                  ? b.timestamp.toMillis() 
                  : b.timestamp instanceof Date 
                    ? b.timestamp.getTime() 
                    : typeof b.timestamp === 'string' 
                      ? new Date(b.timestamp).getTime() 
                      : 0;
                      
                return timeA - timeB; // Ordenar de más antiguo a más reciente
              });
              
              onUpdate(sortedMessages);
            },
            error: (error) => {
              console.error('Error in message listener:', error);
              onError(error);
            }
          }
        );
        
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up message listener:', error);
      onError(error as Error);
      // Devolver una función vacía como fallback
      return () => {};
    }
  },

  // Escuchar por cambios en todas las conversaciones de un usuario (para tiempo real)
  listenToUserConversations: (
    userId: string,
    onUpdate: (conversations: Conversation[]) => void,
    onError: (error: Error) => void
  ): (() => void) => {
    console.log(`Setting up conversations listener for user: ${userId}`);
    
    try {
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
              console.log(`Conversation listener update: ${snapshot.docs.length} conversations, server data: ${hasServerData}`);
              
              // Filter deleted conversations
              const conversations = snapshot.docs
                .filter(doc => {
                  const data = doc.data();
                  // Check if conversation was marked as deleted for this user
                  const isDeleted = data.deletedFor && data.deletedFor[userId] === true;
                  return !isDeleted;
                })
                .map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as Conversation[];
                
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
                }
                
                return conv;
              });
              
              onUpdate(validatedConversations);
            },
            error: (error) => {
              console.error('Error in conversation listener:', error);
              onError(error);
            }
          }
        );
        
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up conversation listener:', error);
      onError(error as Error);
      return () => {};
    }
  },

  // Función adicional para verificar o crear una conversación entre usuario y propietario de negocio
  checkOrCreateBusinessConversation: async (
    userId: string,
    userName: string,
    businessOwnerId: string,
    businessOwnerName: string,
    businessId: string,
    businessName: string
  ): Promise<Result<{conversationId: string}>> => {
    try {
      // Validar datos obligatorios
      if (!userId || !businessOwnerId || !businessId) {
        console.error('checkOrCreateBusinessConversation: missing required parameters');
        return { 
          success: false, 
          error: { 
            message: 'Faltan datos obligatorios para crear la conversación',
            code: 'chat/missing-parameters'
          } 
        };
      }

      // Verificar que los IDs de usuario son diferentes
      if (userId === businessOwnerId) {
        console.log('Cannot create conversation between same user:', userId);
        return { 
          success: false, 
          error: { 
            message: 'No puedes iniciar una conversación contigo mismo',
            code: 'chat/same-user-conversation'
          } 
        };
      }

      console.log(`Checking for existing conversation between ${userId} and ${businessOwnerId} for business ${businessId}`);
      
      // Buscar conversación existente - BÚSQUEDA MEJORADA
      // 1. Primero buscamos todas las conversaciones donde el usuario es participante
      const userConversationsQuery = await firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .get();
      
      // 2. Filtrar localmente para buscar una coincidencia exacta
      let existingConversationId: string | null = null;
      
      if (!userConversationsQuery.empty) {
        for (const doc of userConversationsQuery.docs) {
          const data = doc.data();
          
          // Verificar si es conversación de negocio correcta con los participantes exactos
          if (data.businessId === businessId && 
              data.participants && 
              data.participants.includes(businessOwnerId) &&
              data.participants.length === 2) {
            
            // Verificar si la conversación ha sido eliminada por este usuario
            if (data.deletedFor && data.deletedFor[userId] === true) {
              // La conversación existe pero fue "eliminada" por este usuario
              // Reactivarla en lugar de crear una nueva
              console.log(`Found deleted conversation ${doc.id}, will reactivate it`);
              
              try {
                await firebase.firestore()
                  .collection('conversations')
                  .doc(doc.id)
                  .update({
                    [`deletedFor.${userId}`]: false,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
              } catch (updateError) {
                console.error('Error reactivating conversation:', updateError);
                // Continuamos y crearemos una nueva si es necesario
              }
            }
            
            console.log(`Found existing conversation: ${doc.id}`);
            existingConversationId = doc.id;
            break;
          }
        }
      }
      
      // Si existe una conversación, devolverla
      if (existingConversationId) {
        return { success: true, data: { conversationId: existingConversationId } };
      }
      
      // Si no existe, crear una nueva con una transacción
      console.log('Creating new business conversation');
      
      // Usar una transacción para garantizar atomicidad
      const conversationRef = firebase.firestore().collection('conversations').doc();
      const conversationId = conversationRef.id;
      
      const participants = [userId, businessOwnerId];
      const participantNames: Record<string, string> = {
        [userId]: userName || 'Usuario',
        [businessOwnerId]: businessOwnerName || 'Propietario'
      };
      
      // Inicializar contadores no leídos
      const unreadCount: Record<string, number> = {};
      participants.forEach(id => {
        unreadCount[id] = 0;
      });
      
      try {
        await firebase.firestore().runTransaction(async transaction => {
          // Verificar de nuevo si la conversación ya existe (doble comprobación)
          // Esta es una protección contra condiciones de carrera
          // First get matching conversations outside transaction
          const query = firebase.firestore()
            .collection('conversations')
            .where('participants', 'array-contains', userId)
            .where('businessId', '==', businessId);

          const querySnapshot = await query.get();
          
          // Then check each document reference inside transaction
          for (const docSnapshot of querySnapshot.docs) {
            const docRef = firebase.firestore().collection('conversations').doc(docSnapshot.id);
            const transactionDoc = await transaction.get(docRef);
            const data = transactionDoc.data();
            
            if (data?.participants && 
                data.participants.includes(businessOwnerId) &&
                data.participants.length === 2) {
              throw new Error('CONVERSATION_ALREADY_EXISTS:' + docSnapshot.id);
            }
          }
          
          // Si llegamos aquí, podemos crear la nueva conversación
          transaction.set(conversationRef, {
            participants,
            participantNames,
            businessId,
            businessName,
            unreadCount,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        
        console.log(`New conversation successfully created: ${conversationId}`);
        return { success: true, data: { conversationId } };
        
      } catch (transactionError: any) {
        // Manejar el caso especial donde se detecta una conversación existente
        if (transactionError.message && transactionError.message.startsWith('CONVERSATION_ALREADY_EXISTS:')) {
          const existingId = transactionError.message.split(':')[1];
          console.log(`Conversation created concurrently, using existing: ${existingId}`);
          return { success: true, data: { conversationId: existingId } };
        }
        
        // Otros errores
        console.error('Transaction error creating conversation:', transactionError);
        return { 
          success: false, 
          error: { 
            message: 'Error al crear conversación',
            code: 'chat/create-conversation-failed'
          } 
        };
      }
      
    } catch (error) {
      console.error('Error in checkOrCreateBusinessConversation:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido',
          code: 'chat/business-conversation-failed'
        } 
      };
    }
  },
};

// Integración con el servicio de Firebase general
export const firebaseServiceAddition = {
  chat: chatService
};
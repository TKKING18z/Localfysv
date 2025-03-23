import { useEffect, useState, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { chatService } from '../../services/ChatService';
import { Message, Conversation } from '../../models/chatTypes';

interface UseChatProps {
  userId: string;
  conversationId?: string;
}

export function useChat({ userId, conversationId }: UseChatProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cargar la conversación y configurar listeners
  useEffect(() => {
    if (!userId) {
      console.error('useChat hook: missing userId');
      setError('Se requiere un ID de usuario');
      setLoading(false);
      return;
    }
    
    if (!conversationId) {
      // No hay conversationId, esto podría ser normal, así que no mostramos error
      setConversation(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    
    console.log(`useChat hook: Loading conversation ${conversationId} for user ${userId}`);
    setLoading(true);
    setError(null);
    
    let unsubscribeConversation: (() => void) | null = null;
    let unsubscribeMessages: (() => void) | null = null;
    
    const loadChat = async () => {
      try {
        // Cargar datos de la conversación
        const convResult = await chatService.getConversation(conversationId);
        if (!convResult.success || !convResult.data) {
          setError(convResult.error?.message || 'Error al cargar la conversación');
          setLoading(false);
          return;
        }
        
        console.log(`Conversation loaded: ${conversationId}`);
        setConversation(convResult.data);
        
        // Marcar mensajes como leídos - esto lo hacemos aquí y también en ChatScreen
        // para asegurarnos de que los mensajes se marcan como leídos
        try {
          await chatService.markMessagesAsRead(conversationId, userId);
          console.log('Messages marked as read from useChat hook');
        } catch (readError) {
          console.error('Failed to mark messages as read:', readError);
          // No interrumpimos el flujo por este error
        }
        
        // Escuchar cambios en la conversación
        unsubscribeConversation = chatService.listenToConversation(
          conversationId,
          (updatedConversation) => {
            console.log('Conversation update received');
            setConversation(updatedConversation);
          },
          (error) => {
            console.error('Error en actualizaciones de conversación:', error);
          }
        );
        
        // Escuchar cambios en los mensajes
        unsubscribeMessages = chatService.listenToMessages(
          conversationId,
          (updatedMessages) => {
            console.log(`${updatedMessages.length} messages received`);
            setMessages(updatedMessages);
          },
          (error) => {
            console.error('Error en actualizaciones de mensajes:', error);
          }
        );
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading chat:', err);
        setError('Error inesperado al cargar chat');
        setLoading(false);
      }
    };
    
    loadChat();
    
    // Limpiar suscripciones
    return () => {
      console.log('Cleaning up chat subscriptions');
      if (unsubscribeConversation) {
        unsubscribeConversation();
      }
      
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, [userId, conversationId]);
  
  // Función sendMessage mejorada
  const sendMessage = useCallback(async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!userId || !conversationId) {
      console.error('Cannot send message in hook: Missing userId or conversationId');
      return false;
    }
    
    try {
      // Verificar si hay contenido
      const trimmedText = text.trim();
      if (!trimmedText && !imageUrl) {
        console.error('Cannot send empty message');
        return false;
      }
      
      console.log(`Sending message: "${trimmedText.substring(0, 20)}${trimmedText.length > 20 ? '...' : ''}"${imageUrl ? ' with image' : ''}`);
      
      // Si no tenemos la conversación cargada, intentamos obtener los datos mínimos necesarios
      let userNameToUse = 'Usuario';
      let userPhotoToUse = '';
      
      if (!conversation) {
        console.log('No conversation object available, fetching directly from Firebase');
        try {
          const convSnapshot = await firebase.firestore()
            .collection('conversations')
            .doc(conversationId)
            .get();
            
          if (convSnapshot.exists) {
            const data = convSnapshot.data();
            userNameToUse = data?.participantNames?.[userId] || 'Usuario';
            userPhotoToUse = data?.participantPhotos?.[userId] || '';
          }
        } catch (fetchError) {
          console.error('Error fetching conversation for message:', fetchError);
          // Continue with default values
        }
      } else {
        userNameToUse = conversation.participantNames[userId] || 'Usuario';
        userPhotoToUse = conversation.participantPhotos?.[userId] || '';
      }
      
      // Enviar el mensaje
      const result = await chatService.sendMessage(
        conversationId,
        userId,
        {
          text: trimmedText,
          imageUrl,
          type: imageUrl ? 'image' : 'text'
        },
        userNameToUse,
        userPhotoToUse
      );
      
      if (!result.success) {
        console.error('Hook error details:', result.error);
        return false;
      }
      
      console.log('Message sent successfully');
      return true;
    } catch (error) {
      console.error('Error in hook sendMessage:', error);
      return false;
    }
  }, [userId, conversationId, conversation]);
  
  // Función para marcar como leído
  const markAsRead = useCallback(async () => {
    if (!userId || !conversationId) {
      console.log('Cannot mark as read: missing userId or conversationId');
      return;
    }
    
    try {
      console.log(`Marking conversation ${conversationId} as read for user ${userId}`);
      await chatService.markMessagesAsRead(conversationId, userId);
      console.log('Successfully marked as read');
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [userId, conversationId]);
  
  // Función para subir imagen mejorada
  const uploadImage = useCallback(async (uri: string) => {
    if (!conversationId) {
      console.error('Cannot upload image: missing conversationId');
      return null;
    }
    
    try {
      console.log(`Uploading image for conversation ${conversationId}`);
      const result = await chatService.uploadMessageImage(uri, conversationId);
      if (result.success && result.data) {
        console.log('Image uploaded successfully');
        return result.data;
      }
      
      console.error('Failed to upload image:', result.error);
      return null;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  }, [conversationId]);
  
  return { 
    conversation, 
    messages, 
    loading, 
    error, 
    sendMessage, 
    markAsRead,
    uploadImage
  };
}
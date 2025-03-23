import { useEffect, useState } from 'react';
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
    if (!userId || !conversationId) {
      setConversation(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    
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
        
        setConversation(convResult.data);
        
        // Marcar mensajes como leídos
        await chatService.markMessagesAsRead(conversationId, userId);
        
        // Escuchar cambios en la conversación
        unsubscribeConversation = chatService.listenToConversation(
          conversationId,
          (updatedConversation) => {
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
      if (unsubscribeConversation) {
        unsubscribeConversation();
      }
      
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, [userId, conversationId]);
  
  // Enhanced sendMessage function with better error handling
  const sendMessage = async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!userId || !conversationId) {
      console.error('Cannot send message in hook: Missing userId or conversationId');
      console.log('UserId:', userId);
      console.log('ConversationId:', conversationId);
      return false;
    }
    
    try {
      // Directly fetch conversation if we don't have it yet
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
      
      const result = await chatService.sendMessage(
        conversationId,
        userId,
        {
          text,
          imageUrl,
          type: imageUrl ? 'image' : 'text'
        },
        userNameToUse,
        userPhotoToUse
      );
      
      console.log('Hook send result:', result.success);
      
      if (!result.success) {
        console.error('Hook error details:', result.error);
      }
      
      return result.success;
    } catch (error) {
      console.error('Error in hook sendMessage:', error);
      return false;
    }
  };
  
  // Función para marcar como leído
  const markAsRead = async () => {
    if (!userId || !conversationId) {
      return;
    }
    
    try {
      await chatService.markMessagesAsRead(conversationId, userId);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };
  
  // Función para subir imagen
  const uploadImage = async (uri: string) => {
    if (!conversationId) {
      return null;
    }
    
    try {
      const result = await chatService.uploadMessageImage(uri, conversationId);
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };
  
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
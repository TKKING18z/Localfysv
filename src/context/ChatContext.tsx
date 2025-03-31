import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { chatService } from '../../services/ChatService';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from './AuthContext';
import { Conversation, Message, ChatResult, MessageStatus, MessageType } from '../../models/chatTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

interface ChatContextType {
  // State
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeMessages: Message[];
  loading: boolean;
  error: string | null;
  unreadTotal: number;
  isOffline: boolean;
  
  // Actions
  setActiveConversationId: (id: string | null) => void;
  sendMessage: (text: string, imageUrl?: string) => Promise<boolean>;
  createConversation: (userId: string, userName: string, businessId?: string, businessName?: string, initialMessage?: string) => Promise<string | null>;
  markConversationAsRead: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  resendFailedMessage: (messageId: string) => Promise<boolean>;
  uploadImage: (uri: string) => Promise<string | null>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeConversationId, _setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  
  // Initialize network connectivity listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    
    // Check initial connection state
    NetInfo.fetch().then(state => {
      setIsOffline(!state.isConnected);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Define markConversationAsRead early to avoid circular dependency
  const markConversationAsRead = useCallback(async () => {
    if (!user || !activeConversation) {
      console.log('[ChatContext] Cannot mark as read: missing user or active conversation');
      return;
    }
    
    if (isOffline) {
      console.log('[ChatContext] Cannot mark as read: Device is offline');
      return;
    }
    
    try {
      console.log(`[ChatContext] Marking conversation ${activeConversation.id} as read`);
      await chatService.markMessagesAsRead(activeConversation.id, user.uid);
      
      // Update total unread
      const updatedUnreadTotal = unreadTotal - (activeConversation.unreadCount?.[user.uid] || 0);
      setUnreadTotal(Math.max(0, updatedUnreadTotal));
      
      // Update locally
      setConversations(prevConversations => 
        prevConversations.map((conv: Conversation) => 
          conv.id === activeConversation.id 
            ? { 
                ...conv, 
                unreadCount: { 
                  ...conv.unreadCount, 
                  [user.uid]: 0 
                } 
              }
            : conv
        )
      );
      
      // Update active messages to show as read
      setActiveMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.senderId !== user.uid && !msg.read
            ? { ...msg, read: true, status: MessageStatus.READ }
            : msg
        )
      );
      
      console.log('[ChatContext] Successfully marked as read');
    } catch (error) {
      console.error('[ChatContext] Error marking conversation as read:', error);
    }
  }, [user, activeConversation, unreadTotal, isOffline]);
  
  // Effect to automatically clean up duplicate conversations
  useEffect(() => {
    const cleanupDuplicateConversations = async () => {
      if (!user) return;
      
      try {
        // Check if cleanup was done recently (don't do it too often)
        const lastCleanupStr = await AsyncStorage.getItem('last_chat_cleanup');
        if (lastCleanupStr) {
          const lastCleanup = new Date(lastCleanupStr);
          const now = new Date();
          const hoursSinceLastCleanup = (now.getTime() - lastCleanup.getTime()) / (1000 * 60 * 60);
          
          // If done in the last 24 hours, don't do it again
          if (hoursSinceLastCleanup < 24) {
            console.log('[ChatContext] Skipping duplicate conversation cleanup (done recently)');
            return;
          }
        }
        
        console.log('[ChatContext] Running automatic duplicate conversation cleanup');
        
        // Safely check for method existence using type assertion
        const chatService = (firebaseService as any).chat;
        if (chatService?.chatCleanup && 
            typeof chatService.chatCleanup.detectAndMergeDuplicateConversations === 'function') {
          const result = await chatService.chatCleanup.detectAndMergeDuplicateConversations(user.uid);
          console.log('[ChatContext] Cleanup result:', result);
          
          // If there were changes, refresh conversations
          if (result.success) {
            // Save last cleanup timestamp
            await AsyncStorage.setItem('last_chat_cleanup', new Date().toISOString());
            
            // Refresh conversations after a short delay
            setTimeout(() => {
              loadConversations();
            }, 1000);
          }
        } else {
          console.log('[ChatContext] Cleanup method not available in firebaseService');
        }
      } catch (error) {
        console.error('[ChatContext] Error during duplicate conversation cleanup:', error);
      }
    };
    
    // Run cleanup after a delay to not affect initial performance
    let cleanupTimeout: NodeJS.Timeout | null = null;
    if (user) {
      cleanupTimeout = setTimeout(cleanupDuplicateConversations, 5000);
    }
    
    return () => {
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
    };
  }, [user]);
  
  // Function to load all user conversations
  const loadConversations = useCallback(async () => {
    if (!user) {
      console.error('[ChatContext] Cannot load conversations: no user logged in');
      return;
    }
    
    if (isOffline) {
      console.log('[ChatContext] Device is offline, loading from cache if available');
      // Could implement offline mode with cached data here
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[ChatContext] Fetching conversations from service');
      const result = await chatService.getUserConversations(user.uid);
      if (result.success && result.data) {
        console.log(`[ChatContext] Loaded ${result.data.length} conversations`);
        
        // Filter out deleted conversations in case the service didn't do it correctly
        const filteredConversations = result.data.filter((conv: Conversation) => 
          !(conv.deletedFor && conv.deletedFor[user.uid] === true)
        );
        
        console.log(`[ChatContext] After additional filtering, ${filteredConversations.length} conversations remain`);
        setConversations(filteredConversations);
        
        // Calculate total unread based on filtered conversations
        const total = filteredConversations.reduce((sum: number, conv: Conversation) => {
          return sum + (conv.unreadCount?.[user.uid] || 0);
        }, 0);
        
        console.log(`[ChatContext] Total unread messages: ${total}`);
        setUnreadTotal(total);
        
        // Store conversations in AsyncStorage for offline access
        try {
          await AsyncStorage.setItem(
            `user_conversations_${user.uid}`, 
            JSON.stringify({
              conversations: filteredConversations,
              timestamp: new Date().toISOString()
            })
          );
        } catch (cacheError) {
          console.warn('[ChatContext] Failed to cache conversations:', cacheError);
        }
      } else {
        console.error('[ChatContext] Failed to load conversations:', result.error);
        setError(result.error?.message || 'Error al cargar conversaciones');
        
        // Try to load from cache as fallback
        await loadConversationsFromCache();
      }
    } catch (error) {
      console.error('[ChatContext] Unexpected error loading conversations:', error);
      setError('Error inesperado al cargar conversaciones');
      
      // Try to load from cache as fallback
      await loadConversationsFromCache();
    } finally {
      setLoading(false);
    }
  }, [user, isOffline]);
  
  // Load conversations from cache (for offline mode)
  const loadConversationsFromCache = async () => {
    if (!user) return;
    
    try {
      const cachedData = await AsyncStorage.getItem(`user_conversations_${user.uid}`);
      if (cachedData) {
        const { conversations: cachedConversations, timestamp } = JSON.parse(cachedData);
        
        // Check if cache is not too old (e.g., less than 24 hours)
        const cacheTime = new Date(timestamp).getTime();
        const now = new Date().getTime();
        const cacheAgeHours = (now - cacheTime) / (1000 * 60 * 60);
        
        if (cacheAgeHours < 24 && cachedConversations?.length > 0) {
          console.log(`[ChatContext] Using cached conversations (${cachedConversations.length} items, ${cacheAgeHours.toFixed(1)} hours old)`);
          setConversations(cachedConversations);
          
          // Calculate unread from cache
          const cachedUnreadTotal = cachedConversations.reduce((sum: number, conv: Conversation) => {
            return sum + (conv.unreadCount?.[user.uid] || 0);
          }, 0);
          setUnreadTotal(cachedUnreadTotal);
        } else {
          console.log('[ChatContext] Cached conversations too old or empty');
        }
      } else {
        console.log('[ChatContext] No cached conversations found');
      }
    } catch (error) {
      console.error('[ChatContext] Error loading cached conversations:', error);
    }
  };
  
  // Load initial conversations
  useEffect(() => {
    if (user) {
      console.log('[ChatContext] Loading initial conversations for user:', user.uid);
      loadConversations();
    } else {
      console.log('[ChatContext] No user logged in, resetting conversations');
      setConversations([]);
      setActiveConversation(null);
      setActiveMessages([]);
      setUnreadTotal(0);
    }
  }, [user, loadConversations]);
  
  // Load active conversation when ID changes
  useEffect(() => {
    if (activeConversationId && user) {
      console.log(`[ChatContext] Loading active conversation: ${activeConversationId}`);
      loadActiveConversation(activeConversationId);
    } else {
      setActiveConversation(null);
      setActiveMessages([]);
    }
  }, [activeConversationId, user]);

  // Function to update unread count
  const updateUnreadCount = useCallback(() => {
    if (!user || !conversations.length) return;
    
    // Calculate total unread messages
    const total = conversations.reduce((sum: number, conv: Conversation) => {
      return sum + (conv.unreadCount?.[user.uid] || 0);
    }, 0);
    
    setUnreadTotal(total);
    
    // Update badge in tab navigator (optional)
    try {
      // Could add native notification badge integration here
    } catch (error) {
      console.error('[ChatContext] Error updating badge:', error);
    }
  }, [user, conversations]);

  // Effect to ensure unread count is updated when conversations change
  useEffect(() => {
    updateUnreadCount();
  }, [updateUnreadCount]);
  
  // Enhanced method to refresh conversations
  const refreshConversations = useCallback(async () => {
    if (!user) {
      console.error('[ChatContext] Cannot refresh conversations: no user logged in');
      return;
    }
    
    if (isOffline) {
      setError('No hay conexión a internet. Inténtalo de nuevo cuando estés conectado.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[ChatContext] Refreshing conversations for user:', user.uid);
      
      // Implement a timeout to prevent the operation from hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout fetching conversations')), 15000);
      });
      
      // Create a promise that can be canceled with timeout
      const fetchPromise = chatService.getUserConversations(user.uid);
      
      // Use Promise.race to handle timeout case
      const result = await Promise.race([fetchPromise, timeoutPromise]) as ChatResult<Conversation[]>;
      
      if (result.success && result.data) {
        console.log(`[ChatContext] Refreshed ${result.data.length} conversations`);
        
        // Filter deleted conversations
        const filteredConversations = result.data.filter((conv: Conversation) => 
          !(conv.deletedFor && conv.deletedFor[user.uid] === true)
        );
        
        console.log(`[ChatContext] After filtering deleted, ${filteredConversations.length} conversations remain`);
        
        // Sanitize data to avoid rendering problems
        const sanitizedConversations = filteredConversations.map((conv: Conversation) => {
          // Ensure unreadCount exists
          if (!conv.unreadCount) {
            conv.unreadCount = {};
            conv.participants.forEach((p: string) => {
              conv.unreadCount[p] = 0;
            });
          }
          
          // Ensure participantNames exists
          if (!conv.participantNames) {
            conv.participantNames = {};
            conv.participants.forEach((p: string) => {
              conv.participantNames[p] = 'Usuario';
            });
          }
          
          return conv;
        });
        
        setConversations(sanitizedConversations);
        
        // Calculate total unread
        const unreadTotal = sanitizedConversations.reduce((sum: number, conv: Conversation) => {
          return sum + (conv.unreadCount[user.uid] || 0);
        }, 0);
        
        setUnreadTotal(unreadTotal);
        
        // Update cache for offline mode
        try {
          await AsyncStorage.setItem(
            `user_conversations_${user.uid}`, 
            JSON.stringify({
              conversations: sanitizedConversations,
              timestamp: new Date().toISOString()
            })
          );
        } catch (cacheError) {
          console.warn('[ChatContext] Failed to update conversation cache:', cacheError);
        }
      } else {
        console.error('[ChatContext] Failed to refresh conversations:', result.error);
        setError(result.error?.message || 'Error al cargar conversaciones');
      }
    } catch (error) {
      console.error('[ChatContext] Unexpected error refreshing conversations:', error);
      setError('Error inesperado al cargar conversaciones. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [user, isOffline]);
  
  // Load a specific conversation
  const loadActiveConversation = useCallback(async (conversationId: string) => {
    if (!user) {
      console.error('[ChatContext] Cannot load active conversation: no user logged in');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`[ChatContext] Loading conversation data for ${conversationId}`);
      // Load conversation data
      const convResult = await chatService.getConversation(conversationId);
      if (convResult.success && convResult.data) {
        // Check if it's marked as deleted for this user
        if (convResult.data.deletedFor && convResult.data.deletedFor[user.uid]) {
          setError('Esta conversación ya no está disponible');
          setLoading(false);
          return;
        }
        
        setActiveConversation(convResult.data);
        
        // Set up message listener
        const unsubscribe = chatService.listenToMessages(
          conversationId,
          (messages) => {
            console.log(`[ChatContext] Received ${messages.length} messages update`);
            setActiveMessages(messages);
          },
          (error) => {
            console.error('[ChatContext] Error in message listener:', error);
          },
          50 // Get more messages for history
        );
        
        // Mark messages as read
        await markConversationAsRead();
        
        // Return function to cancel subscription
        return unsubscribe;
      } else {
        console.error('[ChatContext] Failed to load conversation:', convResult.error);
        setError(convResult.error?.message || 'Error al cargar conversación');
      }
    } catch (error) {
      console.error('[ChatContext] Unexpected error loading conversation:', error);
      setError('Error inesperado al cargar conversación');
    } finally {
      setLoading(false);
    }
  }, [user, markConversationAsRead]);
  
  // Enhanced setActiveConversationId function
  const setActiveConversationId = useCallback(async (id: string | null) => {
    if (!id) {
      console.log('[ChatContext] Clearing active conversation');
      _setActiveConversationId(null);
      setActiveConversation(null);
      setActiveMessages([]);
      return;
    }
    
    if (isOffline) {
      setError('No hay conexión a internet. No se puede cargar la conversación.');
      return;
    }
    
    try {
      console.log(`[ChatContext] Setting active conversation to ${id}`);
      setLoading(true);
      
      // First verify the conversation exists
      const snapshot = await firebase.firestore()
        .collection('conversations')
        .doc(id)
        .get();
      
      if (!snapshot.exists) {
        console.error(`[ChatContext] Conversation with ID ${id} not found`);
        setError(`La conversación no existe o fue eliminada`);
        _setActiveConversationId(null);
        setLoading(false);
        return;
      }
      
      // Set active conversation ID
      _setActiveConversationId(id);
      
      // Preload data
      const conversationData = {
        id,
        ...snapshot.data()
      } as Conversation;
      setActiveConversation(conversationData);
      
      // Load initial messages
      const messagesSnapshot = await firebase.firestore()
        .collection('conversations')
        .doc(id)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      
      if (!messagesSnapshot.empty) {
        const messages = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        
        // Sort by timestamp ascending for display
        const sortedMessages = messages.sort((a, b) => {
          // Handle different timestamp formats
          const getTime = (msg: Message): number => {
            if (!msg.timestamp) return 0;
            if (msg.timestamp instanceof firebase.firestore.Timestamp) {
              return msg.timestamp.toMillis();
            }
            if (msg.timestamp instanceof Date) {
              return msg.timestamp.getTime();
            }
            if (typeof msg.timestamp === 'string') {
              return new Date(msg.timestamp).getTime();
            }
            return 0;
          };
          
          return getTime(a) - getTime(b);
        });
        
        setActiveMessages(sortedMessages);
      } else {
        setActiveMessages([]);
      }
      
      setLoading(false);
      
      // Mark as read after a short delay
      setTimeout(() => {
        markConversationAsRead().catch(err => {
          console.error('[ChatContext] Error marking conversation as read:', err);
        });
      }, 1000);
    } catch (error) {
      console.error('[ChatContext] Error setting active conversation:', error);
      setError('Error al cargar la conversación');
      _setActiveConversationId(null);
      setLoading(false);
    }
  }, [isOffline, markConversationAsRead]);
  
  // Enhanced send message function
  const sendMessage = useCallback(async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user) {
      console.error('[ChatContext] Cannot send message: Missing user');
      return false;
    }
    
    if (!activeConversation && !activeConversationId) {
      console.error('[ChatContext] Cannot send message: Missing active conversation and ID');
      return false;
    }
    
    if (isOffline) {
      console.error('[ChatContext] Cannot send message: Device is offline');
      return false;
    }
    
    try {
      // Get active conversation ID
      const conversationId = activeConversation?.id || activeConversationId;
      
      if (!conversationId) {
        console.error('[ChatContext] Cannot determine conversation ID for sending message');
        return false;
      }
      
      console.log(`[ChatContext] Sending message in conversation ${conversationId}`);
      
      // Verify conversation exists
      const convDoc = await firebase.firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (!convDoc.exists) {
        console.error(`[ChatContext] Conversation ${conversationId} does not exist`);
        return false;
      }
      
      // Prepare sender data
      const userName = user.displayName || 'Usuario';
      const userPhoto = user.photoURL || '';
      
      // Add optimistic message to UI immediately
      const optimisticId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        text: text.trim(),
        senderId: user.uid,
        senderName: userName,
        senderPhoto: userPhoto,
        timestamp: new Date(),
        status: MessageStatus.SENDING,
        read: false,
        type: imageUrl ? MessageType.IMAGE : MessageType.TEXT,
        imageUrl
      };
      
      // Update UI immediately
      setActiveMessages(prev => [...prev, optimisticMessage]);
      
      // Send message using service
      const result = await chatService.sendMessage(
        conversationId,
        user.uid,
        { 
          text: text.trim(), 
          imageUrl,
          type: imageUrl ? MessageType.IMAGE : MessageType.TEXT
        },
        userName,
        userPhoto
      );
      
      if (!result.success) {
        console.error('[ChatContext] Error sending message:', result.error);
        
        // Update optimistic message to show error
        setActiveMessages(prev => 
          prev.map(msg => 
            msg.id === optimisticId 
              ? { ...msg, status: MessageStatus.ERROR } 
              : msg
          )
        );
        
        return false;
      }
      
      // Replace optimistic message with actual message
      if (result.data) {
        setActiveMessages(prev => 
          prev.map(msg => 
            msg.id === optimisticId ? result.data! : msg
          )
        );
      }
      
      console.log('[ChatContext] Message sent successfully');
      return true;
    } catch (error) {
      console.error('[ChatContext] Unexpected error sending message:', error);
      return false;
    }
  }, [user, activeConversation, activeConversationId, isOffline]);
  
  // Method to resend a failed message
  const resendFailedMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!user || !activeConversationId) {
      return false;
    }
    
    if (isOffline) {
      return false;
    }
    
    // Find the failed message
    const failedMessage = activeMessages.find(msg => msg.id === messageId);
    if (!failedMessage || failedMessage.status !== MessageStatus.ERROR) {
      return false;
    }
    
    try {
      // Remove the failed message from UI
      setActiveMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Resend it
      return await sendMessage(failedMessage.text, failedMessage.imageUrl);
    } catch (error) {
      console.error('[ChatContext] Error resending message:', error);
      return false;
    }
  }, [user, activeConversationId, activeMessages, sendMessage, isOffline]);
  
  // Method to upload image for messages
  const uploadImage = useCallback(async (uri: string): Promise<string | null> => {
    if (!user || !activeConversationId) {
      console.error('[ChatContext] Cannot upload image: Missing user or conversation');
      return null;
    }
    
    if (isOffline) {
      console.error('[ChatContext] Cannot upload image: Device is offline');
      return null;
    }
    
    try {
      const result = await chatService.uploadMessageImage(uri, activeConversationId);
      if (!result.success) {
        console.error('[ChatContext] Error uploading image:', result.error);
        return null;
      }
      
      return result.data || null;
    } catch (error) {
      console.error('[ChatContext] Unexpected error uploading image:', error);
      return null;
    }
  }, [user, activeConversationId, isOffline]);
  
  // Method to create conversation
  const createConversation = useCallback(async (
    recipientId: string,
    recipientName: string,
    businessId?: string,
    businessName?: string,
    initialMessage?: string
  ): Promise<string | null> => {
    if (!user) {
      console.error('[ChatContext] Cannot create conversation: no user logged in');
      return null;
    }
    
    if (isOffline) {
      console.error('[ChatContext] Cannot create conversation: Device is offline');
      return null;
    }
    
    try {
      console.log(`[ChatContext] Creating conversation with ${recipientName} (${recipientId})`);
      
      // Implement retry (up to 3 times)
      const MAX_RETRIES = 3;
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // If it's a business conversation, use the specific method
          if (businessId && businessName) {
            console.log(`[ChatContext] Creating business conversation for business ${businessId}`);
            
            const result = await chatService.checkOrCreateBusinessConversation(
              user.uid,
              user.displayName || 'Usuario',
              recipientId,
              recipientName,
              businessId,
              businessName
            );
            
            if (result.success && result.data) {
              const conversationId = result.data.conversationId;
              console.log(`[ChatContext] Business conversation created/found: ${conversationId}`);
              
              // If there's an initial message, send it
              if (initialMessage && initialMessage.trim()) {
                console.log('[ChatContext] Sending initial message');
                await chatService.sendMessage(
                  conversationId, 
                  user.uid, 
                  { text: initialMessage.trim() },
                  user.displayName || 'Usuario',
                  user.photoURL || undefined
                );
              }
              
              // Refresh conversations in background
              setTimeout(() => {
                refreshConversations().catch(err => {
                  console.error('[ChatContext] Background refresh error:', err);
                });
              }, 500);
              
              return conversationId;
            }
            
            lastError = result.error || new Error('Error creating business conversation');
            console.error(`[ChatContext] Attempt ${attempt} failed:`, lastError);
            
            // If it's an error that can't be resolved by retrying, exit loop
            if (result.error?.code === 'chat/same-user-conversation') {
              break;
            }
            
            // Wait before retrying (exponential backoff)
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          } else {
            // Regular conversation between users
            console.log('[ChatContext] Creating regular user conversation');
            
            // Current code for regular conversations
            const participants = [user.uid, recipientId];
            const participantNames: Record<string, string> = {
              [user.uid]: user.displayName || 'Usuario',
              [recipientId]: recipientName
            };
            
            // Prepare profile photos
            const participantPhotos: Record<string, string> = {};
            if (user.photoURL) {
              participantPhotos[user.uid] = user.photoURL;
            }
            
            const result = await chatService.createConversation(
              participants,
              participantNames,
              participantPhotos,
              undefined, // No businessId
              undefined, // No businessName
              initialMessage
            );
            
            if (result.success && result.data) {
              // Refresh conversations in background
              setTimeout(() => {
                refreshConversations().catch(err => {
                  console.error('[ChatContext] Background refresh error:', err);
                });
              }, 500);
              
              return result.data.conversationId;
            }
            
            lastError = result.error || new Error('Error creating conversation');
            console.error(`[ChatContext] Attempt ${attempt} failed:`, lastError);
            
            // Wait before retrying
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        } catch (retryError) {
          lastError = retryError;
          console.error(`[ChatContext] Error in attempt ${attempt}:`, retryError);
          
          // Wait before retrying
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      // If we get here, all attempts failed
      console.error('[ChatContext] All attempts to create conversation failed');
      throw lastError || new Error('Failed to create conversation after multiple attempts');
    } catch (error) {
      console.error('[ChatContext] Unexpected error creating conversation:', error);
      return null;
    }
  }, [user, refreshConversations, isOffline]);

  // Delete conversation (soft delete)
  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) {
      console.error('[ChatContext] Cannot delete conversation: no user logged in');
      return false;
    }
    
    if (isOffline) {
      console.error('[ChatContext] Cannot delete conversation: Device is offline');
      return false;
    }
    
    try {
      console.log(`[ChatContext] Attempting to delete conversation: ${conversationId}`);
      
      // Save conversation info before marking as deleted
      const deletedConversation = conversations.find(conv => conv.id === conversationId);
      if (!deletedConversation) {
        console.error(`[ChatContext] Conversation ${conversationId} not found in local state`);
        return false;
      }
      
      const result = await chatService.deleteConversation(conversationId, user.uid);
      
      if (result.success) {
        console.log(`[ChatContext] Successfully marked conversation ${conversationId} as deleted`);
        
        // Update local state after deletion (soft delete)
        setConversations(prevConversations => 
          prevConversations.filter(conv => conv.id !== conversationId)
        );
        
        // Update unread counter
        if (deletedConversation && deletedConversation.unreadCount?.[user.uid]) {
          setUnreadTotal(prev => Math.max(0, prev - deletedConversation.unreadCount![user.uid]));
        }
        
        // If deleted conversation was active, clear state
        if (activeConversationId === conversationId) {
          _setActiveConversationId(null);
          setActiveConversation(null);
          setActiveMessages([]);
        }
        
        return true;
      } else {
        console.error('[ChatContext] Failed to delete conversation:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[ChatContext] Error deleting conversation:', error);
      return false;
    }
  }, [user, conversations, activeConversationId, isOffline]);
  
  // Use useMemo for context value to prevent unnecessary renders
  const contextValue = useMemo(() => ({
    conversations,
    activeConversation,
    activeMessages,
    loading,
    error,
    unreadTotal,
    isOffline,
    setActiveConversationId,
    sendMessage,
    createConversation,
    markConversationAsRead,
    refreshConversations,
    deleteConversation,
    resendFailedMessage,
    uploadImage
  }), [
    conversations,
    activeConversation,
    activeMessages,
    loading,
    error,
    unreadTotal,
    isOffline,
    setActiveConversationId,
    sendMessage,
    createConversation,
    markConversationAsRead,
    refreshConversations,
    deleteConversation,
    resendFailedMessage,
    uploadImage
  ]);
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook to use chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat debe ser usado dentro de un ChatProvider');
  }
  return context;
};
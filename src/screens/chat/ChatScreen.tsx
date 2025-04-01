// React and React Native imports
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Keyboard,
  ScrollView
} from 'react-native';

// Navigation imports
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

// Third party libraries
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Context and utilities
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

// Components
import ChatHeader from '../../components/chat/ChatHeader';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';

// Types
import { Message, Conversation } from '../../../models/chatTypes';

// Detailed type definitions
type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;
type MessageListRef = React.RefObject<FlatList<Message>>;

const ChatScreen: React.FC = () => {
  // Navigation and route params
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { conversationId } = route.params;
  
  // Contexts
  const { user } = useAuth();
  const { 
    activeConversation, 
    activeMessages, 
    loading, 
    error, 
    sendMessage, 
    markConversationAsRead,
    uploadImage,
    resendFailedMessage,
    refreshConversations,
    isOffline
  } = useChat();

  // Local state
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [scrollToBottom, setScrollToBottom] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Refs
  const messagesListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Handle back button press
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGoBack();
        return true;
      };
      
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );
  
  // Listen for keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        scrollToBottomIfNeeded();
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Animate in the chat screen
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [fadeAnim]);
  
  // Mark messages as read when the conversation becomes active
  useEffect(() => {
    const markAsRead = async () => {
      if (activeConversation) {
        try {
          await markConversationAsRead();
        } catch (error) {
          console.error('Error marking conversation as read:', error);
        }
      }
    };
    
    markAsRead();
  }, [activeConversation, markConversationAsRead]);
  
  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollToBottom && activeMessages.length > 0) {
      scrollToBottomIfNeeded();
    }
  }, [activeMessages, scrollToBottom]);
  
  // Scroll to bottom if needed
  const scrollToBottomIfNeeded = useCallback(() => {
    setTimeout(() => {
      if (messagesListRef.current) {
        messagesListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  }, []);
  
  // Get the other participant's ID from the active conversation
  const otherParticipantId = useMemo(() => {
    if (!activeConversation || !user) return '';
    return activeConversation.participants.find(id => id !== user.uid) || '';
  }, [activeConversation, user]);
  
  // Handle sending a message
  const handleSendMessage = useCallback(async (text: string, imageUrl?: string): Promise<boolean> => {
    if (!user) {
      Alert.alert('Error', 'No se puede enviar el mensaje, usuario no autenticado');
      return false;
    }

    if (isOffline) {
      Alert.alert('Sin conexión', 'No puedes enviar mensajes sin conexión a internet');
      return false;
    }

    try {
      const success = await sendMessage(text, imageUrl);
      
      if (success) {
        scrollToBottomIfNeeded();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [user, sendMessage, scrollToBottomIfNeeded, isOffline]);
  
  // Handle showing an image in fullscreen mode
  const handleImagePress = useCallback((imageUrl: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  }, []);
  
  // Handle retrying a failed message
  const handleRetryMessage = useCallback(async (messageId: string) => {
    if (isOffline) {
      Alert.alert('Sin conexión', 'No puedes reenviar mensajes sin conexión a internet');
      return;
    }
    
    try {
      const success = await resendFailedMessage(messageId);
      if (success) {
        scrollToBottomIfNeeded();
      }
    } catch (error) {
      console.error('Error retrying message:', error);
    }
  }, [resendFailedMessage, scrollToBottomIfNeeded, isOffline]);
  
  // Handle going back
  const handleGoBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Update conversations list when going back
    setTimeout(() => {
      refreshConversations().catch(err => {
        console.error('Error refreshing conversations on back:', err);
      });
    }, 300);
    
    navigation.goBack();
  }, [navigation, refreshConversations]);
  
  // Handle scroll events to determine if we should auto-scroll
  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    
    // Calculate if we're close to the bottom (within 200px)
    const closeToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
    
    // Only auto-scroll when user is near the bottom
    setScrollToBottom(closeToBottom);
  }, []);
  
  // Empty state component
  const EmptyStateComponent = useCallback(() => (
    <View style={styles.emptyStateContainer}>
      <LinearGradient
        colors={['#F4F6FF', '#E8EEFF']}
        style={styles.emptyStateGradient}
      >
        <MaterialIcons 
          name="chat-bubble-outline" 
          size={120} 
          color="#B9C5FF" 
          style={styles.emptyStateIcon}
        />
        <Text style={styles.emptyText}>No hay mensajes</Text>
        <Text style={styles.emptySubtext}>
          Sé el primero en enviar un mensaje
        </Text>
      </LinearGradient>
    </View>
  ), []);
  
  // Loading state
  if (loading && !activeConversation) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando conversación...</Text>
      </View>
    );
  }

  // Error state
  if (error && !activeConversation) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleGoBack}
        >
          <Text style={styles.retryButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <ChatHeader 
        conversation={activeConversation} 
        participantId={otherParticipantId}
        isTyping={isTyping}
        businessMode={!!activeConversation?.businessId}
        onBackPress={handleGoBack}
      />
      
      {/* Offline indicator */}
      {isOffline && (
        <View style={styles.offlineBar}>
          <MaterialIcons name="cloud-off" size={16} color="#FFF" />
          <Text style={styles.offlineText}>Sin conexión</Text>
        </View>
      )}
      
      {/* Main content */}
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Error banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={() => refreshConversations()}>
                <Text style={styles.errorBannerRetry}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Messages list */}
          <FlatList
            ref={messagesListRef}
            data={activeMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ChatMessage 
                message={item} 
                isMine={item.senderId === user?.uid}
                onImagePress={handleImagePress}
                onRetry={handleRetryMessage}
                previousMessage={index > 0 ? activeMessages[index - 1] : null}
              />
            )}
            contentContainerStyle={styles.messagesContainer}
            inverted={false}
            ListEmptyComponent={EmptyStateComponent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              if (scrollToBottom) {
                scrollToBottomIfNeeded();
              }
            }}
            showsVerticalScrollIndicator={true}
          />
          
          {/* Input area */}
          <ChatInput 
            onSend={handleSendMessage}
            uploadImage={uploadImage}
            disabled={loading || isOffline}
          />
        </KeyboardAvoidingView>
      </Animated.View>
      
      {/* Fullscreen image modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}
        animationType="fade"
      >
        <TouchableOpacity 
          style={styles.modalContainer} 
          onPress={() => setImageModalVisible(false)}
          activeOpacity={1}
        >
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
              onLoadStart={() => {}}
              onLoadEnd={() => {}}
              fadeDuration={300}
            />
          )}
          <TouchableOpacity 
            style={styles.closeModalButton}
            onPress={() => setImageModalVisible(false)}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
              style={styles.closeGradient}
            >
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
      {/* Scroll to bottom button */}
      {!scrollToBottom && activeMessages.length > 10 && (
        <TouchableOpacity
          style={styles.scrollToBottomButton}
          onPress={scrollToBottomIfNeeded}
        >
          <LinearGradient
            colors={['#007AFF', '#00C2FF']}
            style={styles.scrollToBottomGradient}
          >
            <MaterialIcons name="arrow-downward" size={22} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  contentContainer: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  messagesContainer: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexGrow: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  closeModalButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeGradient: {
    padding: 10,
    borderRadius: 20,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  emptyStateGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    width: '90%',
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 8,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FFEBE9',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FF3B30',
  },
  errorBannerText: {
    color: '#FF3B30',
    fontSize: 14,
    flex: 1,
  },
  errorBannerRetry: {
    color: '#007AFF',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 14,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  scrollToBottomGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBar: {
    backgroundColor: '#FF3B30',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  }
});

export default ChatScreen;
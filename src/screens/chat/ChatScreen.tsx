import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import ChatHeader from '../../components/chat/ChatHeader';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';
import { Message } from '../../../models/chatTypes';
import { useChat as useChatHook } from '../../hooks/useChat';
import firebase from 'firebase/compat/app';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { 
    activeConversation, 
    activeMessages,
    sendMessage: contextSendMessage,
    markConversationAsRead 
  } = useChat();
  
  const { conversationId } = route.params;
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Usar el hook useChat para manejar mensajes en tiempo real
  const { 
    messages: hookMessages, 
    sendMessage: hookSendMessage, 
    uploadImage, 
    markAsRead 
  } = useChatHook({
    userId: user?.uid || '',
    conversationId
  });
  
  // Referencia para el FlatList para hacer scroll a nuevos mensajes
  const messagesListRef = useRef<FlatList>(null);
  
  // Determinar qué conjunto de mensajes usar (del contexto o del hook)
  const messages = activeMessages.length > 0 ? activeMessages : hookMessages;
  
  // Marcar como leído al abrir la conversación
  useEffect(() => {
    if (activeConversation) {
      markConversationAsRead();
    } else {
      markAsRead();
    }
  }, [activeConversation, markConversationAsRead, markAsRead]);
  
  // Enviar mensaje usando el sistema disponible
  const handleSendMessage = async (text: string, imageUrl?: string) => {
    if (!user) return;
    
    if (contextSendMessage) {
      await contextSendMessage(text, imageUrl);
    } else if (hookSendMessage) {
      await hookSendMessage(text, imageUrl);
    }
  };
  
  // Mostrar imagen a tamaño completo
  const handleImagePress = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };
  
  // Ordenar los mensajes por fecha (más recientes primero en la API, pero los mostramos al revés)
  const sortedMessages = [...messages].sort((a, b) => {
    let dateA: Date;
    let dateB: Date;
    
    if (a.timestamp instanceof firebase.firestore.Timestamp) {
      dateA = a.timestamp.toDate();
    } else if (a.timestamp instanceof Date) {
      dateA = a.timestamp;
    } else {
      dateA = new Date(a.timestamp);
    }
    
    if (b.timestamp instanceof firebase.firestore.Timestamp) {
      dateB = b.timestamp.toDate();
    } else if (b.timestamp instanceof Date) {
      dateB = b.timestamp;
    } else {
      dateB = new Date(b.timestamp);
    }
    
    return dateA.getTime() - dateB.getTime();
  });
  
  // Obtener el ID del otro participante
  const getOtherParticipantId = () => {
    if (!activeConversation || !user) return '';
    return activeConversation.participants.find(id => id !== user.uid) || '';
  };
  
  // Obtener información del otro participante para el header
  const otherParticipantId = getOtherParticipantId();
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <ChatHeader 
        conversation={activeConversation} 
        participantId={otherParticipantId}
      />
      
      {/* Mensajes */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={messagesListRef}
          data={sortedMessages}
          keyExtractor={(item: Message) => item.id}
          renderItem={({ item }: { item: Message }) => (
            <ChatMessage 
              message={item} 
              isMine={item.senderId === user?.uid}
              onImagePress={handleImagePress}
            />
          )}
          contentContainerStyle={styles.messagesContainer}
          inverted={false}
          onContentSizeChange={() => {
            messagesListRef.current?.scrollToEnd({ animated: true });
          }}
          onLayout={() => {
            messagesListRef.current?.scrollToEnd({ animated: false });
          }}
        />
        
        {/* Input para nuevos mensajes */}
        <ChatInput 
          onSend={handleSendMessage}
          uploadImage={uploadImage}
        />
      </KeyboardAvoidingView>
      
      {/* Modal para ver imágenes a pantalla completa */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setImageModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
          
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
              onLoadStart={() => {}}
              onLoadEnd={() => {}}
              onError={() => {
                console.error('Error loading image in modal');
                setImageModalVisible(false);
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});

export default ChatScreen;
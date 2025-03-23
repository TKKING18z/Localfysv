import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Message } from '../../../models/chatTypes';
import firebase from 'firebase/compat/app';

interface ChatMessageProps {
  message: Message;
  isMine: boolean;
  onImagePress?: (imageUrl: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isMine, onImagePress }) => {
  // Formatear la hora desde el timestamp
  const getFormattedTime = () => {
    try {
      if (!message.timestamp) return '';
      
      let date: Date;
      if (message.timestamp instanceof firebase.firestore.Timestamp) {
        date = message.timestamp.toDate();
      } else if (message.timestamp instanceof Date) {
        date = message.timestamp;
      } else if (typeof message.timestamp === 'string') {
        date = new Date(message.timestamp);
      } else {
        return '';
      }
      
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting message time:', error);
      return '';
    }
  };
  
  // Si es un mensaje de sistema
  if (message.type === 'system') {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>{message.text}</Text>
      </View>
    );
  }
  
  return (
    <View style={[
      styles.container,
      isMine ? styles.myMessageContainer : styles.otherMessageContainer
    ]}>
      {/* Avatar solo para mensajes de otros */}
      {!isMine && message.senderPhoto ? (
        <Image source={{ uri: message.senderPhoto }} style={styles.avatar} />
      ) : !isMine ? (
        <View style={[styles.avatar, styles.defaultAvatar]}>
          <Text style={styles.avatarText}>{message.senderName?.[0] || 'U'}</Text>
        </View>
      ) : null}
      
      <View style={[
        styles.messageBubble,
        isMine ? styles.myMessageBubble : styles.otherMessageBubble,
        message.type === 'image' ? styles.imageBubble : {}
      ]}>
        {/* Nombre del remitente para mensajes de otros */}
        {!isMine && message.senderName && (
          <Text style={styles.senderName}>{message.senderName}</Text>
        )}
        
        {/* Contenido del mensaje */}
        {message.type === 'image' && message.imageUrl ? (
          <TouchableOpacity 
            onPress={() => onImagePress && message.imageUrl && onImagePress(message.imageUrl)}
            activeOpacity={0.8}
          >
            <Image 
              source={{ uri: message.imageUrl }} 
              style={styles.messageImage}
              resizeMode="cover"
            />
            {message.text && <Text style={styles.messageText}>{message.text}</Text>}
          </TouchableOpacity>
        ) : (
          <Text style={[
            styles.messageText,
            isMine ? styles.myMessageText : styles.otherMessageText
          ]}>{message.text}</Text>
        )}
        
        {/* Hora y estado */}
        <View style={styles.messageFooter}>
          <Text style={[
            styles.timeText,
            isMine ? styles.myTimeText : styles.otherTimeText
          ]}>{getFormattedTime()}</Text>
          {isMine && (
            <MaterialIcons 
              name={message.read ? "done-all" : "done"} 
              size={14} 
              color={message.read ? "#34C759" : "#8E8E93"} 
              style={styles.statusIcon}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  defaultAvatar: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: MAX_BUBBLE_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
    marginLeft: 40,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  imageBubble: {
    padding: 4,
    overflow: 'hidden',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#007AFF',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#333333',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 14,
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimeText: {
    color: '#8E8E93',
  },
  statusIcon: {
    marginLeft: 4,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
});

export default ChatMessage;
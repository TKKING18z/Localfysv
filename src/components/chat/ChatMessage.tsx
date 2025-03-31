import React, { memo, useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  Dimensions,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Message, MessageStatus, MessageType } from '../../../models/chatTypes';
import { formatMessageTime, getNameInitial, getAvatarColor } from '../../../src/utils/chatUtils';
import * as Haptics from 'expo-haptics';

interface ChatMessageProps {
  message: Message;
  isMine: boolean;
  onImagePress?: (imageUrl: string) => void;
  onRetry?: (messageId: string) => void;
  previousMessage?: Message | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;

// Helper to determine if we need to show the avatar/name again
const shouldShowSenderInfo = (current: Message, previous: Message | null | undefined): boolean => {
  if (!previous) return true;
  
  // Show if different sender
  if (previous.senderId !== current.senderId) return true;
  
  // Show if messages are more than 5 minutes apart
  const currentTime = 
    current.timestamp instanceof Date ? current.timestamp.getTime() :
    typeof current.timestamp === 'string' ? new Date(current.timestamp).getTime() :
    current.timestamp?.toDate ? current.timestamp.toDate().getTime() : 0;
  
  const previousTime = 
    previous.timestamp instanceof Date ? previous.timestamp.getTime() :
    typeof previous.timestamp === 'string' ? new Date(previous.timestamp).getTime() :
    previous.timestamp?.toDate ? previous.timestamp.toDate().getTime() : 0;
  
  return Math.abs(currentTime - previousTime) > 5 * 60 * 1000; // 5 minutes
};

// Memoized message component for better performance
const ChatMessage: React.FC<ChatMessageProps> = memo(({ 
  message, 
  isMine, 
  onImagePress, 
  onRetry,
  previousMessage
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true); // Add state for image loading
  const showSenderInfo = !isMine && shouldShowSenderInfo(message, previousMessage);
  
  // Format the time from timestamp
  const getFormattedTime = useCallback(() => {
    return formatMessageTime(message.timestamp);
  }, [message.timestamp]);
  
  // Handle retry for failed messages
  const handleRetry = useCallback(() => {
    if (onRetry && message.status === MessageStatus.ERROR) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsLoading(true);
      onRetry(message.id);
    }
  }, [message, onRetry]);
  
  // Handle long press (could implement message actions here)
  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Could implement message actions here (copy, delete, etc.)
  }, []);
  
  // If it's a system message
  if (message.type === MessageType.SYSTEM) {
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
      {/* Avatar only for other people's messages when needed */}
      {!isMine && showSenderInfo ? (
        message.senderPhoto ? (
          <Image 
            source={{ uri: message.senderPhoto }} 
            style={styles.avatar}
            defaultSource={require('../../../assets/Iconprofile.png')}
          />
        ) : (
          <View style={[
            styles.avatar, 
            styles.defaultAvatar,
            { backgroundColor: getAvatarColor(message.senderId) }
          ]}>
            <Text style={styles.avatarText}>{getNameInitial(message.senderName)}</Text>
          </View>
        )
      ) : (
        <View style={styles.avatarPlaceholder} />
      )}
      
      <Pressable 
        style={({ pressed }) => [
          styles.messageBubble,
          isMine ? styles.myMessageBubble : styles.otherMessageBubble,
          message.type === MessageType.IMAGE ? styles.imageBubble : {},
          isMine && pressed && styles.myMessageBubblePressed,
          !isMine && pressed && styles.otherMessageBubblePressed
        ]}
        onLongPress={handleLongPress}
        delayLongPress={500}
      >
        {/* Sender name for others' messages when needed */}
        {!isMine && showSenderInfo && message.senderName && (
          <Text style={styles.senderName}>{message.senderName}</Text>
        )}
        
        {/* Message content */}
        {message.type === MessageType.IMAGE && message.imageUrl ? (
          <View>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => onImagePress && message.imageUrl && onImagePress(message.imageUrl)}
            >
              <View style={styles.messageImage}>
                {imageLoading && (
                  <View style={styles.imagePlaceholder}>
                    <ActivityIndicator size="small" color={isMine ? "#fff" : "#007AFF"} />
                    <MaterialIcons 
                      name="image" 
                      size={24} 
                      color={isMine ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)"}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                )}
                <Image 
                  source={{ uri: message.imageUrl }} 
                  style={[styles.messageImage, { backgroundColor: 'transparent' }]}
                  resizeMode="cover"
                  onLoadStart={() => setImageLoading(true)}
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              </View>
            </TouchableOpacity>
            {message.text && <Text style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.otherMessageText
            ]}>{message.text}</Text>}
          </View>
        ) : (
          <Text style={[
            styles.messageText,
            isMine ? styles.myMessageText : styles.otherMessageText
          ]}>{message.text}</Text>
        )}
        
        {/* Time and status */}
        <View style={styles.messageFooter}>
          <Text style={[
            styles.timeText,
            isMine ? styles.myTimeText : styles.otherTimeText
          ]}>{getFormattedTime()}</Text>
          
          {isMine && message.status !== MessageStatus.ERROR && (
            <MaterialIcons 
              name={message.read ? "done-all" : "done"} 
              size={14} 
              color={message.read ? "#34C759" : "#8E8E93"} 
              style={styles.statusIcon}
            />
          )}
          
          {isMine && message.status === MessageStatus.SENDING && (
            <ActivityIndicator 
              size="small" 
              color="#8E8E93" 
              style={styles.statusIcon}
            />
          )}
        </View>
      </Pressable>
      
      {/* Error and retry option */}
      {isMine && message.status === MessageStatus.ERROR && (
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleRetry}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <MaterialIcons name="refresh" size={20} color="#FF3B30" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
    marginLeft: 50,
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
    marginRight: 50,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 36,
    marginRight: 8,
  },
  defaultAvatar: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  myMessageBubblePressed: {
    backgroundColor: '#0067DB',
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  otherMessageBubblePressed: {
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#E9E9E9',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E9E9E9',
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
  retryButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  }
});

export default ChatMessage;
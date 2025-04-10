import React, { memo, useCallback, useState, useRef } from 'react';
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
import { Swipeable } from 'react-native-gesture-handler';
import { Message, MessageStatus, MessageType } from '../../../models/chatTypes';
import { formatMessageTime, getNameInitial, getAvatarColor } from '../../../src/utils/chatUtils';
import * as Haptics from 'expo-haptics';

interface ChatMessageProps {
  message: Message;
  isMine: boolean;
  onImagePress?: (imageUrl: string) => void;
  onRetry?: (messageId: string) => void;
  onReply?: (message: Message) => void;
  previousMessage?: Message | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.85;

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

// Render left actions (reply button)
const renderLeftActions = (message: Message, onReply?: (message: Message) => void) => {
  return (
    <TouchableOpacity
      style={styles.replyAction}
      onPress={() => {
        if (onReply) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onReply(message);
        }
      }}
    >
      <View style={styles.replyActionContent}>
        <MaterialIcons name="reply" size={24} color="#0A84FF" />
        <Text style={styles.replyActionText}>Responder</Text>
      </View>
    </TouchableOpacity>
  );
};

// Memoized message component for better performance
const ChatMessage: React.FC<ChatMessageProps> = memo(({ 
  message, 
  isMine, 
  onImagePress, 
  onRetry,
  onReply,
  previousMessage
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const showSenderInfo = !isMine && shouldShowSenderInfo(message, previousMessage);
  const swipeableRef = useRef<Swipeable | null>(null);
  
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
  
  // Check if the message is a reply
  const isReply = !!message.replyTo;
  
  // Render the message content bubble
  const renderMessageContent = () => (
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
          !isMine && pressed && styles.otherMessageBubblePressed,
          isReply && (isMine ? styles.myReplyBubble : styles.otherReplyBubble)
        ]}
        onLongPress={handleLongPress}
        delayLongPress={500}
      >
        {/* Replied message preview if this is a reply */}
        {message.replyTo && (
          <View style={[
            styles.replyPreviewContainer,
            isMine ? styles.myReplyPreviewContainer : styles.otherReplyPreviewContainer
          ]}>
            <View style={[
              styles.replyPreviewBar,
              isMine ? styles.myReplyPreviewBar : styles.otherReplyPreviewBar
            ]} />
            <View style={styles.replyPreviewContent}>
              <Text style={[
                styles.replyPreviewName,
                isMine && styles.myReplyPreviewName
              ]}>
                {message.replyTo.senderId === message.senderId ? 'Tú' : message.replyTo.senderName || 'Usuario'}
              </Text>
              {message.replyTo.type === MessageType.IMAGE ? (
                <View style={styles.replyImagePreview}>
                  <MaterialIcons 
                    name="image" 
                    size={14} 
                    color={isMine ? "rgba(255, 255, 255, 0.8)" : "#8E8E93"} 
                    style={{ marginRight: 4 }} 
                  />
                  <Text style={[
                    styles.replyPreviewText,
                    isMine && { color: 'rgba(255, 255, 255, 0.9)' }
                  ]} numberOfLines={1}>
                    {message.replyTo.text || 'Foto'}
                  </Text>
                </View>
              ) : (
                <Text style={[
                  styles.replyPreviewText,
                  isMine && { color: 'rgba(255, 255, 255, 0.9)' }
                ]} numberOfLines={1}>
                  {message.replyTo.text}
                </Text>
              )}
            </View>
          </View>
        )}
        
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

  // Use Swipeable to enable reply functionality
  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={() => onReply ? renderLeftActions(message, onReply) : null}
      friction={2}
      leftThreshold={40}
      onSwipeableOpen={() => {
        if (onReply) {
          onReply(message);
          setTimeout(() => {
            swipeableRef.current?.close();
          }, 500);
        }
      }}
    >
      {renderMessageContent()}
    </Swipeable>
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
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    maxWidth: MAX_BUBBLE_WIDTH,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: '#0A84FF',
    borderBottomRightRadius: 4,
    borderTopRightRadius: 18,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  myMessageBubblePressed: {
    backgroundColor: '#0271E0',
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 18,
    borderTopLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  otherMessageBubblePressed: {
    backgroundColor: '#F5F5F7',
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
    lineHeight: 20,
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
  },
  // Reply action styles
  replyAction: {
    backgroundColor: '#E1F5FE',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 120,
    height: '100%',
  },
  replyActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1F5FE',
    padding: 10,
    borderRadius: 12,
    marginRight: 10,
  },
  replyActionText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  // Reply preview styles
  replyPreviewContainer: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingBottom: 6,
    paddingTop: 2,
    paddingRight: 8,
    paddingLeft: 2,
    borderWidth: 1,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(10, 132, 255, 0.05)',
    borderRadius: 8,
    marginTop: 2,
    marginLeft: 2,
    marginRight: 2,
  },
  // Styles for my (user's) message reply preview
  myReplyPreviewContainer: {
    borderColor: 'rgba(255, 255, 255, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  // Styles for other user's message reply preview
  otherReplyPreviewContainer: {
    borderColor: 'rgba(10, 132, 255, 0.7)',
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
  },
  replyPreviewBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 3,
  },
  myReplyPreviewBar: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
  },
  otherReplyPreviewBar: {
    backgroundColor: '#0A84FF',
    shadowColor: '#0A84FF',
  },
  replyPreviewContent: {
    flex: 1,
    flexShrink: 1,
  },
  replyPreviewName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0A84FF',
    marginBottom: 2,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  myReplyPreviewName: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
  },
  replyPreviewText: {
    fontSize: 12,
    color: 'rgba(51, 51, 51, 0.9)',
    fontWeight: '500',
    paddingTop: 1,
    paddingBottom: 1,
  },
  replyImagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Add new reply styles
  myReplyBubble: {
    borderWidth: 2,
    borderColor: '#0064C8',
  },
  otherReplyBubble: {
    borderWidth: 2,
    borderColor: '#BFE0FF',
  },
});

export default ChatMessage;
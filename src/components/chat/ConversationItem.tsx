import React, { memo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image,
  Animated,
  Pressable
} from 'react-native';
import { Conversation } from '../../../models/chatTypes';
import { formatConversationTime, getNameInitial, getAvatarColor, truncateText } from '../../../src/utils/chatUtils';
import * as Haptics from 'expo-haptics';

interface ConversationItemProps {
  conversation: Conversation;
  userId: string;
  onPress: (conversationId: string) => void;
  onLongPress?: (conversationId: string) => void;
  isActive?: boolean;
}

const ConversationItem: React.FC<ConversationItemProps> = memo(({ 
  conversation, 
  userId,
  onPress,
  onLongPress,
  isActive = false
}) => {
  // Get the ID of the other participant
  const getOtherParticipantId = () => {
    return conversation.participants.find(id => id !== userId) || '';
  };
  
  // Format the last message date
  const getFormattedDate = () => {
    if (!conversation.lastMessage?.timestamp) return '';
    return formatConversationTime(conversation.lastMessage.timestamp);
  };
  
  const otherParticipantId = getOtherParticipantId();
  const otherParticipantName = conversation.participantNames[otherParticipantId] || 'Usuario';
  const otherParticipantPhoto = conversation.participantPhotos?.[otherParticipantId];
  
  // Unread message count
  const unreadCount = conversation.unreadCount?.[userId] || 0;
  
  // Determine if the last message is from the current user
  const isLastMessageMine = conversation.lastMessage?.senderId === userId;
  
  // Text to show as last message
  let lastMessageText = conversation.lastMessage?.text || 'Sin mensajes';
  if (isLastMessageMine) {
    lastMessageText = `Tú: ${lastMessageText}`;
  }
  
  // Decide what to show as title (participant name or business name)
  const title = conversation.businessId
    ? conversation.businessName || otherParticipantName
    : otherParticipantName;
    
  // The subtitle is the other participant's name if there's a business
  const subtitle = conversation.businessId
    ? otherParticipantName
    : undefined;
  
  const handlePress = () => {
    onPress(conversation.id);
  };
  
  const handleLongPress = () => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress(conversation.id);
    }
  };
  
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        unreadCount > 0 && styles.unreadContainer,
        isActive && styles.activeContainer,
        pressed && styles.pressedContainer
      ]} 
      onPress={handlePress}
      onLongPress={handleLongPress}
      android_ripple={{ color: 'rgba(0, 122, 255, 0.1)' }}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {otherParticipantPhoto ? (
          <Image 
            source={{ uri: otherParticipantPhoto }} 
            style={styles.avatar}
            onError={() => {
              // This will silently handle the error when image fails to load
              // The default avatar view will be shown automatically in the render
            }}
          />
        ) : (
          <View style={[
            styles.defaultAvatar,
            { backgroundColor: getAvatarColor(otherParticipantId) }
          ]}>
            <Text style={styles.avatarText}>{getNameInitial(otherParticipantName)}</Text>
          </View>
        )}
        
        {/* Business badge */}
        {conversation.businessId && (
          <View style={styles.businessBadge}>
            <Text style={styles.businessBadgeText}>B</Text>
          </View>
        )}
      </View>
      
      {/* Content */}
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text 
            style={[
              styles.nameText, 
              unreadCount > 0 && styles.unreadText
            ]} 
            numberOfLines={1}
          >
            {title}
          </Text>
          
          <Text style={styles.timeText}>{getFormattedDate()}</Text>
        </View>
        
        {subtitle && (
          <Text style={styles.subtitleText} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        
        <View style={styles.messageRow}>
          <Text 
            style={[
              styles.lastMessageText, 
              unreadCount > 0 && styles.unreadText
            ]} 
            numberOfLines={1}
          >
            {truncateText(lastMessageText, 60)}
          </Text>
          
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9E9EB',
    backgroundColor: '#FFFFFF',
  },
  unreadContainer: {
    backgroundColor: '#F2F7FF',
  },
  activeContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  pressedContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  avatarContainer: {
    marginRight: 16,
    position: 'relative',
    height: 60,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  defaultAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  businessBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  businessBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  subtitleText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessageText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#000',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default ConversationItem;
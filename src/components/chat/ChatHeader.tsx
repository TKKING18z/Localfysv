import React, { memo, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Platform,
  ActivityIndicator,
  Animated
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Conversation } from '../../../models/chatTypes';
import { useNavigation } from '@react-navigation/native';
import { getNameInitial, getAvatarColor } from '../../../src/utils/chatUtils';
import * as Haptics from 'expo-haptics';

interface ChatHeaderProps {
  conversation: Conversation | null;
  participantId: string;
  businessMode?: boolean;
  isOnline?: boolean;
  isTyping?: boolean;
  onBackPress?: () => void;
  onInfoPress?: () => void;
  onAvatarPress?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = memo(({ 
  conversation, 
  participantId,
  businessMode = false,
  isOnline = false,
  isTyping = false,
  onBackPress,
  onInfoPress,
  onAvatarPress
}) => {
  const navigation = useNavigation();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-20));
  
  // Animate header entrance
  useEffect(() => {
    if (conversation) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 6,
          tension: 40,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [conversation, fadeAnim, slideAnim]);
  
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };
  
  const handleInfoPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onInfoPress) {
      onInfoPress();
    }
  };
  
  const handleAvatarPress = () => {
    if (onAvatarPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAvatarPress();
    }
  };
  
  if (!conversation) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingBackground}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Cargando conversación...</Text>
        </View>
      </View>
    );
  }
  
  const otherParticipantName = conversation.participantNames[participantId] || 'Usuario';
  const otherParticipantPhoto = conversation.participantPhotos?.[participantId];
  
  // For showing the business name if present
  const headerTitle = businessMode && conversation.businessName 
    ? conversation.businessName
    : otherParticipantName;
  
  // For showing additional info under the main title
  const headerSubtitle = businessMode && conversation.businessName 
    ? `${otherParticipantName} - ${isTyping ? 'escribiendo...' : isOnline ? 'en línea' : ''}`
    : isTyping ? 'escribiendo...' : isOnline ? 'en línea' : '';
  
  return (
    <Animated.View 
      style={[
        styles.containerWrapper,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.headerBackground}>
        <View style={styles.container}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
            disabled={!onAvatarPress}
          >
            {otherParticipantPhoto ? (
              <Image 
                source={{ uri: otherParticipantPhoto }} 
                style={styles.avatar}
                defaultSource={require('../../../assets/Iconprofile.png')}
              />
            ) : (
              <View style={[
                styles.defaultAvatar,
                { backgroundColor: getAvatarColor(participantId) }
              ]}>
                <Text style={styles.avatarText}>{getNameInitial(otherParticipantName)}</Text>
              </View>
            )}
            
            {/* Status indicator */}
            {(isOnline || isTyping) && (
              <View style={[
                styles.statusIndicator,
                isTyping ? styles.typingIndicator : styles.onlineIndicator
              ]} />
            )}
            
            <View style={styles.nameContainer}>
              <Text style={styles.title} numberOfLines={1}>{headerTitle}</Text>
              {headerSubtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{headerSubtitle}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
          
          {onInfoPress && (
            <TouchableOpacity 
              style={styles.infoButton} 
              onPress={handleInfoPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="info-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Nice shadow on iOS */}
      {Platform.OS === 'ios' && (
        <View style={styles.shadowLine} />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  containerWrapper: {
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  headerBackground: {
    width: '100%',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: '#007AFF',
  },
  container: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  avatarText: {
    color: '#007AFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  nameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  infoButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  loadingContainer: {
    height: 70,
  },
  loadingBackground: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
  },
  loadingText: {
    color: '#FFFFFF',
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  statusIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    bottom: 0,
    left: 32,
    borderWidth: 2,
    borderColor: 'white',
  },
  onlineIndicator: {
    backgroundColor: '#007AFF',
  },
  typingIndicator: {
    backgroundColor: '#007AFF',
  },
  shadowLine: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  }
});

export default ChatHeader;
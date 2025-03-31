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
import { LinearGradient } from 'expo-linear-gradient';
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
        <LinearGradient
          colors={['#007AFF', '#00C2FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.loadingGradient}
        >
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Cargando conversación...</Text>
        </LinearGradient>
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
      <LinearGradient
        colors={businessMode ? ['#FF9500', '#FF2D55'] : ['#007AFF', '#00C2FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
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
      </LinearGradient>
      
      {/* Nice shadow on iOS */}
      {Platform.OS === 'ios' && (
        <View style={styles.shadowLine} />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  containerWrapper: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10,
  },
  headerGradient: {
    width: '100%',
  },
  container: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  defaultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
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
  loadingGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    backgroundColor: '#34C759',
  },
  typingIndicator: {
    backgroundColor: '#FF9500',
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
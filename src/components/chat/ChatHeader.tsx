import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Conversation } from '../../../models/chatTypes';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

interface ChatHeaderProps {
  conversation: Conversation | null;
  participantId: string;
  businessMode?: boolean;
  onBackPress?: () => void;
  onInfoPress?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ 
  conversation, 
  participantId,
  businessMode,
  onBackPress,
  onInfoPress
}) => {
  const navigation = useNavigation();
  
  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };
  
  if (!conversation) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Cargando conversación...</Text>
        <View style={styles.placeholder} />
      </View>
    );
  }
  
  const otherParticipantName = conversation.participantNames[participantId] || 'Usuario';
  const otherParticipantPhoto = conversation.participantPhotos?.[participantId];
  
  return (
    <View style={styles.containerWrapper}>
      <LinearGradient
        colors={['#007AFF', '#00C2FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.container}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.userInfo}>
            {otherParticipantPhoto ? (
              <Image source={{ uri: otherParticipantPhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Text style={styles.avatarText}>{otherParticipantName[0]}</Text>
              </View>
            )}
            
            <View style={styles.nameContainer}>
              <Text style={styles.title} numberOfLines={1}>{otherParticipantName}</Text>
            </View>
          </View>
          
          {onInfoPress && (
            <TouchableOpacity 
              style={styles.infoButton} 
              onPress={onInfoPress}
            >
              <MaterialIcons name="info-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  containerWrapper: {
    overflow: 'hidden',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
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
  placeholder: {
    width: 40,
  },
});

export default ChatHeader;
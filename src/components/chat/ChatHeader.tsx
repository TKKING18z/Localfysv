import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Conversation } from '../../../models/chatTypes';
import { useNavigation } from '@react-navigation/native';

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
  const businessName = businessMode ? undefined : conversation.businessName;
  
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={handleBack}
      >
        <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
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
          {businessName && (
            <Text style={styles.subtitle} numberOfLines={1}>{businessName}</Text>
          )}
        </View>
      </View>
      
      {onInfoPress && (
        <TouchableOpacity 
          style={styles.infoButton} 
          onPress={onInfoPress}
        >
          <MaterialIcons name="info-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9E9EB',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  defaultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nameContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  infoButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
});

export default ChatHeader;
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Conversation } from '../../../models/chatTypes';
import firebase from 'firebase/compat/app';

interface ConversationItemProps {
  conversation: Conversation;
  userId: string;
  onPress: (conversationId: string) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({ 
  conversation, 
  userId,
  onPress 
}) => {
  // Obtener el ID del otro participante
  const getOtherParticipantId = () => {
    return conversation.participants.find(id => id !== userId) || '';
  };
  
  // Formatear la última fecha de mensaje
  const getFormattedDate = () => {
    try {
      if (!conversation.lastMessage?.timestamp) return '';
      
      let date: Date;
      if (conversation.lastMessage.timestamp instanceof firebase.firestore.Timestamp) {
        date = conversation.lastMessage.timestamp.toDate();
      } else if (conversation.lastMessage.timestamp instanceof Date) {
        date = conversation.lastMessage.timestamp;
      } else if (typeof conversation.lastMessage.timestamp === 'string') {
        date = new Date(conversation.lastMessage.timestamp);
      } else {
        return '';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        // Hoy: Mostrar hora
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        // Ayer
        return 'Ayer';
      } else if (diffDays < 7) {
        // En la última semana: mostrar día de la semana
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return days[date.getDay()];
      } else {
        // Fechas más antiguas: formato corto
        return date.toLocaleDateString();
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };
  
  const otherParticipantId = getOtherParticipantId();
  const otherParticipantName = conversation.participantNames[otherParticipantId] || 'Usuario';
  const otherParticipantPhoto = conversation.participantPhotos?.[otherParticipantId];
  
  // Número de mensajes no leídos
  const unreadCount = conversation.unreadCount?.[userId] || 0;
  
  // Determinar si el último mensaje es del usuario actual
  const isLastMessageMine = conversation.lastMessage?.senderId === userId;
  
  // Texto para mostrar como último mensaje
  let lastMessageText = conversation.lastMessage?.text || 'Sin mensajes';
  if (isLastMessageMine) {
    lastMessageText = `Tú: ${lastMessageText}`;
  }
  
  // Decidir qué mostrar como título (nombre de participante o de negocio)
  const title = conversation.businessId
    ? conversation.businessName || otherParticipantName
    : otherParticipantName;
    
  // El subtítulo es el nombre del otro participante si hay un negocio
  const subtitle = conversation.businessId
    ? otherParticipantName
    : undefined;
  
  return (
    <TouchableOpacity 
      style={[
        styles.container,
        unreadCount > 0 && styles.unreadContainer
      ]} 
      onPress={() => onPress(conversation.id)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {otherParticipantPhoto ? (
        <Image source={{ uri: otherParticipantPhoto }} style={styles.avatar} />
      ) : (
        <View style={styles.defaultAvatar}>
          <Text style={styles.avatarText}>{otherParticipantName[0]}</Text>
        </View>
      )}
      
      {/* Contenido central */}
      <View style={styles.contentContainer}>
        <Text 
          style={[
            styles.nameText, 
            unreadCount > 0 && styles.unreadText
          ]} 
          numberOfLines={1}
        >
          {title}
        </Text>
        
        {subtitle && (
          <Text style={styles.subtitleText} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        
        <Text 
          style={[
            styles.lastMessageText, 
            unreadCount > 0 && styles.unreadText
          ]} 
          numberOfLines={1}
        >
          {lastMessageText}
        </Text>
      </View>
      
      {/* Sección derecha con fecha y contador */}
      <View style={styles.rightContainer}>
        <Text style={styles.timeText}>{getFormattedDate()}</Text>
        
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

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
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  subtitleText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  lastMessageText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#000',
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
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
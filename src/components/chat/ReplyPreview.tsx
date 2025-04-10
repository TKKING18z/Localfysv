import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Message, MessageType } from '../../../models/chatTypes';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ReplyPreviewProps {
  message: Message;
  onCancel: () => void;
  isMine: boolean;
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onCancel, isMine }) => {
  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#0064C8', '#0A84FF']}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.leftBar} />
          <View style={styles.messagePreview}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              <MaterialIcons name="reply" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              {isMine ? 'Tu mensaje' : message.senderName || 'Usuario'}
            </Text>
            {message.type === MessageType.IMAGE ? (
              <View style={styles.imagePreview}>
                <MaterialIcons name="image" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.previewText} numberOfLines={1}>
                  {message.text || 'Foto'}
                </Text>
              </View>
            ) : (
              <Text style={styles.previewText} numberOfLines={1}>
                {message.text}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    marginBottom: 0,
    borderTopWidth: 2,
    borderTopColor: '#0064C8',
    backgroundColor: '#EFF6FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 8,
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    padding: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    position: 'relative',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    borderLeftWidth: 2,
    borderLeftColor: '#FFFFFF',
    paddingLeft: 6,
  },
  leftBar: {
    width: 4,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    marginRight: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  messagePreview: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    flexShrink: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    opacity: 0.9,
  },
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
});

export default ReplyPreview; 
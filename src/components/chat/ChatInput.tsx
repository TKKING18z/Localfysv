import React, { useState, useRef } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface ChatInputProps {
  onSend: (text: string, imageUrl?: string) => void;
  uploadImage?: (uri: string) => Promise<string | null>;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, uploadImage, disabled = false }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  
  const handleSend = () => {
    if (text.trim().length === 0 || isLoading || disabled) return;
    
    onSend(text.trim());
    setText('');
  };
  
  const handleAttachImage = async () => {
    if (isLoading || disabled || !uploadImage) return;
    
    try {
      // Pedir permisos
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso denegado',
            'Se necesita acceso a la galería para adjuntar imágenes.',
            [
              { text: 'OK' }
            ]
          );
          return;
        }
      }
      
      // Abrir selector de imágenes
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      // Manejar la selección de imagen
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsLoading(true);
        
        try {
          const imageUri = result.assets[0].uri;
          const imageUrl = await uploadImage(imageUri);
          
          if (imageUrl) {
            // Enviar mensaje con imagen
            onSend(text.trim() || 'Imagen', imageUrl);
            setText('');
          } else {
            Alert.alert('Error', 'No se pudo subir la imagen. Intente nuevamente.');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'No se pudo subir la imagen. Intente nuevamente.');
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo abrir la galería. Intente nuevamente.');
    }
  };
  
  const handleFocus = () => {
    // Podría usarse para marcar la conversación como leída
  };
  
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {uploadImage && (
          <TouchableOpacity 
            style={[styles.attachButton, (isLoading || disabled) && styles.disabledButton]} 
            onPress={handleAttachImage}
            disabled={isLoading || disabled}
          >
            <MaterialIcons name="photo-camera" size={24} color={isLoading || disabled ? "#C7C7CC" : "#007AFF"} />
          </TouchableOpacity>
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#8E8E93"
            multiline
            maxLength={500}
            onFocus={handleFocus}
            editable={!disabled}
          />
        </View>
        
        <TouchableOpacity 
          style={[
            styles.sendButton, 
            (text.trim().length === 0 || isLoading || disabled) && styles.disabledButton
          ]} 
          onPress={handleSend}
          disabled={text.trim().length === 0 || isLoading || disabled}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <MaterialIcons name="send" size={24} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9E9EB',
  },
  inputContainer: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    marginHorizontal: 8,
  },
  input: {
    minHeight: 36,
    maxHeight: 120,
    fontSize: 16,
    color: '#000',
    paddingTop: 8,
    paddingBottom: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ChatInput;
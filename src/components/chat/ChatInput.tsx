import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface ChatInputProps {
  onSend: (text: string, imageUrl?: string) => Promise<boolean | void>;
  uploadImage?: (uri: string) => Promise<string | null | undefined>;
  disabled?: boolean;
  keyboardVisible?: boolean;
  isModernIphone?: boolean; // Add this prop
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSend, 
  uploadImage, 
  disabled = false, 
  keyboardVisible = false,
  isModernIphone = false // Use this new prop
}) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { height: screenHeight } = Dimensions.get('window');
  
  // Focus the input when keyboard appears
  useEffect(() => {
    if (keyboardVisible && inputRef.current && Platform.OS === 'ios') {
      // Small delay to ensure keyboard is fully shown
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [keyboardVisible]);
  
  const handleSend = async () => {
    if (text.trim().length === 0 || isLoading) return;
    
    setIsLoading(true);
    const trimmedText = text.trim();
    setText('');
    
    try {
      console.log('Sending message:', trimmedText.substring(0, 20));
      await onSend(trimmedText);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
      // Re-focus the input after sending - helps with keyboard staying open
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };
  
  const compressAndResizeImage = async (uri: string): Promise<string> => {
    try {
      console.log('Comprimiendo imagen antes de subir...');
      return uri;
    } catch (error) {
      console.error('Error comprimiendo imagen:', error);
      return uri;
    }
  };
  
  const handleAttachImage = async () => {
    if (isLoading || !uploadImage) return;
    
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso denegado',
            'Se necesita acceso a la galería para adjuntar imágenes.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsLoading(true);
        
        try {
          const imageUri = result.assets[0].uri;
          const compressedUri = await compressAndResizeImage(imageUri);
          console.log('Subiendo imagen comprimida...');
          
          const imageUrl = await uploadImage(compressedUri);
          
          if (imageUrl) {
            console.log('Imagen subida exitosamente');
            await onSend(text.trim() || '', imageUrl);
            setText('');
          } else {
            console.error('Error al subir imagen');
            Alert.alert('Error', 'No se pudo subir la imagen. Verifique su conexión e intente nuevamente.');
          }
        } catch (error) {
          console.error('Error subiendo imagen:', error);
          let errorMessage = 'No se pudo subir la imagen.';
          
          if (error instanceof Error && error.message.includes('permission')) {
            errorMessage += ' No tienes permisos para subir imágenes en este momento.';
          } else if (error instanceof Error && error.message.includes('network')) {
            errorMessage += ' Verifica tu conexión a internet.';
          } else {
            errorMessage += ' Intenta nuevamente más tarde.';
          }
          
          Alert.alert('Error', errorMessage);
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error seleccionando imagen:', error);
      Alert.alert('Error', 'No se pudo abrir la galería. Intente nuevamente.');
    }
  };
  
  return (
    <View style={[
      styles.container,
      keyboardVisible && styles.containerWithKeyboard,
      Platform.OS === 'ios' && keyboardVisible && styles.iosKeyboardContainer,
      // Add extra padding for modern iPhones
      Platform.OS === 'ios' && isModernIphone && keyboardVisible && styles.modernIphoneContainer,
      Platform.OS === 'android' && styles.androidContainer
    ]}>
      {uploadImage && (
        <TouchableOpacity 
          style={[styles.attachButton, isLoading && styles.disabledButton]} 
          onPress={handleAttachImage}
          disabled={isLoading}
        >
          <View style={styles.attachButtonColor}>
            <MaterialIcons name="photo-camera" size={24} color="#FFFFFF" />
          </View>
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
          autoFocus={false}
          editable={!disabled && !isLoading}
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
          <View style={styles.sendButtonColor}>
            <MaterialIcons name="send" size={24} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9E9EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  containerWithKeyboard: {
    borderTopWidth: 0,
    shadowOpacity: 0,
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
  },
  iosKeyboardContainer: {
    paddingBottom: 8, 
    borderTopWidth: 0.5,
    borderTopColor: '#D1D1D6',
  },
  modernIphoneContainer: {
    paddingBottom: 12, // Extra padding for iPhone with notch/dynamic island
    borderTopWidth: 0.5,
  },
  androidContainer: {
    backgroundColor: '#FFFFFF',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#F0F2F8',
    paddingHorizontal: 16,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    minHeight: 42,
    maxHeight: 120,
    fontSize: 16,
    color: '#333333',
    paddingTop: 10,
    paddingBottom: 10,
  },
  attachButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  attachButtonColor: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sendButtonColor: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ChatInput;
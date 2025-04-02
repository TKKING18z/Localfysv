import React, { useState, useRef } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface ChatInputProps {
  onSend: (text: string, imageUrl?: string) => Promise<boolean | void>;
  uploadImage?: (uri: string) => Promise<string | null | undefined>; // Updated type to allow undefined
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, uploadImage, disabled = false }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  
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
      // Opcionalmente restaurar el texto en caso de error
      // setText(trimmedText);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Agregar función para comprimir imágenes antes de subir
  const compressAndResizeImage = async (uri: string): Promise<string> => {
    try {
      // En un escenario real, aquí implementarías la compresión de imágenes
      // con una librería como react-native-image-resizer
      
      // Para este ejemplo, simplemente devolvemos la misma URI
      // En una implementación real, reemplazarías esto con la compresión real
      console.log('Comprimiendo imagen antes de subir...');
      return uri;
      
      /* Ejemplo con react-native-image-resizer:
      const result = await ImageResizer.createResizedImage(
        uri,
        1200, // maxWidth
        1200, // maxHeight
        'JPEG',
        70, // quality (0-100)
        0, // rotation
        undefined, // outputPath
        false // keepMeta
      );
      return result.uri;
      */
    } catch (error) {
      console.error('Error comprimiendo imagen:', error);
      return uri; // Devolver original en caso de error
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
      
      // Usar MediaTypeOptions en lugar de MediaType para compatibilidad
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
          
          // Comprimir imagen antes de subir
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
          // Mensaje de error más detallado para ayudar al usuario
          let errorMessage = 'No se pudo subir la imagen.';
          
          // Si es un problema de permisos
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
    <View style={styles.container}>
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
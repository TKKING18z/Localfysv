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
import { LinearGradient } from 'expo-linear-gradient';

interface ChatInputProps {
  onSend: (text: string, imageUrl?: string) => Promise<boolean | void>; // Allow both return types
  uploadImage?: (uri: string) => Promise<string | null>;
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
            Alert.alert('Error', 'No se pudo subir la imagen. Intente nuevamente.');
          }
        } catch (error) {
          console.error('Error subiendo imagen:', error);
          Alert.alert('Error', 'No se pudo subir la imagen. Intente nuevamente.');
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
          <LinearGradient
            colors={['#5AC8FA', '#4CD964']}
            style={styles.attachButtonGradient}
          >
            <MaterialIcons name="photo-camera" size={22} color="#FFFFFF" />
          </LinearGradient>
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
          <LinearGradient
            colors={['#007AFF', '#00C2FF']}
            style={styles.sendButtonGradient}
          >
            <MaterialIcons name="send" size={22} color="#FFF" />
          </LinearGradient>
        )}
      </TouchableOpacity>
    </View>
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
  attachButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  sendButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ChatInput;
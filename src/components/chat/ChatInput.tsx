import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Keyboard,
  Image,
  Text,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

interface ChatInputProps {
  onSend: (text: string, imageUrl?: string) => Promise<boolean>;
  uploadImage: (uri: string) => Promise<string | null>;
  disabled?: boolean;
  keyboardVisible?: boolean;
  isModernIphone?: boolean;
  replyActive?: boolean;
}

// Definiendo los métodos que queremos exponer mediante la ref
export interface ChatInputRef {
  focus: () => void;
  blur: () => void;
}

// Usando forwardRef para pasar la referencia desde el padre
const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({
  onSend,
  uploadImage,
  disabled = false,
  keyboardVisible = false,
  isModernIphone = false,
  replyActive = false,
}, ref) => {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  
  // Exponemos la referencia del input al componente padre
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    blur: () => {
      inputRef.current?.blur();
    }
  }));

  // Color del botón de enviar basado en el estado
  const getSendButtonColor = () => {
    if (disabled || (!text.trim() && !selectedImage)) {
      return '#C7D2E3'; // Desactivado
    }
    if (isSending) {
      return '#0A84FF'; // Enviando
    }
    return replyActive ? '#0A84FF' : '#0A84FF'; // Normal (podríamos cambiar el color cuando se responde)
  };

  // Manejar el envío del mensaje
  const handleSend = async () => {
    if (disabled || isSending || (!text.trim() && !selectedImage)) {
      return;
    }

    try {
      setIsSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let imageUrlToSend: string | undefined = undefined;
      if (selectedImage) {
        const uploadedUrl = await uploadImage(selectedImage);
        if (uploadedUrl) {
          imageUrlToSend = uploadedUrl;
        }
      }

      const trimmedText = text.trim();

      if (!trimmedText && !imageUrlToSend) {
        setIsSending(false);
        return;
      }

      const success = await onSend(trimmedText, imageUrlToSend);

      if (success) {
        setText('');
        setSelectedImage(null);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Abrir cámara usando ImagePicker
  const openCamera = async () => {
    if (disabled) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Solicitar permisos para usar la cámara
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos', 
          'Necesitamos permiso para usar la cámara.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Abrir la cámara directamente
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  // Seleccionar imagen de la galería
  const pickImage = async () => {
    if (disabled || isSending || isUploading) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert('Se necesita permiso para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  // Cancelar imagen seleccionada
  const cancelImage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImage(null);
  };

  return (
    <View style={[
      styles.container,
      Platform.OS === 'ios' && keyboardVisible && isModernIphone && styles.keyboardVisible,
      replyActive && styles.replyActive
    ]}>
      {/* Botón de cámara */}
      <TouchableOpacity
        style={[styles.iconButton, (disabled) && styles.disabledButton]}
        onPress={openCamera}
        disabled={disabled}
      >
        <MaterialIcons
          name="photo-camera"
          size={24}
          color={disabled ? '#C7D2E3' : '#0A84FF'}
        />
      </TouchableOpacity>

      {/* Botón de galería */}
      <TouchableOpacity
        style={[styles.iconButton, (isUploading || disabled) && styles.disabledButton]}
        onPress={pickImage}
        disabled={isUploading || disabled}
      >
        <MaterialIcons
          name="photo-library"
          size={24}
          color={disabled ? '#C7D2E3' : '#0A84FF'}
        />
      </TouchableOpacity>

      {/* Contenedor de input */}
      <View style={styles.inputContainer}>
        {/* Imagen seleccionada (miniatura) */}
        {selectedImage && (
          <View style={styles.selectedImageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            <TouchableOpacity style={styles.cancelImageButton} onPress={cancelImage}>
              <MaterialIcons name="close" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Campo de texto */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={replyActive ? "Escribe tu respuesta..." : "Escribe un mensaje..."}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          editable={!disabled}
          returnKeyType="default"
          placeholderTextColor="#8E8E93"
        />
      </View>

      {/* Botón de enviar */}
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!text.trim() && !selectedImage) && styles.disabledButton,
          disabled && styles.disabledButton,
          replyActive && styles.replySendButton
        ]}
        onPress={handleSend}
        disabled={disabled || (!text.trim() && !selectedImage)}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <MaterialIcons
            name="send"
            size={22}
            color={(!text.trim() && !selectedImage) || disabled ? '#C7D2E3' : '#FFF'}
          />
        )}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5EAFC',
  },
  keyboardVisible: {
    paddingBottom: 30, // Añadir espacio extra para iPhones modernos
  },
  replyActive: {
    backgroundColor: '#F0F7FF', // Fondo diferente cuando hay respuesta activa
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    marginRight: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0A1629',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  replySendButton: {
    backgroundColor: '#0A84FF', // Podríamos cambiar el color si queremos
  },
  selectedImageContainer: {
    position: 'relative',
    marginRight: 8,
  },
  selectedImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  cancelImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  }
});

export default ChatInput;
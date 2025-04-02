import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

type NavigationProps = StackNavigationProp<RootStackParamList>;

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  attachments: {
    uri: string;
    name: string;
    type: string;
  }[];
}

const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_SIZE_MB = 5; // 5MB maximum
const MAX_IMAGE_WIDTH = 1200; // Resize images larger than this

const SupportScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    attachments: []
  });

  // Load user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      const user = firebase.auth().currentUser;
      if (user) {
        try {
          const userDoc = await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            setFormData(prev => ({
              ...prev,
              name: userData?.displayName || user.displayName || '',
              email: userData?.email || user.email || ''
            }));
          }
        } catch (error) {
          console.error('Error al cargar datos de usuario:', error);
        }
      }
    };

    loadUserData();
  }, []);

  // Compress image before upload
  const compressImage = async (uri: string): Promise<string> => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_IMAGE_WIDTH } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      return manipResult.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri;
    }
  };

  // Upload a single attachment with more detailed error handling
  const uploadAttachment = async (fileUri: string): Promise<string | null> => {
    try {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error('User not authenticated');

      // Compress image
      const compressedUri = await compressImage(fileUri);
      
      // Generate unique filename (simplify to avoid special characters)
      const timestamp = Date.now();
      const fileName = `support_${timestamp}.jpg`;
      
      // Convert URI to blob
      const response = await fetch(compressedUri);
      const blob = await response.blob();

      // Validate file size
      if (blob.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        throw new Error(`File exceeds maximum size of ${MAX_IMAGE_SIZE_MB}MB`);
      }
      
      // Storage reference with explicit path matching the storage rules
      // Use exactly the path format defined in your rules
      const storageRef = firebase.storage().ref(`support_attachments/${user.uid}/${fileName}`);

      // Simplified metadata - just use contentType
      const metadata = {
        contentType: 'image/jpeg'
      };

      console.log(`Uploading to path: support_attachments/${user.uid}/${fileName}`);

      // Upload with detailed error handling
      return new Promise((resolve, reject) => {
        const uploadTask = storageRef.put(blob, metadata);

        uploadTask.on(
          firebase.storage.TaskEvent.STATE_CHANGED,
          (snapshot) => {
            // Handle progress if needed
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload progress: ${progress}%`);
          },
          (error) => {
            // Handle unsuccessful uploads with more detailed error logging
            console.error('Upload error code:', error.code);
            console.error('Upload error message:', error.message);
            
            if (error.code === 'storage/unauthorized') {
              console.error('Permission denied. Check Firebase Storage rules.');
            }
            
            reject(error);
          },
          async () => {
            try {
              // Get download URL after successful upload
              const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
              console.log('Upload successful, URL:', downloadURL);
              resolve(downloadURL);
            } catch (urlError) {
              console.error('Error getting download URL:', urlError);
              reject(urlError);
            }
          }
        );
      });
    } catch (error) {
      console.error('Attachment upload error:', error);
      
      // More informative error handling
      let errorMessage = 'Failed to upload attachment';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Log more details for debugging
        console.error('Error type:', error.constructor.name);
        console.error('Error stack:', error.stack);
      }
      
      Alert.alert(
        'Upload Error', 
        errorMessage,
        [{ text: 'OK' }]
      );
      
      return null;
    }
  };

  // Handle attachment selection
  const handleAttachImage = useCallback(async () => {
    if (formData.attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Límite alcanzado', `Solo puedes adjuntar ${MAX_ATTACHMENTS} imágenes`);
      return;
    }

    try {
      console.log('Requesting media library permissions');
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar imágenes.');
        return;
      }
      
      console.log('Launching image picker');
      // Launch image picker with improved options
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Allow editing for better cropping
        quality: 0.7,
        base64: false,
        aspect: [4, 3], // Suggest a reasonable aspect ratio
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        
        // Check file size before proceeding (rough estimate from URI)
        try {
          const fileInfo = await fetch(selectedImage.uri, { method: 'HEAD' });
          const contentLength = fileInfo.headers.get('Content-Length');
          const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
          
          if (fileSize > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
            Alert.alert('Archivo demasiado grande', 
              `La imagen seleccionada excede el límite de ${MAX_IMAGE_SIZE_MB}MB. Por favor selecciona una imagen más pequeña.`);
            return;
          }
        } catch (sizeError) {
          console.log('Unable to check file size, continuing anyway');
        }
        
        // Generate a clean filename
        const timestamp = Date.now();
        const fileName = `imagen_${timestamp}.jpg`;
        
        // Detect mime type from extension or default to jpg
        let mimeType = 'image/jpeg';
        const originalExt = selectedImage.uri.split('.').pop()?.toLowerCase();
        
        if (originalExt === 'png') mimeType = 'image/png';
        if (originalExt === 'gif') mimeType = 'image/gif';
        if (originalExt === 'webp') mimeType = 'image/webp';
        
        console.log(`Selected image: ${fileName}, type: ${mimeType}`);
        
        setFormData(prev => ({
          ...prev,
          attachments: [
            ...prev.attachments, 
            {
              uri: selectedImage.uri,
              name: fileName,
              type: mimeType
            }
          ]
        }));
      } else {
        console.log('Image selection cancelled or no image selected');
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Por favor intenta de nuevo.');
    }
  }, [formData.attachments]);

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  }, []);

  // Form validation
  const validateForm = useCallback((): boolean => {
    if (!formData.name.trim()) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu nombre');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu correo');
      return false;
    }
    if (!formData.subject.trim()) {
      Alert.alert('Campos incompletos', 'Por favor ingresa el asunto');
      return false;
    }
    if (!formData.message.trim()) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu mensaje');
      return false;
    }
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Correo inválido', 'Por favor ingresa un correo electrónico válido');
      return false;
    }
    return true;
  }, [formData]);

  // Handle form submission with comprehensive error handling
  const handleSubmit = async () => {
    // Validation logic
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error('User not authenticated');
      
      console.log('Starting form submission for user:', user.uid);
      
      // Upload attachments with detailed error tracking
      const attachmentUrls: string[] = [];
      let uploadSuccess = true;
      
      // Try uploading each attachment
      if (formData.attachments.length > 0) {
        console.log(`Attempting to upload ${formData.attachments.length} attachments`);
        
        for (let i = 0; i < formData.attachments.length; i++) {
          const attachment = formData.attachments[i];
          console.log(`Processing attachment ${i+1}/${formData.attachments.length}`);
          
          try {
            console.log('Starting upload for:', attachment.name);
            const uploadedUrl = await uploadAttachment(attachment.uri);
            
            if (uploadedUrl) {
              console.log('Upload successful, adding URL to attachments list');
              attachmentUrls.push(uploadedUrl);
            } else {
              console.error('Upload returned null URL');
              uploadSuccess = false;
            }
          } catch (uploadError) {
            console.error('Individual attachment upload failed:', uploadError);
            uploadSuccess = false;
            // Continue with other attachments
          }
        }
      } else {
        console.log('No attachments to upload');
      }
      
      if (!uploadSuccess) {
        console.warn('Some attachments failed to upload but continuing with available ones');
      }
      
      console.log('Creating support ticket in Firestore');
      
      // Create support ticket document
      await firebase.firestore()
        .collection('support_tickets')
        .add({
          userId: user.uid,
          name: formData.name.trim(),
          email: formData.email.trim(),
          subject: formData.subject.trim(),
          message: formData.message.trim(),
          status: 'pending',
          attachments: attachmentUrls,
          attachmentCount: attachmentUrls.length,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          source: 'mobile_app'
        });

      console.log('Support ticket created successfully');

      // Success alert
      Alert.alert(
        'Mensaje Enviado',
        'Hemos recibido tu mensaje. Nos pondremos en contacto contigo pronto.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Support ticket submission error:', error);
      
      // Detailed error handling
      let errorMessage = 'Failed to submit support ticket';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      Alert.alert(
        'Error de Envío', 
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Contactar Soporte</Text>
        <View style={styles.emptySpace} />
      </View>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.formContainer}>
            <Text style={styles.formDescription}>
              Completa el formulario a continuación y nuestro equipo de soporte se pondrá en contacto contigo lo antes posible.
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                placeholder="Tu nombre"
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                placeholder="tu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Asunto</Text>
              <TextInput
                style={styles.input}
                value={formData.subject}
                onChangeText={(text) => setFormData({...formData, subject: text})}
                placeholder="¿En qué podemos ayudarte?"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mensaje</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.message}
                onChangeText={(text) => setFormData({...formData, message: text})}
                placeholder="Describe tu problema o consulta en detalle"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
            
            <View style={styles.attachmentsContainer}>
              <Text style={styles.inputLabel}>Adjuntar capturas de pantalla (opcional)</Text>
              <View style={styles.attachmentList}>
                {formData.attachments.map((file, index) => (
                  <View key={index} style={styles.attachmentItem}>
                    <Image 
                      source={{ uri: file.uri }}
                      style={styles.thumbnailImage}
                    />
                    <Text style={styles.attachmentName} numberOfLines={1} ellipsizeMode="middle">
                      {file.name}
                    </Text>
                    <TouchableOpacity onPress={() => removeAttachment(index)}>
                      <MaterialIcons name="close" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                {formData.attachments.length < MAX_ATTACHMENTS && (
                  <TouchableOpacity 
                    style={styles.addAttachmentButton} 
                    onPress={handleAttachImage}
                  >
                    <MaterialIcons name="add-photo-alternate" size={22} color="#007AFF" />
                    <Text style={styles.addAttachmentText}>Añadir imagen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <MaterialIcons name="send" size={20} color="white" />
                  <Text style={styles.submitButtonText}>Enviar mensaje</Text>
                </>
              )}
            </TouchableOpacity>
            
            <View style={styles.alternativeContact}>
              <MaterialIcons name="info-outline" size={18} color="#8E8E93" />
              <Text style={styles.alternativeContactText}>
                También puedes contactarnos por correo a <Text style={styles.emailHighlight}>soporte@localfy.com</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  emptySpace: {
    width: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    padding: 16,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  formDescription: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DEDEDE',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    minHeight: 120,
  },
  attachmentsContainer: {
    marginBottom: 20,
  },
  attachmentList: {
    marginTop: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  thumbnailImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 10,
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    marginRight: 8,
  },
  addAttachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
  },
  addAttachmentText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#AACFFF',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  alternativeContact: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alternativeContactText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 6,
    textAlign: 'center',
  },
  emailHighlight: {
    fontWeight: '600',
    color: '#007AFF',
  },
});

export default SupportScreen;
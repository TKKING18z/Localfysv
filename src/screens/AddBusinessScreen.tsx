import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as ImagePicker from 'expo-image-picker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

type NavigationProps = StackNavigationProp<RootStackParamList>;

const AddBusinessScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState<string | null>(null);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Pick an image from the gallery
  const pickImage = async () => {
    try {
      // Request permission
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso denegado', 'Necesitamos permiso para acceder a tus fotos.');
          return;
        }
      }
      
      // Launch image library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  // Submit the form
  const handleSubmit = async () => {
    // Validate form
    if (!name.trim() || !description.trim() || !category.trim() || !image) {
      Alert.alert('Información incompleta', 'Por favor completa todos los campos y selecciona una imagen.');
      return;
    }
    
    setIsLoading(true);
    setUploadProgress(0);
    
    try {
      // Get current user
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'Debes iniciar sesión para agregar un negocio.');
        setIsLoading(false);
        return;
      }
      
      console.log("Current user:", currentUser.uid, currentUser.email);
      
      // Generate a unique ID for the business
      const businessRef = firebase.firestore().collection('businesses').doc();
      const businessId = businessRef.id;
      
      console.log("Created business ID:", businessId);
      
      try {
        // First create the business document without images
        const initialBusinessData = {
          name,
          description,
          category,
          images: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: currentUser.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        
        // Save initial business data to Firestore
        await businessRef.set(initialBusinessData);
        console.log("Business document created successfully");
        
        // Then try to upload the image
        const imageId = `${businessId}_main_${Date.now()}`;
        const storageRef = firebase.storage().ref();
        const imageRef = storageRef.child(`businesses/${businessId}/images/${imageId}`);
        
        console.log("Attempting to upload image to:", `businesses/${businessId}/images/${imageId}`);
        
        // Convert image URI to blob
        const response = await fetch(image);
        const blob = await response.blob();
        
        // Upload blob to firebase storage with progress tracking
        const uploadTask = imageRef.put(blob);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Track upload progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
            console.log(`Upload progress: ${progress.toFixed(0)}%`);
          },
          (error) => {
            console.error('Upload error details:', error);
            
            // Handle specific error codes
            if (error.code === 'storage/unauthorized') {
              Alert.alert(
                'Error de Permisos', 
                'No tienes permisos para subir imágenes. Contacta al administrador para actualizar las reglas de Firebase Storage.'
              );
            } else {
              Alert.alert('Error', `Error al subir la imagen: ${error.message}`);
            }
            
            // Even if image upload fails, we already created the business
            Alert.alert(
              'Negocio Creado Parcialmente', 
              'El negocio fue creado pero hubo un problema al subir la imagen. Puedes intentar agregar la imagen más tarde.'
            );
            setIsLoading(false);
            navigation.goBack();
          },
          async () => {
            // Upload completed successfully
            try {
              // Get the download URL
              const downloadURL = await imageRef.getDownloadURL();
              console.log("Image uploaded successfully, URL:", downloadURL);
              
              // Update business with image information
              await businessRef.update({
                images: firebase.firestore.FieldValue.arrayUnion({
                  id: imageId,
                  url: downloadURL,
                  isMain: true
                })
              });
              
              console.log("Business document updated with image");
              
              Alert.alert('Éxito', 'Negocio agregado correctamente');
              setIsLoading(false);
              
              // Navigate back
              navigation.goBack();
            } catch (error) {
              console.error('Error getting download URL:', error);
              Alert.alert(
                'Negocio Creado Parcialmente', 
                'El negocio fue creado pero hubo un problema al procesar la imagen. Puedes intentar agregar la imagen más tarde.'
              );
              setIsLoading(false);
              navigation.goBack();
            }
          }
        );
      } catch (error) {
        console.error('Error in image upload or business creation:', error);
        Alert.alert('Error', 'No se pudo completar el proceso.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error adding business:', error);
      Alert.alert('Error', 'No se pudo agregar el negocio. Intenta nuevamente.');
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Agregar Negocio</Text>
            <View style={styles.placeholder}></View>
          </View>
          
          {/* Form */}
          <View style={styles.form}>
            {/* Name field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre del Negocio</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nombre del negocio"
                placeholderTextColor="#8E8E93"
              />
            </View>
            
            {/* Description field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe tu negocio..."
                placeholderTextColor="#8E8E93"
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            
            {/* Category field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Categoría</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="Categoría (ej. Restaurante, Tienda)"
                placeholderTextColor="#8E8E93"
              />
            </View>
            
            {/* Image picker */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Imagen Principal</Text>
              <TouchableOpacity 
                style={styles.imagePicker} 
                onPress={pickImage}
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.selectedImage} />
                ) : (
                  <View style={styles.placeholderContainer}>
                    <MaterialIcons name="add-photo-alternate" size={40} color="#8E8E93" />
                    <Text style={styles.placeholderText}>Seleccionar Imagen</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {isLoading && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Subiendo imagen: {uploadProgress.toFixed(0)}%
                </Text>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      {width: `${uploadProgress}%`}
                    ]} 
                  />
                </View>
              </View>
            )}
          </View>
          
          {/* Submit Button */}
          <TouchableOpacity 
            style={[
              styles.submitButton,
              isLoading ? styles.submitButtonDisabled : {}
            ]} 
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Agregar Negocio</Text>
            )}
          </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  placeholder: {
    width: 40,
  },
  form: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333333',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  imagePicker: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 200,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  submitButtonDisabled: {
    backgroundColor: '#7FB5FF',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddBusinessScreen;

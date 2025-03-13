import React, { useState, useEffect } from 'react';
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
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../navigation/AppNavigator';
import { firebaseService } from '../services/firebaseService';
import { BusinessHours, SocialLinks } from '../context/BusinessContext';
import { useStore } from '../context/StoreContext';

type NavigationProps = StackNavigationProp<RootStackParamList>;

// Tipo para los videos
interface VideoItem {
  id?: string;
  url: string;
  thumbnail?: string;
}

// Tipo para los items de menú
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

const AddBusinessScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const store = useStore(); // Utilizar el store para los callbacks
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [image, setImage] = useState<string | null>(null);
  
  // Advanced business details
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours | undefined>(undefined);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | undefined>(undefined);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuUrl, setMenuUrl] = useState('');
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Limpiar callbacks al desmontar
  useEffect(() => {
    return () => {
      // Remover todos los callbacks pendientes
      const callbacksToClear = [
        'businessHours_callback',
        'paymentMethods_callback',
        'socialLinks_callback',
        'videoManager_callback',
        'menuEditor_callback'
      ];
      
      callbacksToClear.forEach(id => {
        if (store.getCallback(id)) {
          store.removeCallback(id);
        }
      });
    };
  }, []);

  // Get current location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Se requiere permiso de ubicación');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      // Optionally get address
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (addresses.length > 0) {
        const firstAddress = addresses[0];
        setAddress(
          `${firstAddress.streetNumber || ''} ${firstAddress.street || ''}, 
          ${firstAddress.city || ''}, ${firstAddress.region || ''}`
        );
      }
    } catch (error) {
      console.error('Error de ubicación:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación actual');
    }
  };

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
      console.log('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  // Navigate to BusinessHours screen
  const navigateToBusinessHours = () => {
    // Usar un ID de callback fijo para simplificar
    const callbackId = 'businessHours_callback';
    
    // Verificar si hay un callback anterior y eliminarlo
    if (store.getCallback(callbackId)) {
      store.removeCallback(callbackId);
    }
    
    // Crear nuevo callback
    store.setCallback(callbackId, (hours: BusinessHours) => {
      console.log('BusinessHours callback ejecutado con datos:', hours);
      setBusinessHours(hours);
    });
    
    // Navigate with fixed callbackId
    navigation.navigate('BusinessHours', {
      initialHours: businessHours,
      callbackId: callbackId
    });
  };

  // Navigate to PaymentMethods screen
  const navigateToPaymentMethods = () => {
    const callbackId = 'paymentMethods_callback';
    
    // Verificar si hay un callback anterior y eliminarlo
    if (store.getCallback(callbackId)) {
      store.removeCallback(callbackId);
    }
    
    store.setCallback(callbackId, (methods: string[]) => {
      console.log('PaymentMethods callback ejecutado con datos:', methods);
      setPaymentMethods(methods);
    });
    
    navigation.navigate('PaymentMethods', {
      initialMethods: paymentMethods,
      callbackId: callbackId
    });
  };

  // Navigate to SocialLinks screen
  const navigateToSocialLinks = () => {
    const callbackId = 'socialLinks_callback';
    
    // Verificar si hay un callback anterior y eliminarlo
    if (store.getCallback(callbackId)) {
      store.removeCallback(callbackId);
    }
    
    store.setCallback(callbackId, (links: SocialLinks) => {
      console.log('SocialLinks callback ejecutado con datos:', links);
      setSocialLinks(links);
    });
    
    navigation.navigate('SocialLinks', {
      initialLinks: socialLinks,
      callbackId: callbackId
    });
  };

  // Navigate to VideoManager screen
  const navigateToVideoManager = () => {
    const callbackId = 'videoManager_callback';
    
    // Verificar si hay un callback anterior y eliminarlo
    if (store.getCallback(callbackId)) {
      store.removeCallback(callbackId);
    }
    
    store.setCallback(callbackId, (newVideos: VideoItem[]) => {
      console.log('VideoManager callback ejecutado con datos:', newVideos);
      setVideos(newVideos);
    });
    
    navigation.navigate('VideoManager', {
      businessId: 'new_business', 
      initialVideos: videos,
      callbackId: callbackId
    });
  };

  // Navigate to MenuEditor screen
  const navigateToMenuEditor = () => {
    const callbackId = 'menuEditor_callback';
    
    // Verificar si hay un callback anterior y eliminarlo
    if (store.getCallback(callbackId)) {
      store.removeCallback(callbackId);
    }
    
    store.setCallback(callbackId, (newMenu: MenuItem[], newMenuUrl: string) => {
      console.log('MenuEditor callback ejecutado con datos:', { menu: newMenu, menuUrl: newMenuUrl });
      setMenu(newMenu);
      setMenuUrl(newMenuUrl);
    });
    
    navigation.navigate('MenuEditor', {
      businessId: 'new_business',
      initialMenu: menu,
      menuUrl,
      callbackId: callbackId
    });
  };

  // Submit the form
  const handleSubmit = async () => {
    // Validate form
    if (!name.trim() || !description.trim() || !category.trim() || !image) {
      Alert.alert('Información incompleta', 'Por favor completa los campos obligatorios');
      return;
    }
    
    setIsLoading(true);
    setUploadProgress(0);
    
    try {
      // Log form data for debugging
      console.log('Form data siendo enviados:', {
        name, description, category, address, phone, email, website,
        location, businessHours, paymentMethods, socialLinks, videos, menu, menuUrl
      });
      
      // Prepare business data
      const businessData = {
        name,
        description,
        category,
        address,
        phone,
        email,
        website,
        location: location ? JSON.stringify(location) : undefined,
        businessHours,
        paymentMethods,
        socialLinks,
        videos,
        menu,
        menuUrl,
        images: []  // Will be populated in the upload process
      };
      
      // Create business in Firestore
      const result = await firebaseService.businesses.create(businessData);
      
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Error al crear negocio');
      }
      
      const businessId = result.data.id;
      
      // Upload main image
      if (image) {
        const uploadResult = await firebaseService.storage.uploadImage(
          image, 
          `businesses/${businessId}/images/main_${Date.now()}.jpg`
        );
        
        if (uploadResult.success && uploadResult.data) {
          // Update business with image
          await firebaseService.businesses.update(businessId, {
            images: [{
              id: `img-${Date.now()}`,
              url: uploadResult.data,
              isMain: true
            }]
          });
        }
      }
      
      Alert.alert('Éxito', 'Negocio agregado correctamente');
      navigation.goBack();
    } catch (error) {
      console.error('Error al agregar negocio:', error);
      Alert.alert('Error', 'No se pudo agregar el negocio. Intenta nuevamente.');
    } finally {
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
            {/* Basic Info Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Información Básica</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre del Negocio *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nombre del negocio"
                  placeholderTextColor="#8E8E93"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción *</Text>
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
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Categoría *</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Categoría (ej. Restaurante, Tienda)"
                  placeholderTextColor="#8E8E93"
                />
              </View>
            </View>
            
            {/* Contact Info Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Información de Contacto</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Dirección</Text>
                <View style={styles.locationInputContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Dirección del negocio"
                    placeholderTextColor="#8E8E93"
                  />
                  <TouchableOpacity 
                    style={styles.locationButton}
                    onPress={getCurrentLocation}
                  >
                    <MaterialIcons name="my-location" size={24} color="#007AFF" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Número de contacto"
                  placeholderTextColor="#8E8E93"
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Correo Electrónico</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Correo de contacto"
                  placeholderTextColor="#8E8E93"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Sitio Web</Text>
                <TextInput
                  style={styles.input}
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="URL del sitio web"
                  placeholderTextColor="#8E8E93"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>
            
            {/* Advanced Details Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Detalles Adicionales</Text>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToBusinessHours}
              >
                <MaterialIcons name="access-time" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Horarios de Atención</Text>
                {businessHours && Object.keys(businessHours).length > 0 && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToPaymentMethods}
              >
                <MaterialIcons name="payment" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Métodos de Pago</Text>
                {paymentMethods.length > 0 && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToSocialLinks}
              >
                <MaterialIcons name="link" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Redes Sociales</Text>
                {socialLinks && Object.keys(socialLinks).length > 0 && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToVideoManager}
              >
                <MaterialIcons name="videocam" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Videos</Text>
                {videos.length > 0 && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToMenuEditor}
              >
                <MaterialIcons name="restaurant-menu" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Menú</Text>
                {(menu.length > 0 || menuUrl) && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
            </View>
            
            {/* Image Picker */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Imagen Principal *</Text>
              <TouchableOpacity 
                style={styles.imagePicker} 
                onPress={pickImage}
              >
                {image ? (
                  <Image 
                    source={{ uri: image }} 
                    style={styles.selectedImage} 
                    resizeMode="cover" 
                  />
                ) : (
                  <View style={styles.placeholderContainer}>
                    <MaterialIcons name="add-photo-alternate" size={40} color="#8E8E93" />
                    <Text style={styles.placeholderText}>Seleccionar Imagen</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Progress Indicator */}
            {isLoading && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Subiendo información: {uploadProgress.toFixed(0)}%
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
              <>
                <MaterialIcons name="save" size={24} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Guardar Negocio</Text>
              </>
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
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationButton: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
  },
  imagePicker: {
    height: 200,
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 16,
    color: '#8E8E93',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  advancedButtonText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
    flex: 1,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
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
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#7FB5FF',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default AddBusinessScreen;
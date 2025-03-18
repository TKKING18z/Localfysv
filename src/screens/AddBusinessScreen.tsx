import React, { useState, useEffect, useCallback } from 'react';
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
  KeyboardAvoidingView,
  BackHandler
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { RootStackParamList } from '../navigation/AppNavigator';
import { firebaseService } from '../services/firebaseService';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';

// Navigation type
type AddBusinessScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddBusiness'>;

// Define all needed interfaces
interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}

// Define day of week type for type safety
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// BusinessHours interface with index signature
interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
  [key: string]: DayHours | undefined;
}

// SocialLinks interface
interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  website?: string;
  [key: string]: string | undefined;
}

// Video item interface
interface VideoItem {
  id?: string;
  url: string;
  thumbnail?: string;
}

// Menu item interface
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

// Business location interface
interface BusinessLocation {
  latitude: number; 
  longitude: number;
}

// Business data interface
interface BusinessData {
  name: string;
  description: string;
  category: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  location?: BusinessLocation | string;
  businessHours?: BusinessHours;
  paymentMethods?: string[];
  socialLinks?: SocialLinks;
  videos?: VideoItem[];
  menu?: MenuItem[];
  menuUrl?: string;
  images?: Array<{id?: string, url: string, isMain?: boolean}>;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

// Create unique callback IDs for each screen
const CALLBACK_IDS = {
  BUSINESS_HOURS: 'businessHours_callback',
  PAYMENT_METHODS: 'paymentMethods_callback',
  SOCIAL_LINKS: 'socialLinks_callback',
  VIDEO_MANAGER: 'videoManager_callback',
  MENU_EDITOR: 'menuEditor_callback'
};

const AddBusinessScreen: React.FC = () => {
  const navigation = useNavigation<AddBusinessScreenNavigationProp>();
  const store = useStore();
  const { user } = useAuth();
  
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
  const [location, setLocation] = useState<BusinessLocation | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours | undefined>(undefined);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | undefined>(undefined);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuUrl, setMenuUrl] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track form changes - Fix the infinite loop by using a flag
  useEffect(() => {
    // Only update if content actually changed (not just on initial render)
    if (name || description || category || address || phone || email || website || image || 
        location || businessHours || paymentMethods?.length || 
        socialLinks || videos.length || menu.length || menuUrl) {
      if (!hasUnsavedChanges) {
        setHasUnsavedChanges(true);
      }
    } else if (hasUnsavedChanges) {
      // Reset flag if no content
      setHasUnsavedChanges(false);
    }
  }, [name, description, category, address, phone, email, website, image, 
      location, businessHours, paymentMethods, socialLinks, videos, menu, menuUrl, hasUnsavedChanges]);

  // Handle back button to prevent accidental navigation away
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (hasUnsavedChanges) {
          Alert.alert(
            "Cambios sin guardar",
            "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?",
            [
              { text: "Cancelar", style: "cancel", onPress: () => {} },
              { text: "Descartar cambios", style: "destructive", onPress: () => navigation.goBack() }
            ]
          );
          return true; // Prevent default behavior
        } else {
          return false; // Let default behavior happen
        }
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [hasUnsavedChanges, navigation])
  );

  // Use a ref to track if callbacks are already registered to prevent duplicate registrations
  const callbacksRegistered = React.useRef(false);

  // Register callbacks exactly once during component lifecycle
  useEffect(() => {
    // Only register callbacks if they haven't been registered yet
    if (!callbacksRegistered.current) {
      console.log('AddBusinessScreen - registering callbacks (first time only)');
      
      // Register all callbacks
      store.setCallback(CALLBACK_IDS.PAYMENT_METHODS, (methods: string[]) => {
        console.log('PaymentMethods callback executed with data:', methods);
        setPaymentMethods(methods);
      });
      
      store.setCallback(CALLBACK_IDS.BUSINESS_HOURS, (hours: BusinessHours) => {
        console.log('BusinessHours callback executed with data:', hours);
        setBusinessHours(hours);
      });
      
      store.setCallback(CALLBACK_IDS.SOCIAL_LINKS, (links: SocialLinks) => {
        console.log('SocialLinks callback executed with data:', links);
        setSocialLinks(links);
      });
      
      store.setCallback(CALLBACK_IDS.VIDEO_MANAGER, (newVideos: VideoItem[]) => {
        console.log('VideoManager callback executed with data:', newVideos);
        setVideos(newVideos);
      });
      
      store.setCallback(CALLBACK_IDS.MENU_EDITOR, (newMenu: MenuItem[], newMenuUrl: string) => {
        console.log('MenuEditor callback executed with data:', { menu: newMenu, menuUrl: newMenuUrl });
        setMenu(newMenu);
        setMenuUrl(newMenuUrl);
      });
      
      callbacksRegistered.current = true;
    }
    
    // True cleanup only on component unmount using AbortController to prevent multiple cleanup attempts
    const controller = new AbortController();
    
    return () => {
      // Only clean up if this is a final unmount (not a re-render)
      if (controller.signal.aborted) {
        return;
      }
      
      console.log('AddBusinessScreen truly unmounting - final cleanup');
      Object.values(CALLBACK_IDS).forEach(id => {
        store.removeCallback(id);
      });
      
      controller.abort();
    };
  }, []); // Empty dependency array ensures this runs exactly once

  // Get current location with error handling
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Se requiere permiso de ubicación para esta funcionalidad');
        return;
      }

      setIsLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      // Try to get address
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        
        if (addresses.length > 0) {
          const firstAddress = addresses[0];
          const addressStr = [
            firstAddress.street && firstAddress.streetNumber ? 
              `${firstAddress.streetNumber} ${firstAddress.street}` : 
              firstAddress.street || firstAddress.name,
            firstAddress.district,
            firstAddress.city,
            firstAddress.region,
            firstAddress.country
          ].filter(Boolean).join(', ');
          
          setAddress(addressStr);
        }
      } catch (addressError) {
        console.error('Error obteniendo dirección:', addressError);
        // Continue without address
      }
      
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      console.error('Error de ubicación:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación actual. Intente nuevamente.');
    }
  };

  // Pick an image from the gallery with better error handling
  const pickImage = async () => {
    try {
      // Request permission
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso denegado', 
            'Necesitamos permiso para acceder a tus fotos. Por favor habilita el permiso en configuración.'
          );
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
        const selectedUri = result.assets[0].uri;
        
        // Verify image size (optional: limit to 5MB)
        const fileInfo = await fetch(selectedUri).then(r => {
          const contentLength = r.headers.get('Content-Length');
          return contentLength ? parseInt(contentLength, 10) : 0;
        });
        
        if (fileInfo > 5 * 1024 * 1024) {
          Alert.alert(
            'Imagen demasiado grande', 
            'Por favor selecciona una imagen más pequeña (máximo 5MB)'
          );
          return;
        }
        
        setImage(selectedUri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Intente nuevamente.');
    }
  };

  // Navigate to BusinessHours screen with improved error handling
  const navigateToBusinessHours = () => {
    try {
      navigation.navigate('BusinessHours' as keyof RootStackParamList, {
        initialHours: businessHours,
        callbackId: CALLBACK_IDS.BUSINESS_HOURS
      } as any);
    } catch (error) {
      console.error('Error navegando a BusinessHours:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de horarios. Intente nuevamente.');
    }
  };

  // Navigate to PaymentMethods screen with improved error handling
  const navigateToPaymentMethods = () => {
    try {
      console.log('Navigating to PaymentMethods with callbackId:', CALLBACK_IDS.PAYMENT_METHODS);
      navigation.navigate('PaymentMethods', {
        initialMethods: paymentMethods,
        callbackId: CALLBACK_IDS.PAYMENT_METHODS
      } as any);
    } catch (error) {
      console.error('Error navegando a PaymentMethods:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de métodos de pago. Intente nuevamente.');
    }
  };

  // Navigate to SocialLinks screen with improved error handling
  const navigateToSocialLinks = () => {
    try {
      navigation.navigate('SocialLinks' as keyof RootStackParamList, {
        initialLinks: socialLinks,
        callbackId: CALLBACK_IDS.SOCIAL_LINKS
      } as any);
    } catch (error) {
      console.error('Error navegando a SocialLinks:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de redes sociales. Intente nuevamente.');
    }
  };

  // Navigate to VideoManager screen with improved error handling
  const navigateToVideoManager = () => {
    try {
      navigation.navigate('VideoManager' as keyof RootStackParamList, {
        businessId: 'new_business', 
        initialVideos: videos,
        callbackId: CALLBACK_IDS.VIDEO_MANAGER
      } as any);
    } catch (error) {
      console.error('Error navegando a VideoManager:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de videos. Intente nuevamente.');
    }
  };

  // Navigate to MenuEditor screen with improved error handling
  const navigateToMenuEditor = () => {
    try {
      navigation.navigate('MenuEditor' as keyof RootStackParamList, {
        businessId: 'new_business',
        initialMenu: menu,
        menuUrl,
        callbackId: CALLBACK_IDS.MENU_EDITOR
      } as any);
    } catch (error) {
      console.error('Error navegando a MenuEditor:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de menú. Intente nuevamente.');
    }
  };

  // Validate form before submission
  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Información incompleta', 'El nombre del negocio es obligatorio');
      return false;
    }
    
    if (!description.trim()) {
      Alert.alert('Información incompleta', 'La descripción del negocio es obligatoria');
      return false;
    }
    
    if (!category.trim()) {
      Alert.alert('Información incompleta', 'La categoría del negocio es obligatoria');
      return false;
    }
    
    if (!image) {
      Alert.alert('Información incompleta', 'Debe seleccionar una imagen para el negocio');
      return false;
    }
    
    // Validate email format if provided
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Email inválido', 'Por favor, ingrese un correo electrónico válido');
      return false;
    }
    
    // Validate website format if provided
    if (website && !website.match(/^(https?:\/\/)?(www\.)?[a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/)) {
      Alert.alert('URL inválida', 'Por favor, ingrese un sitio web válido');
      return false;
    }
    
    // Validate phone format if provided (simple check)
    if (phone && !phone.match(/^[0-9+\-\s()]{7,20}$/)) {
      Alert.alert('Teléfono inválido', 'Por favor, ingrese un número de teléfono válido');
      return false;
    }
    
    return true;
  };

  // Submit the form with extended error handling and progress tracking
  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    // Check user authentication
    if (!user || !user.uid) {
      Alert.alert('Error de autenticación', 'Debe iniciar sesión para agregar un negocio');
      return;
    }
    
    setIsLoading(true);
    setUploadProgress(0);
    
    try {
      // Start progress animation
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          // Only auto-progress to 70%, the rest will be completed after actual tasks
          return prev < 70 ? prev + 1 : prev;
        });
      }, 100);
      
      // Prepare business data with proper typing, omitiendo campos undefined
      const businessData = {
        name,
        description,
        category,
        ...(address ? { address } : {}), // Solo incluir si tiene valor
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        ...(website ? { website } : {}),
        ...(location ? { location } : {}),
        ...(businessHours && Object.keys(businessHours).length > 0 ? { businessHours } : {}),
        ...(paymentMethods && paymentMethods.length > 0 ? { paymentMethods } : {}),
        ...(socialLinks && Object.keys(socialLinks).length > 0 ? { socialLinks } : {}),
        ...(videos && videos.length > 0 ? { videos } : {}),
        ...(menu && menu.length > 0 ? { menu } : {}),
        ...(menuUrl ? { menuUrl } : {}),
        createdBy: user.uid,
        images: []  // Will be populated after upload
      };
      
      console.log('Preparando datos del negocio:', JSON.stringify(businessData));
      
      // Create business in Firestore
      const result = await firebaseService.businesses.create(businessData);
      
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Error al crear negocio');
      }
      
      const businessId = result.data.id;
      setUploadProgress(80); // Update progress after business creation
      
      // AÑADE ESTO - Guardar menú explícitamente después de crear el negocio
      if (menu && menu.length > 0) {
        try {
          await firebase.firestore()
            .collection('businesses')
            .doc(businessId)
            .update({
              menu: menu,
              menuUrl: menuUrl || "",
              lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
          console.log("Menú guardado exitosamente en el nuevo negocio");
        } catch (menuError) {
          console.error("Error al guardar menú:", menuError);
          // Continuar con el resto del proceso aunque falle el menú
        }
      }
      
      // Upload main image if available
      if (image) {
        try {
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
          } else {
            console.warn('Image upload was not successful:', uploadResult.error);
            // Continue anyway, but log the error
          }
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
          // Don't fail the whole operation if just the image fails
        }
      }
      
      setUploadProgress(100); // Complete progress
      clearInterval(progressInterval);
      
      Alert.alert(
        'Éxito', 
        'Negocio agregado correctamente',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      
      // Reset has unsaved changes
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error al agregar negocio:', error);
      Alert.alert(
        'Error', 
        'No se pudo agregar el negocio. Intente nuevamente. ' +
        (error instanceof Error ? error.message : '')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back navigation with unsaved changes check
  const handleBackNavigation = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        "Cambios sin guardar",
        "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Descartar cambios", style: "destructive", onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
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
              onPress={handleBackNavigation}
            >
              <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Agregar Negocio</Text>
            <View style={styles.placeholder}></View>
          </View>
          
          {/* Form content */}
          <View style={styles.form}>
            {/* Basic Information */}
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
                  maxLength={100}
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
                  maxLength={500}
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
                  maxLength={50}
                />
              </View>
            </View>
            
            {/* Contact Information */}
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
                  placeholder="+503 7123 4567"
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
                  placeholder="contacto@minegocio.com"
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
                  placeholder="www.minegocio.com"
                  placeholderTextColor="#8E8E93"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>
            
            {/* Advanced Settings */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Configuración Avanzada</Text>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToBusinessHours}
              >
                <MaterialIcons name="access-time" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Horarios de Atención</Text>
                <MaterialIcons 
                  name="check-circle" 
                  size={24} 
                  color={businessHours ? "#34C759" : "#E5E5EA"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToPaymentMethods}
              >
                <MaterialIcons name="payment" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Métodos de Pago</Text>
                <MaterialIcons 
                  name="check-circle" 
                  size={24} 
                  color={paymentMethods && paymentMethods.length > 0 ? "#34C759" : "#E5E5EA"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToSocialLinks}
              >
                <MaterialIcons name="link" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Redes Sociales</Text>
                <MaterialIcons 
                  name="check-circle" 
                  size={24} 
                  color={socialLinks && Object.keys(socialLinks).length > 0 ? "#34C759" : "#E5E5EA"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToVideoManager}
              >
                <MaterialIcons name="videocam" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Videos</Text>
                <MaterialIcons 
                  name="check-circle" 
                  size={24} 
                  color={videos.length > 0 ? "#34C759" : "#E5E5EA"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToMenuEditor}
              >
                <MaterialIcons name="restaurant-menu" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Menú</Text>
                <MaterialIcons 
                  name="check-circle" 
                  size={24} 
                  color={(menu.length > 0 || menuUrl) ? "#34C759" : "#E5E5EA"} 
                />
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

export default AddBusinessScreen
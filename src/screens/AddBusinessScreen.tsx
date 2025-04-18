import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  BackHandler,
  Modal,
  Linking,
  Switch
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
import MapView, { Marker, Region } from 'react-native-maps';
import { DEFAULT_TIME_SLOTS, DEFAULT_AVAILABLE_DAYS } from '../../models/reservationTypes';

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
  location?: BusinessLocation | null;
  businessHours?: BusinessHours;
  paymentMethods?: string[];
  socialLinks?: SocialLinks;
  menu?: MenuItem[];
  menuUrl?: string;
  images?: Array<{id?: string, url: string, isMain?: boolean}>;
  acceptsReservations: boolean; // Changed from optional to required
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

// Create unique callback IDs for each screen
const CALLBACK_IDS = {
  BUSINESS_HOURS: 'businessHours_callback',
  PAYMENT_METHODS: 'paymentMethods_callback',
  SOCIAL_LINKS: 'socialLinks_callback',
  MENU_EDITOR: 'menuEditor_callback',
  RESERVATION_SETTINGS: 'reservationSettings_callback'
};

// Categorías predefinidas (mejoradas y organizadas alfabéticamente)
const BUSINESS_CATEGORIES = [
  "Agencia de Viajes",
  "Bar",
  "Cafetería",
  "Carnicería",
  "Centro Médico",
  "Electrónica",
  "Farmacia",
  "Ferretería",
  "Floristería",
  "Gimnasio",
  "Hostal",
  "Hotel",
  "Joyería",
  "Lavandería",
  "Librería",
  "Lugares Turísticos",
  "Mueblería",
  "Panadería",
  "Peluquería",
  "Restaurante",
  "Ropa",
  "Salón de Belleza",
  "Supermercado",
  "Tienda",
  "Tour Operador",
  "Veterinaria",
  "Zapatería"
];

const AddBusinessScreen: React.FC = () => {
const navigation = useNavigation<AddBusinessScreenNavigationProp>();
const store = useStore();
const { user } = useAuth();
const { getTempData, removeTempData, setTempData } = useStore();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState<string | null>(null);
  
  // Advanced business details
  const [location, setLocation] = useState<BusinessLocation | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours | undefined>(undefined);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | undefined>(undefined);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuUrl, setMenuUrl] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Estado para categorías sugeridas
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Estados para el mapa
  const [mapVisible, setMapVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 13.6929,  // Centrado en El Salvador por defecto
    longitude: -89.2182,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [markerLocation, setMarkerLocation] = useState<BusinessLocation | null>(null);

  // Configuración de reservaciones
  const [acceptsReservations, setAcceptsReservations] = useState<boolean>(true);
  const [reservationSettings, setReservationSettings] = useState({
    enabled: true,
    maxGuestsPerTable: 10,
    timeSlots: DEFAULT_TIME_SLOTS,
    availableDays: DEFAULT_AVAILABLE_DAYS
  });

  // Añade este estado para forzar un re-render
  const [forceRender, setForceRender] = useState(0);

  // Add state for managing promotions toggle
  const [allowsPromotions, setAllowsPromotions] = useState<boolean>(true);

  // Track form changes - Fix the infinite loop by using a flag
  useEffect(() => {
    // Only update if content actually changed (not just on initial render)
    if (name || description || category || address || phone || image || 
        location || businessHours || paymentMethods?.length || 
        socialLinks || menu.length || menuUrl) {
      if (!hasUnsavedChanges) {
        setHasUnsavedChanges(true);
      }
    } else if (hasUnsavedChanges) {
      // Reset flag if no content
      setHasUnsavedChanges(false);
    }
  }, [name, description, category, address, phone, image, 
      location, businessHours, paymentMethods, socialLinks, menu, menuUrl, hasUnsavedChanges]);

  // Añadir este useEffect para verificar promociones existentes al inicio
  useEffect(() => {
    // Verificar si hay promociones al iniciar
    const tempPromotions = getTempData('promotions_new_business');
    if (tempPromotions && tempPromotions.length > 0 && !getTempData('tempPromotions')) {
      // Si hay promociones pero no está marcado el indicador, actualizarlo
      setTempData('tempPromotions', true);
    }
  }, [getTempData, setTempData]);

  // Verificación de promociones temporales cada vez que el componente está en foco
  useFocusEffect(
    useCallback(() => {
      // Verificar explícitamente cada vez que el componente está en foco
      const promotions = getTempData('promotions_new_business') || [];
      console.log(`[AddBusinessScreen] Focus - Verificando promociones: ${promotions.length} encontradas`);
      
      if (promotions.length > 0 && !getTempData('tempPromotions')) {
        console.log('[AddBusinessScreen] Encontradas promociones pero falta el indicador - actualizando');
        setTempData('tempPromotions', true);
      } else if (promotions.length === 0 && getTempData('tempPromotions')) {
        console.log('[AddBusinessScreen] No hay promociones pero el indicador está activo - corrigiendo');
        setTempData('tempPromotions', false);
      }
      
      // Forzar re-render al volver a esta pantalla
      setForceRender(Date.now());
    }, [])
  );

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
      
      store.setCallback(CALLBACK_IDS.MENU_EDITOR, (newMenu: MenuItem[], newMenuUrl: string) => {
        console.log('MenuEditor callback executed with data:', { menu: newMenu, menuUrl: newMenuUrl });
        setMenu(newMenu);
        setMenuUrl(newMenuUrl);
      });
      
      store.setCallback(CALLBACK_IDS.RESERVATION_SETTINGS, (settings: any) => {
        console.log('ReservationSettings callback executed with data:', settings);
        setReservationSettings(settings);
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
        Alert.alert(
          'Permiso necesario', 
          'Se requiere permiso de ubicación para esta funcionalidad',
          [
            { text: 'Cancelar' },
            { 
              text: 'Abrir Configuración', 
              onPress: () => {
                // Abrir configuraciones del dispositivo
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
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
            'Necesitamos permiso para acceder a tus fotos. Por favor habilita el permiso en configuración.',
            [
              { text: 'Cancelar' },
              { 
                text: 'Abrir Configuración', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
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
        
        // Verificar tamaño de imagen (opcional: limitar a 5MB)
        try {
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
        } catch (sizeError) {
          console.warn('No se pudo verificar el tamaño de la imagen:', sizeError);
          // Continue anyway
        }
        
        setImage(selectedUri);
        
        // Limpiar error de validación si existe
        setValidationErrors(prev => {
          const newErrors = {...prev};
          delete newErrors.image;
          return newErrors;
        });
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Intente nuevamente.');
    }
  };

  // Navigate to different screens with improved error handling
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

  const navigateToPaymentMethods = () => {
    try {
      navigation.navigate('PaymentMethods', {
        initialMethods: paymentMethods,
        callbackId: CALLBACK_IDS.PAYMENT_METHODS
      } as any);
    } catch (error) {
      console.error('Error navegando a PaymentMethods:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de métodos de pago. Intente nuevamente.');
    }
  };

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

  // Navegar a las pantallas de reservaciones y promociones de manera segura
  const navigateToReservations = () => {
    try {
      // Guardar configuración actual en el store para que esté disponible para la pantalla de reservaciones
      store.setTempData('tempReservationSettings', reservationSettings);
      
      navigation.navigate('Reservations', {
        businessId: 'new_business',
        businessName: name || 'Nuevo Negocio',
        isNewBusiness: true
      } as any);
    } catch (error) {
      console.error('Error navegando a Reservations:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de reservaciones. Intente nuevamente.');
    }
  };

  const navigateToPromotions = () => {
    try {
      navigation.navigate('Promotions', {
        businessId: 'new_business',
        businessName: name || 'Nuevo Negocio',
        isNewBusiness: true
      } as any);
    } catch (error) {
      console.error('Error navegando a Promotions:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de promociones. Intente nuevamente.');
    }
  };

  // Validar teléfono
  const validatePhone = (phone: string) => {
    const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
    return phone === '' || phoneRegex.test(phone);
  };

  // Validar formulario antes de enviar con mensajes claros
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validar nombre
    if (!name.trim()) {
      newErrors.name = 'El nombre del negocio es obligatorio';
    } else if (name.length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    }
    
    // Validar descripción
    if (!description.trim()) {
      newErrors.description = 'La descripción del negocio es obligatoria';
    } else if (description.length < 20) {
      newErrors.description = 'La descripción debe tener al menos 20 caracteres';
    }
    
    // Validar categoría
    if (!category.trim()) {
      newErrors.category = 'La categoría del negocio es obligatoria';
    }
    
    // Validar teléfono
    if (phone && !validatePhone(phone)) {
      newErrors.phone = 'Por favor, ingrese un número de teléfono válido';
    }
    
    // Validar imagen
    if (!image) {
      newErrors.image = 'Debe seleccionar una imagen para el negocio';
    }
    
    setValidationErrors(newErrors);
    
    // Mostrar error general si hay errores
    if (Object.keys(newErrors).length > 0) {
      Alert.alert(
        'Información incompleta', 
        'Por favor, complete todos los campos requeridos correctamente'
      );
      return false;
    }
    
    return true;
  };

  // Submit the form with extended error handling and progress tracking
  const handleSubmit = async () => {
    // Validar formulario
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
      const businessData: BusinessData = {
        name,
        description,
        category,
        ...(address ? { address } : {}),
        ...(phone ? { phone } : {}),
        ...(location ? { location } : {}),
        ...(businessHours && Object.keys(businessHours).length > 0 ? { businessHours } : {}),
        ...(paymentMethods && paymentMethods.length > 0 ? { paymentMethods } : {}),
        ...(socialLinks && Object.keys(socialLinks).length > 0 ? { socialLinks } : {}),
        ...(menu && menu.length > 0 ? { menu } : {}),
        ...(menuUrl ? { menuUrl } : {}),
        acceptsReservations,
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
      
      // Guardar menú explícitamente después de crear el negocio
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

      // Guardar configuración de reservaciones si está habilitado
      if (acceptsReservations) {
        try {
          await firebaseService.reservations.updateAvailability({
            businessId,
            availableDays: reservationSettings.availableDays,
            timeSlots: reservationSettings.timeSlots,
            maxPartySizes: Array.from({ length: reservationSettings.maxGuestsPerTable }, (_, i) => i + 1)
          });
          console.log("Configuración de reservaciones guardada exitosamente");
        } catch (reservationError) {
          console.error("Error al guardar configuración de reservaciones:", reservationError);
        }
      }
      
      // Recuperar y crear promociones desde el almacenamiento temporal
      const tempBusinessId = 'new_business'; // ID para negocios temporales
      const tempPromotions = getTempData(`promotions_${tempBusinessId}`) || [];
      
      if (tempPromotions.length > 0) {
        console.log(`Creando ${tempPromotions.length} promociones permanentes`);
        
        for (const promotion of tempPromotions) {
          try {
            // Preparar datos de la promoción
            const promotionData = {
              ...promotion,
              businessId: businessId, // Actualizar a ID permanente
            };
            
            // Eliminar el ID temporal
            const tempId = promotionData.id;
            delete promotionData.id;
            
            // Crear la promoción permanente
            const promoResult = await firebaseService.promotions.create(promotionData);
            
            if (promoResult.success) {
              console.log(`Promoción temporal ${tempId} creada permanentemente con ID: ${promoResult.data?.id}`);
            } else {
              console.error(`Error al guardar promoción temporal ${tempId}:`, promoResult.error);
            }
          } catch (promoError) {
            console.error('Error al guardar promoción:', promoError);
            // Continue with other promotions even if one fails
          }
        }
        
        // Limpiar datos temporales después de guardar
        removeTempData(`promotions_${tempBusinessId}`);
        removeTempData('promotions_new_business'); // Asegúrate de limpiar ambas claves
        removeTempData('tempPromotions');
        console.log('Datos temporales de promociones eliminados');
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

  // Función para filtrar categorías según entrada del usuario
  const updateCategorySuggestions = (text: string) => {
    setCategory(text);
    
    // Limpiar error de validación si existe
    if (text.trim()) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.category;
        return newErrors;
      });
    }
    
    if (text.length > 0) {
      const filteredCategories = BUSINESS_CATEGORIES.filter(
        cat => cat.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5); // Limitar a 5 sugerencias para no sobrecargar la UI
      
      setSuggestedCategories(filteredCategories);
      setShowSuggestions(filteredCategories.length > 0);
    } else {
      setSuggestedCategories([]);
      setShowSuggestions(false);
    }
  };

  // Función para seleccionar una categoría sugerida
  const selectCategory = (selectedCategory: string) => {
    setCategory(selectedCategory);
    setShowSuggestions(false);
    
    // Limpiar error de validación
    setValidationErrors(prev => {
      const newErrors = {...prev};
      delete newErrors.category;
      return newErrors;
    });
  };

  // Función para abrir el selector de mapa
  const openLocationPicker = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso necesario', 
          'Se requiere permiso de ubicación para esta funcionalidad',
          [
            { text: 'Cancelar' },
            { 
              text: 'Abrir Configuración', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return;
      }

      setIsLoading(true);
      
      // Intentar obtener ubicación actual para centrar el mapa
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      // Actualizar la región del mapa con la ubicación actual
      setMapRegion({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      // Si ya existe una ubicación seleccionada, mostrarla
      if (location) {
        setMarkerLocation(location);
      }
      
      setIsLoading(false);
      setMapVisible(true);
    } catch (error) {
      console.error('Error preparando mapa:', error);
      setIsLoading(false);
      Alert.alert('Error', 'No se pudo inicializar el mapa. Intente nuevamente.');
    }
  };

  // Función para manejar selección en el mapa
  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setMarkerLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
    });
  };

  // Función para confirmar ubicación seleccionada
  const confirmLocationSelection = async () => {
    if (!markerLocation) {
      Alert.alert('Ubicación requerida', 'Por favor selecciona un punto en el mapa');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Guardar la ubicación seleccionada
      setLocation(markerLocation);
      
      // Obtener dirección a partir de coordenadas
      const addresses = await Location.reverseGeocodeAsync({
        latitude: markerLocation.latitude,
        longitude: markerLocation.longitude
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
      
      setMapVisible(false);
    } catch (error) {
      console.error('Error obteniendo dirección:', error);
      Alert.alert('Error', 'No se pudo obtener la dirección para la ubicación seleccionada');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para centrar en ubicación actual en el mapa
  const centerMapOnCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      setMapRegion({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      setMarkerLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude
      });
    } catch (error) {
      console.error('Error centrando mapa:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación actual');
    }
  };

  // Actualizar teléfono con validación
  const handlePhoneChange = (text: string) => {
    // Limpiar caracteres no válidos
    const cleanedText = text.replace(/[^\d+\s()-]/g, '');
    setPhone(cleanedText);
    
    if (cleanedText && !validatePhone(cleanedText)) {
      setValidationErrors(prev => ({
        ...prev,
        phone: 'Formato de teléfono inválido'
      }));
    } else {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.phone;
        return newErrors;
      });
    }
  };

  // Actualizar nombre con validación
  const handleNameChange = (text: string) => {
    setName(text);
    
    if (!text.trim()) {
      setValidationErrors(prev => ({
        ...prev,
        name: 'El nombre es obligatorio'
      }));
    } else if (text.length < 3) {
      setValidationErrors(prev => ({
        ...prev,
        name: 'El nombre debe tener al menos 3 caracteres'
      }));
    } else {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.name;
        return newErrors;
      });
    }
  };

  // Actualizar descripción con validación
  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    
    if (!text.trim()) {
      setValidationErrors(prev => ({
        ...prev,
        description: 'La descripción es obligatoria'
      }));
    } else if (text.length < 20) {
      setValidationErrors(prev => ({
        ...prev,
        description: 'La descripción debe tener al menos 20 caracteres'
      }));
    } else {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.description;
        return newErrors;
      });
    }
  };

  // Función para verificar si hay promociones
  const hasPromotions = () => {
    if (!allowsPromotions) return false; // If promotions are disabled, return false
    // Verificar primero el indicador explícito
    const hasFlag = getTempData('tempPromotions');
    if (hasFlag === true) {
      console.log('[AddBusinessScreen] hasPromotions: true por flag');
      return true;
    }
    
    // Verificar también los datos reales
    const promos = getTempData('promotions_new_business');
    const result = Array.isArray(promos) && promos.length > 0;
    console.log(`[AddBusinessScreen] hasPromotions: ${result} por datos (${Array.isArray(promos) ? promos.length : 0} promociones)`);
    return result;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBackNavigation}
              accessibilityLabel="Volver atrás"
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
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
                <Text style={styles.label}>Nombre del Negocio <Text style={styles.requiredMark}>*</Text></Text>
                <TextInput
                  style={[
                    styles.input,
                    validationErrors.name ? styles.inputError : null
                  ]}
                  value={name}
                  onChangeText={handleNameChange}
                  placeholder="Ej: Cafetería El Aroma"
                  placeholderTextColor="#8E8E93"
                  maxLength={100}
                />
                {validationErrors.name && (
                  <Text style={styles.errorText}>{validationErrors.name}</Text>
                )}
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción <Text style={styles.requiredMark}>*</Text></Text>
                <TextInput
                  style={[
                    styles.input, 
                    styles.textArea,
                    validationErrors.description ? styles.inputError : null
                  ]}
                  value={description}
                  onChangeText={handleDescriptionChange}
                  placeholder="Describe servicios, especialidad, ventajas..."
                  placeholderTextColor="#8E8E93"
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
                {validationErrors.description && (
                  <Text style={styles.errorText}>{validationErrors.description}</Text>
                )}
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Categoría <Text style={styles.requiredMark}>*</Text></Text>
                <TextInput
                  style={[
                    styles.input, 
                    validationErrors.category ? styles.inputError : null,
                    showSuggestions && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
                  ]}
                  value={category}
                  onChangeText={updateCategorySuggestions}
                  placeholder="Busca o escribe una categoría"
                  placeholderTextColor="#8E8E93"
                  maxLength={50}
                />
                {validationErrors.category && (
                  <Text style={styles.errorText}>{validationErrors.category}</Text>
                )}
                {showSuggestions && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView 
                      style={styles.suggestionsList}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                    >
                      {suggestedCategories.map((suggestion, index) => (
                        <TouchableOpacity 
                          key={index} 
                          style={styles.suggestionItem}
                          onPress={() => selectCategory(suggestion)}
                        >
                          <Text style={styles.suggestionText}>{suggestion}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
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
                    placeholder="Calle, número, colonia..."
                    placeholderTextColor="#8E8E93"
                  />
                  <TouchableOpacity 
                    style={styles.locationButton}
                    onPress={openLocationPicker}
                  >
                    <MaterialIcons name="map" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                {location && (
                  <Text style={styles.locationConfirmed}>
                    <MaterialIcons name="check-circle" size={14} color="#34C759" /> Ubicación seleccionada correctamente
                  </Text>
                )}
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={[
                    styles.input,
                    validationErrors.phone ? styles.inputError : null
                  ]}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder="+503 XXXX XXXX"
                  placeholderTextColor="#8E8E93"
                  keyboardType="phone-pad"
                />
                {validationErrors.phone && (
                  <Text style={styles.errorText}>{validationErrors.phone}</Text>
                )}
              </View>
            </View>
            
            {/* Advanced Settings */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Configuración Avanzada</Text>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToBusinessHours}
              >
                <View style={styles.advancedIconContainer}>
                  <MaterialIcons name="access-time" size={24} color="#007aff" />
                </View>
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
                <View style={styles.advancedIconContainer}>
                  <MaterialIcons name="payment" size={24} color="#007aff" />
                </View>
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
                <View style={styles.advancedIconContainer}>
                  <MaterialIcons name="link" size={24} color="#007aff" />
                </View>
                <Text style={styles.advancedButtonText}>Redes Sociales</Text>
                <MaterialIcons 
                  name="check-circle" 
                  size={24} 
                  color={socialLinks && Object.keys(socialLinks).length > 0 ? "#34C759" : "#E5E5EA"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToMenuEditor}
              >
                <View style={styles.advancedIconContainer}>
                  <MaterialIcons name="restaurant-menu" size={24} color="#007aff" />
                </View>
                <Text style={styles.advancedButtonText}>Menú</Text>
                <MaterialIcons 
                  name="check-circle" 
                  size={24} 
                  color={(menu.length > 0 || menuUrl) ? "#34C759" : "#E5E5EA"} 
                />
              </TouchableOpacity>
            </View>

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Opciones de Reservación y Promociones</Text>
              
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleLabel}>Permitir reservaciones</Text>
                <Switch 
                  value={acceptsReservations}
                  onValueChange={(value) => setAcceptsReservations(value)}
                  trackColor={{ false: '#E5E5EA', true: '#4CD964' }}
                  thumbColor={Platform.OS === 'android' ? '#f4f3f4' : ''}
                />
              </View>
              
              {!acceptsReservations ? (
                <Text style={styles.warningText}>
                  Las reservaciones estarán deshabilitadas. Los clientes no podrán hacer reservas a través de la app.
                </Text>
              ) : (
                <TouchableOpacity 
                  style={styles.advancedButton}
                  onPress={navigateToReservations}
                >
                  <View style={styles.advancedIconContainer}>
                    <MaterialIcons name="event-available" size={24} color="#007aff" />
                  </View>
                  <Text style={styles.advancedButtonText}>Configurar Reservaciones</Text>
                  <MaterialIcons 
                    name="check-circle" 
                    size={24} 
                    color={store.getTempData('tempReservationSettings') ? "#34C759" : "#E5E5EA"} 
                  />
                </TouchableOpacity>
              )}

              <View style={styles.toggleContainer}>
                <Text style={styles.toggleLabel}>Permitir promociones</Text>
                <Switch 
                  value={allowsPromotions}
                  onValueChange={(value) => setAllowsPromotions(value)}
                  trackColor={{ false: '#E5E5EA', true: '#4CD964' }}
                  thumbColor={Platform.OS === 'android' ? '#f4f3f4' : ''}
                />
              </View>
              
              {!allowsPromotions ? (
                <Text style={styles.warningText}>
                  Las promociones estarán deshabilitadas. Los clientes no podrán ver promociones para este negocio.
                </Text>
              ) : (
                <TouchableOpacity 
                  style={styles.advancedButton}
                  onPress={navigateToPromotions}
                >
                  <View style={styles.advancedIconContainer}>
                    <MaterialIcons name="local-offer" size={24} color="#007aff" />
                  </View>
                  <Text style={styles.advancedButtonText}>Gestionar Promociones</Text>
                  <MaterialIcons 
                    key={`promo-check-${forceRender}`}
                    name="check-circle" 
                    size={24} 
                    color={hasPromotions() ? "#34C759" : "#E5E5EA"} 
                  />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Image Picker */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Imagen Principal <Text style={styles.requiredMark}>*</Text></Text>
              <TouchableOpacity 
                style={[
                  styles.imagePicker,
                  validationErrors.image ? styles.imagePickerError : null
                ]} 
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
                    <MaterialIcons name="add-photo-alternate" size={40} color="#007aff" />
                    <Text style={styles.placeholderText}>Toca para seleccionar imagen</Text>
                  </View>
                )}
              </TouchableOpacity>
              {validationErrors.image && (
                <Text style={styles.errorText}>{validationErrors.image}</Text>
              )}
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
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="business" size={24} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Guardar Negocio</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal con el mapa */}
      <Modal
        visible={mapVisible}
        animationType="slide"
        onRequestClose={() => setMapVisible(false)}
        transparent={false}
      >
        <SafeAreaView style={styles.mapModalContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity 
              onPress={() => setMapVisible(false)}
              style={styles.mapCloseButton}
              accessibilityLabel="Volver atrás"
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Seleccionar Ubicación</Text>
            <View style={styles.mapHeaderRight}></View>
          </View>
          
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={mapRegion}
              onRegionChangeComplete={setMapRegion}
              onPress={handleMapPress}
            >
              {markerLocation && (
                <Marker
                  coordinate={{
                    latitude: markerLocation.latitude,
                    longitude: markerLocation.longitude,
                  }}
                />
              )}
            </MapView>
            
            <TouchableOpacity 
              style={styles.currentLocationMapButton}
              onPress={centerMapOnCurrentLocation}
              accessibilityLabel="Mi ubicación actual"
              accessibilityRole="button"
            >
              <MaterialIcons name="my-location" size={24} color="#007aff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.confirmLocationButton,
                !markerLocation && styles.disabledButton
              ]}
              onPress={confirmLocationSelection}
              disabled={!markerLocation}
              accessibilityLabel="Confirmar ubicación"
              accessibilityRole="button"
            >
              <Text style={styles.confirmLocationButtonText}>Confirmar Ubicación</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  requiredMark: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  advancedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF', // Color de fondo más fresco con un toque azul
  },
  scrollContent: {
    paddingBottom: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#007aff', // Azul de logo como color de header
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF', // Texto blanco para mejor contraste en header azul
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
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff', // Borde izquierdo azul para resaltar secciones
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007aff', // Título de secciones en azul
    marginBottom: 20,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)', // Línea sutil bajo el título
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50', // Color oscuro para mejor legibilidad
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#F6F8FC',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E0E7FF', // Borde sutil con toque azul
    shadowColor: '#8395A7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
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
    marginLeft: 10,
    padding: 15,
    backgroundColor: '#007aff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  locationConfirmed: {
    fontSize: 13,
    color: '#34C759',
    marginTop: 8,
    fontWeight: '500',
  },
  imagePicker: {
    height: 220,
    backgroundColor: '#F6F8FC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderStyle: 'dashed',
  },
  imagePickerError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#007aff',
    fontWeight: '500',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    shadowColor: '#8395A7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  advancedButtonText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 14,
    flex: 1,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#F6F8FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  warningText: {
    marginBottom: 14,
    color: '#FF9500',
    fontStyle: 'italic',
    backgroundColor: 'rgba(255,149,0,0.08)',
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressContainer: {
    marginVertical: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E7FF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007aff',
    borderRadius: 4,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#007aff',
    borderRadius: 14,
    padding: 18,
    margin: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#7FB5FF',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  suggestionsContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderTopWidth: 0,
    maxHeight: 200,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F7FF',
  },
  suggestionText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#007aff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mapHeaderRight: {
    width: 40,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  currentLocationMapButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  confirmLocationButton: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: '#007aff',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 16,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#A2D1FF',
    shadowOpacity: 0.1,
  },

  confirmLocationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddBusinessScreen;


import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Alert, Linking } from 'react-native';
import { firebaseService } from '../../services/firebaseService';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import firebase from 'firebase/compat/app';
import { 
  BusinessLocation, 
  BusinessHours, 
  SocialLinks, 
  MenuItem 
} from '../../types/businessTypes';
import { DEFAULT_TIME_SLOTS, DEFAULT_AVAILABLE_DAYS } from '../../../models/reservationTypes';

// Callback IDs for navigation between screens
export const CALLBACK_IDS = {
  BUSINESS_HOURS: 'businessHours_callback',
  PAYMENT_METHODS: 'paymentMethods_callback',
  SOCIAL_LINKS: 'socialLinks_callback',
  MENU_EDITOR: 'menuEditor_callback',
  RESERVATION_SETTINGS: 'reservationSettings_callback'
};

// Predefined business categories
export const BUSINESS_CATEGORIES = [
  "Agencia de Viajes", "Bar", "Cafetería", "Carnicería", "Centro Médico",
  "Electrónica", "Farmacia", "Ferretería", "Floristería", "Gimnasio",
  "Hostal", "Hotel", "Joyería", "Lavandería", "Librería",
  "Lugares Turísticos", "Mueblería", "Panadería", "Peluquería", "Restaurante",
  "Ropa", "Salón de Belleza", "Supermercado", "Tienda", "Tour Operador",
  "Veterinaria", "Zapatería"
];

// Main form data interface
export interface BusinessFormData {
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
  acceptsReservations: boolean;
  createdBy?: string;
  images?: Array<{id?: string, url: string, isMain?: boolean}>;
}

// Extended business form data with UI state
export interface BusinessFormState extends BusinessFormData {
  image: string | null;
  isLoading: boolean;
  uploadProgress: number;
  hasUnsavedChanges: boolean;
  validationErrors: Record<string, string>;
  allowsPromotions: boolean;
  
  // New fields for onboarding
  email?: string;
  shortDescription?: string;
  keywords?: string[];
  galleryImages?: string[];
  services?: {
    delivery: boolean;
    pickup: boolean;
    onlineOrders: boolean;
    reservations: boolean;
    wifi: boolean;
    parking: boolean;
  };
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
  };
}

// Validation and submission functions
export interface FormFunctions {
  validatePhone: (phone: string) => boolean;
  validateForm: () => boolean;
  handleSubmit: () => Promise<void>;
  pickImage: () => Promise<void>;
  handleNameChange: (text: string) => void;
  handleDescriptionChange: (text: string) => void;
  handlePhoneChange: (text: string) => void;
}

// Category suggestion state and functions
export interface CategorySuggestionHandlers {
  suggestedCategories: string[];
  showSuggestions: boolean;
  updateCategorySuggestions: (text: string) => void;
  selectCategory: (category: string) => void;
}

// Location handling functions
export interface LocationHandlers {
  mapVisible: boolean;
  mapRegion: any;
  markerLocation: BusinessLocation | null;
  getCurrentLocation: () => Promise<void>;
  openLocationPicker: () => Promise<void>;
  handleMapPress: (event: any) => void;
  confirmLocationSelection: () => Promise<void>;
  centerMapOnCurrentLocation: () => Promise<void>;
  setMapVisible: (visible: boolean) => void;
}

// Reservation settings state and functions
export interface ReservationHandlers {
  reservationSettings: {
    enabled: boolean;
    maxGuestsPerTable: number;
    timeSlots: string[];
    availableDays: string[];
  };
  hasPromotions: () => boolean;
}

export const useAddBusiness = () => {
  const store = useStore();
  const { user } = useAuth();
  const { getTempData, removeTempData, setTempData } = useStore();
  
  // Main form state
  const [formState, setFormState] = useState<BusinessFormState>({
    name: '',
    description: '',
    category: '',
    address: '',
    phone: '',
    image: null,
    location: null,
    businessHours: undefined,
    paymentMethods: [],
    socialLinks: undefined,
    menu: [],
    menuUrl: '',
    acceptsReservations: true,
    allowsPromotions: true,
    isLoading: false,
    uploadProgress: 0,
    hasUnsavedChanges: false,
    validationErrors: {}
  });
  
  // UI state for map
  const [mapVisible, setMapVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 13.6929,  // Centered on El Salvador by default
    longitude: -89.2182,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [markerLocation, setMarkerLocation] = useState<BusinessLocation | null>(null);
  
  // UI state for category suggestions
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Reservation settings
  const [reservationSettings, setReservationSettings] = useState({
    enabled: true,
    maxGuestsPerTable: 10,
    timeSlots: DEFAULT_TIME_SLOTS,
    availableDays: DEFAULT_AVAILABLE_DAYS
  });
  
  // Force render for promotions
  const [forceRender, setForceRender] = useState(0);
  
  // Track form changes - Fix the infinite loop by using a flag
  useEffect(() => {
    // Only update if content actually changed (not just on initial render)
    if (formState.name || formState.description || formState.category || 
        formState.address || formState.phone || formState.image || 
        formState.location || formState.businessHours || formState.paymentMethods?.length || 
        formState.socialLinks || (formState.menu && formState.menu.length > 0) || formState.menuUrl) {
      if (!formState.hasUnsavedChanges) {
        setFormState(prev => ({ ...prev, hasUnsavedChanges: true }));
      }
    } else if (formState.hasUnsavedChanges) {
      // Reset flag if no content
      setFormState(prev => ({ ...prev, hasUnsavedChanges: false }));
    }
  }, [formState.name, formState.description, formState.category, formState.address, 
      formState.phone, formState.image, formState.location, formState.businessHours, 
      formState.paymentMethods, formState.socialLinks, formState.menu, formState.menuUrl]);
  
  // Register callbacks for navigation returns
  useEffect(() => {
    const registerCallbacks = () => {
      // Cleanup previous callbacks first to avoid duplicates
      Object.values(CALLBACK_IDS).forEach(id => {
        store.removeCallback(id);
      });
      
      // Register payment methods callback
      store.setCallback(CALLBACK_IDS.PAYMENT_METHODS, (methods: string[]) => {
        console.log('PaymentMethods callback executed with data:', methods);
        setFormState(prev => ({ ...prev, paymentMethods: methods }));
      });
      
      // Register business hours callback
      store.setCallback(CALLBACK_IDS.BUSINESS_HOURS, (hours: BusinessHours) => {
        console.log('BusinessHours callback executed with data:', hours);
        setFormState(prev => ({ ...prev, businessHours: hours }));
      });
      
      // Register social links callback
      store.setCallback(CALLBACK_IDS.SOCIAL_LINKS, (links: SocialLinks) => {
        console.log('SocialLinks callback executed with data:', links);
        setFormState(prev => ({ ...prev, socialLinks: links }));
      });
      
      // Register menu editor callback
      store.setCallback(CALLBACK_IDS.MENU_EDITOR, (newMenu: MenuItem[], newMenuUrl: string) => {
        console.log('MenuEditor callback executed with data:', { menu: newMenu, menuUrl: newMenuUrl });
        setFormState(prev => ({ ...prev, menu: newMenu, menuUrl: newMenuUrl }));
      });
      
      // Register reservation settings callback
      store.setCallback(CALLBACK_IDS.RESERVATION_SETTINGS, (settings: any) => {
        console.log('ReservationSettings callback executed with data:', settings);
        setReservationSettings(settings);
      });
    };

    // Only register callbacks once
    registerCallbacks();
    
    // Cleanup callbacks on unmount
    return () => {
      Object.values(CALLBACK_IDS).forEach(id => {
        store.removeCallback(id);
      });
    };
  }, []);  // Empty dependency array means this only runs once

  // Check for existing promotions on initialization
  useEffect(() => {
    // Check for existing promotions when component loads
    const tempPromotions = getTempData('promotions_new_business');
    if (tempPromotions && tempPromotions.length > 0 && !getTempData('tempPromotions')) {
      // If there are promotions but indicator isn't set, update it
      setTempData('tempPromotions', true);
    }
  }, [getTempData, setTempData]);

  // Functions for updating state with validation
  const setField = (field: keyof BusinessFormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleNameChange = (text: string) => {
    setField('name', text);
    
    if (!text.trim()) {
      setFormState(prev => ({
        ...prev,
        validationErrors: {
          ...prev.validationErrors,
          name: 'El nombre es obligatorio'
        }
      }));
    } else if (text.length < 3) {
      setFormState(prev => ({
        ...prev,
        validationErrors: {
          ...prev.validationErrors,
          name: 'El nombre debe tener al menos 3 caracteres'
        }
      }));
    } else {
      setFormState(prev => {
        const newErrors = {...prev.validationErrors};
        delete newErrors.name;
        return { ...prev, validationErrors: newErrors };
      });
    }
  };

  const handleDescriptionChange = (text: string) => {
    setField('description', text);
    
    if (!text.trim()) {
      setFormState(prev => ({
        ...prev,
        validationErrors: {
          ...prev.validationErrors,
          description: 'La descripción es obligatoria'
        }
      }));
    } else if (text.length < 20) {
      setFormState(prev => ({
        ...prev,
        validationErrors: {
          ...prev.validationErrors,
          description: 'La descripción debe tener al menos 20 caracteres'
        }
      }));
    } else {
      setFormState(prev => {
        const newErrors = {...prev.validationErrors};
        delete newErrors.description;
        return { ...prev, validationErrors: newErrors };
      });
    }
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
    return phone === '' || phoneRegex.test(phone);
  };

  const handlePhoneChange = (text: string) => {
    // Clean non-valid characters
    const cleanedText = text.replace(/[^\d+\s()-]/g, '');
    setField('phone', cleanedText);
    
    if (cleanedText && !validatePhone(cleanedText)) {
      setFormState(prev => ({
        ...prev,
        validationErrors: {
          ...prev.validationErrors,
          phone: 'Formato de teléfono inválido'
        }
      }));
    } else {
      setFormState(prev => {
        const newErrors = {...prev.validationErrors};
        delete newErrors.phone;
        return { ...prev, validationErrors: newErrors };
      });
    }
  };

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
                // Open device settings
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

      setField('isLoading', true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      setField('location', {
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
          
          setField('address', addressStr);
        }
      } catch (addressError) {
        console.error('Error obteniendo dirección:', addressError);
        // Continue without address
      }
      
      setField('isLoading', false);
    } catch (error) {
      setField('isLoading', false);
      console.error('Error de ubicación:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación actual. Intente nuevamente.');
    }
  };

  // Image picker with improved error handling
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
        
        // Check image size (optional: limit to 5MB)
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
        
        setField('image', selectedUri);
        
        // Clear validation error if exists
        setFormState(prev => {
          const newErrors = {...prev.validationErrors};
          delete newErrors.image;
          return { ...prev, validationErrors: newErrors };
        });
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Intente nuevamente.');
    }
  };

  // Map location handling
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

      setField('isLoading', true);
      
      // Try to get current location to center the map
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      // Update map region with current location
      setMapRegion({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      // If a location is already selected, show it
      if (formState.location) {
        setMarkerLocation(formState.location);
      }
      
      setField('isLoading', false);
      setMapVisible(true);
    } catch (error) {
      console.error('Error preparando mapa:', error);
      setField('isLoading', false);
      Alert.alert('Error', 'No se pudo inicializar el mapa. Intente nuevamente.');
    }
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setMarkerLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
    });
  };

  const confirmLocationSelection = async () => {
    if (!markerLocation) {
      Alert.alert('Ubicación requerida', 'Por favor selecciona un punto en el mapa');
      return;
    }
    
    try {
      setField('isLoading', true);
      
      // Save selected location
      setField('location', markerLocation);
      
      // Get address from coordinates
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
        
        setField('address', addressStr);
      }
      
      setMapVisible(false);
    } catch (error) {
      console.error('Error obteniendo dirección:', error);
      Alert.alert('Error', 'No se pudo obtener la dirección para la ubicación seleccionada');
    } finally {
      setField('isLoading', false);
    }
  };

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

  // Category suggestions handling
  const updateCategorySuggestions = (text: string) => {
    setField('category', text);
    
    // Clear validation error if exists
    if (text.trim()) {
      setFormState(prev => {
        const newErrors = {...prev.validationErrors};
        delete newErrors.category;
        return { ...prev, validationErrors: newErrors };
      });
    }
    
    if (text.length > 0) {
      const filteredCategories = BUSINESS_CATEGORIES.filter(
        cat => cat.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5); // Limit to 5 suggestions to not overload the UI
      
      setSuggestedCategories(filteredCategories);
      setShowSuggestions(filteredCategories.length > 0);
    } else {
      setSuggestedCategories([]);
      setShowSuggestions(false);
    }
  };

  const selectCategory = (selectedCategory: string) => {
    setField('category', selectedCategory);
    setShowSuggestions(false);
    
    // Clear validation error
    setFormState(prev => {
      const newErrors = {...prev.validationErrors};
      delete newErrors.category;
      return { ...prev, validationErrors: newErrors };
    });
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validate name
    if (!formState.name.trim()) {
      newErrors.name = 'El nombre del negocio es obligatorio';
    } else if (formState.name.length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    }
    
    // Validate description
    if (!formState.description.trim()) {
      newErrors.description = 'La descripción del negocio es obligatoria';
    } else if (formState.description.length < 20) {
      newErrors.description = 'La descripción debe tener al menos 20 caracteres';
    }
    
    // Validate category
    if (!formState.category.trim()) {
      newErrors.category = 'La categoría del negocio es obligatoria';
    }
    
    // Validate phone
    if (formState.phone && !validatePhone(formState.phone)) {
      newErrors.phone = 'Por favor, ingrese un número de teléfono válido';
    }
    
    // Validate image
    if (!formState.image) {
      newErrors.image = 'Debe seleccionar una imagen para el negocio';
    }
    
    setFormState(prev => ({
      ...prev,
      validationErrors: newErrors
    }));
    
    // Show general error if there are errors
    if (Object.keys(newErrors).length > 0) {
      Alert.alert(
        'Información incompleta', 
        'Por favor, complete todos los campos requeridos correctamente'
      );
      return false;
    }
    
    return true;
  };

  // Form submission
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
    
    setField('isLoading', true);
    setField('uploadProgress', 0);
    
    try {
      // Start progress animation
      const progressInterval = setInterval(() => {
        setFormState(prev => ({
          ...prev,
          uploadProgress: prev.uploadProgress < 70 ? prev.uploadProgress + 1 : prev.uploadProgress
        }));
      }, 100);
      
      // Prepare business data, omitting undefined fields
      const businessData = {
        name: formState.name,
        description: formState.description,
        category: formState.category,
        ...(formState.address ? { address: formState.address } : {}),
        ...(formState.phone ? { phone: formState.phone } : {}),
        ...(formState.location ? { location: formState.location } : {}),
        ...(formState.businessHours && Object.keys(formState.businessHours).length > 0 ? 
            { businessHours: formState.businessHours } : {}),
        ...(formState.paymentMethods && formState.paymentMethods.length > 0 ? 
            { paymentMethods: formState.paymentMethods } : {}),
        ...(formState.socialLinks && Object.keys(formState.socialLinks).length > 0 ? 
            { socialLinks: formState.socialLinks } : {}),
        ...(formState.menu && formState.menu.length > 0 ? { menu: formState.menu } : {}),
        ...(formState.menuUrl ? { menuUrl: formState.menuUrl } : {}),
        acceptsReservations: formState.acceptsReservations,
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
      setField('uploadProgress', 80);
      
      // Save menu explicitly after creating the business
      if (formState.menu && formState.menu.length > 0) {
        try {
          await firebase.firestore()
            .collection('businesses')
            .doc(businessId)
            .update({
              menu: formState.menu,
              menuUrl: formState.menuUrl || "",
              lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
          console.log("Menú guardado exitosamente en el nuevo negocio");
        } catch (menuError) {
          console.error("Error al guardar menú:", menuError);
          // Continue with the rest of the process even if menu fails
        }
      }

      // Save reservation settings if enabled
      if (formState.acceptsReservations) {
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
      
      // Recover and create promotions from temporary storage
      const tempBusinessId = 'new_business'; // ID for temporary businesses
      const tempPromotions = getTempData(`promotions_${tempBusinessId}`) || [];
      
      if (tempPromotions.length > 0) {
        console.log(`Creando ${tempPromotions.length} promociones permanentes`);
        
        for (const promotion of tempPromotions) {
          try {
            // Prepare promotion data
            const promotionData = {
              ...promotion,
              businessId: businessId, // Update to permanent ID
            };
            
            // Remove temporary ID
            const tempId = promotionData.id;
            delete promotionData.id;
            
            // Create permanent promotion
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
        
        // Clean up temporary data after saving
        removeTempData(`promotions_${tempBusinessId}`);
        removeTempData('promotions_new_business'); // Make sure to clean both keys
        removeTempData('tempPromotions');
        console.log('Datos temporales de promociones eliminados');
      }
      
      // Upload main image if available
      if (formState.image) {
        try {
          const uploadResult = await firebaseService.storage.uploadImage(
            formState.image,
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
      
      setField('uploadProgress', 100);
      clearInterval(progressInterval);
      
      Alert.alert(
        'Éxito', 
        'Negocio agregado correctamente',
        [{ text: 'OK', onPress: () => {} }]
      );
      
      // Reset has unsaved changes
      setField('hasUnsavedChanges', false);
      return businessId;
    } catch (error) {
      console.error('Error al agregar negocio:', error);
      Alert.alert(
        'Error', 
        'No se pudo agregar el negocio. Intente nuevamente. ' +
        (error instanceof Error ? error.message : '')
      );
      return null;
    } finally {
      setField('isLoading', false);
    }
  };

  // Function to check if there are promotions
  const hasPromotions = useCallback(() => {
    if (!formState.allowsPromotions) return false;
    // Check explicit indicator first
    const hasFlag = getTempData('tempPromotions');
    if (hasFlag === true) {
      console.log('[AddBusinessScreen] hasPromotions: true por flag');
      return true;
    }
    
    // Also check actual data
    const promos = getTempData('promotions_new_business');
    const result = Array.isArray(promos) && promos.length > 0;
    console.log(`[AddBusinessScreen] hasPromotions: ${result} por datos (${Array.isArray(promos) ? promos.length : 0} promociones)`);
    return result;
  }, [formState.allowsPromotions, getTempData]);

  return {
    formState,
    setFormState,
    setField,
    locationHandlers: {
      mapVisible,
      mapRegion,
      markerLocation,
      getCurrentLocation,
      openLocationPicker,
      handleMapPress,
      confirmLocationSelection,
      centerMapOnCurrentLocation,
      setMapVisible
    },
    categorySuggestions: {
      suggestedCategories,
      showSuggestions,
      updateCategorySuggestions,
      selectCategory
    },
    formFunctions: {
      validatePhone,
      validateForm,
      handleSubmit,
      pickImage,
      handleNameChange,
      handleDescriptionChange,
      handlePhoneChange
    },
    reservationHandlers: {
      reservationSettings,
      hasPromotions
    },
    forceRender,
    setForceRender
  };
};

export default useAddBusiness; 
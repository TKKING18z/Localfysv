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
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Business, MenuItem as BusinessMenuItem } from '../../context/BusinessContext';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { useStore } from '../../context/StoreContext';

// Define types for business data structures
interface BusinessHours {
  [day: string]: {
    open: string;
    close: string;
    closed: boolean;
  };
}

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  [key: string]: string | undefined;
}

// Use the imported MenuItem type instead of redefining it
// Or if you need it locally with the same structure:
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number; // Changed from string | number to just number to match BusinessContext
  imageUrl?: string;
  category?: string;
}

interface VideoItem {
  id?: string;
  url: string;
  thumbnail?: string;
}

// Definir el tipo para los parámetros de la ruta
type EditBusinessRouteProp = RouteProp<{ params: { businessId: string } }, 'params'>;
type NavigationProps = StackNavigationProp<RootStackParamList>;

const EditBusinessScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<EditBusinessRouteProp>();
  const { businessId } = route.params;
  const store = useStore();
  
  // Estados para formulario
  const [business, setBusiness] = useState<Business | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Cargar datos del negocio y configurar escucha en tiempo real
  useEffect(() => {
    setLoading(true);
    
    // Crear referencia al documento del negocio
    const businessDocRef = firebase.firestore().collection('businesses').doc(businessId);
    
    // Establecer escucha en tiempo real
    const unsubscribe = businessDocRef.onSnapshot(
      (doc) => {
        if (!doc.exists) {
          Alert.alert('Error', 'Negocio no encontrado');
          navigation.goBack();
          return;
        }
        
        const businessData = {
          id: doc.id,
          ...doc.data()
        } as Business;
        
        setBusiness(businessData);
        setName(businessData.name || '');
        setDescription(businessData.description || '');
        setCategory(businessData.category || '');
        setAddress(businessData.address || '');
        setPhone(businessData.phone || '');
        setEmail(businessData.email || '');
        setWebsite(businessData.website || '');
        
        // Establecer imagen principal si existe
        if (businessData.images && businessData.images.length > 0) {
          const mainImage = businessData.images.find(img => img.isMain) || businessData.images[0];
          setImage(mainImage.url);
        }
        
        setLoading(false);
      },
      (error) => {
        console.error('Error loading business:', error);
        Alert.alert('Error', 'No se pudo cargar la información del negocio');
        setLoading(false);
      }
    );
    
    // Limpiar escucha cuando el componente se desmonte
    return () => unsubscribe();
  }, [businessId, navigation]);
  
  // Actualizar el negocio
  const handleUpdateBusiness = async () => {
    // Validación básica
    if (!name.trim() || !description.trim() || !category.trim()) {
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
      return;
    }
    
    try {
      setSaving(true);
      
      // Datos actualizados del negocio
      const updatedData: Partial<Business> = {
        name,
        description,
        category,
        address,
        phone,
        email,
        website,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Si hay una nueva imagen que no comienza con http (es local)
      if (image && !image.startsWith('http')) {
        // Subir nueva imagen
        const response = await fetch(image);
        const blob = await response.blob();
        
        const imageName = `businesses/${businessId}/images/main_${Date.now()}.jpg`;
        const ref = firebase.storage().ref().child(imageName);
        
        await ref.put(blob);
        const downloadUrl = await ref.getDownloadURL();
        
        // Si el negocio ya tiene imágenes, actualizar la principal
        if (business?.images && business.images.length > 0) {
          const updatedImages = [...business.images];
          const mainImageIndex = updatedImages.findIndex(img => img.isMain);
          
          if (mainImageIndex >= 0) {
            updatedImages[mainImageIndex] = {
              ...updatedImages[mainImageIndex],
              url: downloadUrl
            };
          } else {
            updatedImages.push({
              id: `img-${Date.now()}`,
              url: downloadUrl,
              isMain: true
            });
          }
          
          updatedData.images = updatedImages;
        } else {
          // Si no tiene imágenes, crear nueva entrada
          updatedData.images = [{
            id: `img-${Date.now()}`,
            url: downloadUrl,
            isMain: true
          }];
        }
      }
      
      // Actualizar en Firestore
      await firebase.firestore().collection('businesses').doc(businessId).update(updatedData);
      
      Alert.alert('Éxito', 'Negocio actualizado correctamente', [
        { 
          text: 'OK', 
          onPress: () => {
            // Usar CommonActions para asegurar que las pantallas anteriores se actualicen
            navigation.dispatch(
              CommonActions.goBack()
            );
          } 
        }
      ]);
    } catch (error) {
      console.error('Error updating business:', error);
      Alert.alert('Error', 'No se pudo actualizar el negocio');
    } finally {
      setSaving(false);
    }
  };
  
  // Seleccionar imagen
  const pickImage = async () => {
    try {
      // Solicitar permisos
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos para cambiar la imagen.');
          return;
        }
      }
      
      // Lanzar selector de imágenes
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
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };
  
  // Navegación a pantallas de edición avanzada
  const navigateToBusinessHours = () => {
    if (!business) return;
    
    // Usar un enfoque de callback para actualizar la información
    const callbackId = `businessHours_${Date.now()}`;
    
    // Definir la función de actualización
    const updateHours = async (hours: BusinessHours) => {
      try {
        await firebase.firestore().collection('businesses').doc(businessId).update({
          businessHours: hours,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Mostrar confirmación
        Alert.alert('Éxito', 'Horarios actualizados correctamente');
        
        // Actualizar el estado local
        if (business) {
          setBusiness({
            ...business,
            businessHours: hours
          });
        }
      } catch (error) {
        console.error('Error updating business hours:', error);
        Alert.alert('Error', 'No se pudieron actualizar los horarios');
      }
    };
    
    // Registrar el callback usando StoreContext
    store.setCallback(callbackId, updateHours);
    
    // Navegar a la pantalla de horarios
    navigation.navigate('BusinessHours', {
      initialHours: business.businessHours,
      callbackId
    });
  };
  
  const navigateToPaymentMethods = () => {
    if (!business) return;
    
    const callbackId = `paymentMethods_${Date.now()}`;
    
    // Definir la función de actualización
    const updatePaymentMethods = async (methods: string[]) => {
      try {
        await firebase.firestore().collection('businesses').doc(businessId).update({
          paymentMethods: methods,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Mostrar confirmación
        Alert.alert('Éxito', 'Métodos de pago actualizados correctamente');
        
        // Actualizar el estado local
        if (business) {
          setBusiness({
            ...business,
            paymentMethods: methods
          });
        }
      } catch (error) {
        console.error('Error updating payment methods:', error);
        Alert.alert('Error', 'No se pudieron actualizar los métodos de pago');
      }
    };
    
    // Registrar el callback usando StoreContext
    store.setCallback(callbackId, updatePaymentMethods);
    
    navigation.navigate('PaymentMethods', {
      initialMethods: business.paymentMethods || [],
      callbackId
    });
  };
  
  const navigateToSocialLinks = () => {
    if (!business) return;
    
    const callbackId = `socialLinks_${Date.now()}`;
    
    // Definir la función de actualización
    const updateSocialLinks = async (links: SocialLinks) => {
      try {
        await firebase.firestore().collection('businesses').doc(businessId).update({
          socialLinks: links,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Mostrar confirmación
        Alert.alert('Éxito', 'Enlaces sociales actualizados correctamente');
        
        // Actualizar el estado local
        if (business) {
          setBusiness({
            ...business,
            socialLinks: links
          });
        }
      } catch (error) {
        console.error('Error updating social links:', error);
        Alert.alert('Error', 'No se pudieron actualizar los enlaces sociales');
      }
    };
    
    // Registrar el callback usando StoreContext
    store.setCallback(callbackId, updateSocialLinks);
    
    navigation.navigate('SocialLinks', {
      initialLinks: business.socialLinks || {},
      callbackId
    });
  };
  
  const navigateToVideoManager = () => {
    if (!business) return;
    
    // Para VideoManager, usa una navegación directa si es necesario
    // o ajusta según tu sistema de navegación
    navigation.navigate('BusinessDetail', { 
      businessId: businessId
    });
  };
  
  const navigateToMenuEditor = () => {
    if (!business) return;
    
    // Similiar a VideoManager
    navigation.navigate('BusinessDetail', {
      businessId: businessId
    });
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando información del negocio...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
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
            <Text style={styles.headerTitle}>Editar Negocio</Text>
            <View style={styles.placeholder}></View>
          </View>
          
          {/* Formulario */}
          <View style={styles.form}>
            {/* Sección información básica */}
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
            
            {/* Sección información de contacto */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Información de Contacto</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Dirección</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Dirección del negocio"
                  placeholderTextColor="#8E8E93"
                />
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
            
            {/* Sección detalles adicionales */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Detalles Adicionales</Text>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToBusinessHours}
              >
                <MaterialIcons name="access-time" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Horarios de Atención</Text>
                {business?.businessHours && <MaterialIcons name="check-circle" size={20} color="#34C759" />}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToPaymentMethods}
              >
                <MaterialIcons name="payment" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Métodos de Pago</Text>
                {business?.paymentMethods && business.paymentMethods.length > 0 && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToSocialLinks}
              >
                <MaterialIcons name="link" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Redes Sociales</Text>
                {business?.socialLinks && Object.keys(business.socialLinks).length > 0 && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToVideoManager}
              >
                <MaterialIcons name="videocam" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Videos</Text>
                {business?.videos && business.videos.length > 0 && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.advancedButton}
                onPress={navigateToMenuEditor}
              >
                <MaterialIcons name="restaurant-menu" size={24} color="#007AFF" />
                <Text style={styles.advancedButtonText}>Menú</Text>
                {((business?.menu && business.menu.length > 0) || business?.menuUrl) && 
                  <MaterialIcons name="check-circle" size={20} color="#34C759" />
                }
              </TouchableOpacity>
            </View>
            
            {/* Selector de imagen */}
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
          </View>
          
          {/* Botón de guardar */}
          <TouchableOpacity 
            style={[
              styles.saveButton,
              saving ? styles.saveButtonDisabled : {}
            ]} 
            onPress={handleUpdateBusiness}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="save" size={24} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Actualizar Negocio</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
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
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#7FB5FF',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default EditBusinessScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  Switch,
  Alert,
  StatusBar,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { useBusinesses } from '../context/BusinessContext';
import { TextInput } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import 'firebase/compat/storage';

type NavigationProps = StackNavigationProp<RootStackParamList>;

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  userType: 'Cliente' | 'Propietario';
  photoURL: string | null;
  createdAt: string;
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const { getFavoriteBusinesses } = useBusinesses();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [tempProfile, setTempProfile] = useState<Partial<UserProfile>>({});
  const [darkMode, setDarkMode] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notifications, setNotifications] = useState(true);

  // Recent activity data
  const [recentActivity, setRecentActivity] = useState<{
    date: string;
    action: string;
    businessName?: string;
  }[]>([]);

  // User stats
  const [userStats, setUserStats] = useState({
    favorites: 0,
    reviews: 0,
    businessesOwned: 0,
    totalViews: 0
  });

  // Load user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      try {
        const user = firebase.auth().currentUser;
        if (user) {
          const userDoc = await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .get();

          if (userDoc.exists) {
            const userData = userDoc.data() || {};
            
            // Asegúrate de que la propiedad role se lea correctamente
            // Y se mapee al formato que espera la UI (Cliente/Propietario)
            const userRole = userData.role === 'business_owner' ? 'Propietario' : 'Cliente';
            console.log('User role mapped as:', userRole); // added for debugging
            
            setProfile({
              uid: user.uid,
              displayName: userData.displayName || user.displayName || 'Usuario',
              email: userData.email || user.email || '',
              phoneNumber: userData.phoneNumber || user.phoneNumber || null,
              address: userData.address || null,
              userType: userRole, // Usa el rol mapeado correctamente
              photoURL: userData.photoURL || user.photoURL || null,
              createdAt: userData.createdAt || new Date().toISOString(),
            });
            setTempProfile({
              displayName: userData.displayName || user.displayName || 'Usuario',
              phoneNumber: userData.phoneNumber || user.phoneNumber || null,
              address: userData.address || null,
            });
          } else {
            // Create a basic profile if none exists
            const defaultProfile = {
              displayName: user.displayName || 'Usuario',
              email: user.email || '',
              phoneNumber: user.phoneNumber || null,
              address: null,
              userType: 'Cliente' as const,
              photoURL: user.photoURL || null,
              createdAt: new Date().toISOString(),
            };
            
            // Save the default profile to Firestore
            await firebase.firestore()
              .collection('users')
              .doc(user.uid)
              .set(defaultProfile);
              
            setProfile({
              uid: user.uid,
              ...defaultProfile
            });
            setTempProfile({
              displayName: defaultProfile.displayName,
              phoneNumber: defaultProfile.phoneNumber,
              address: defaultProfile.address,
            });
          }
          
          // Get favorites count
          const favoriteCount = getFavoriteBusinesses().length;
          
          // Set user stats; include 'reviews' initialized to 0 for later real-time updates
          setUserStats({
            favorites: favoriteCount,
            reviews: 0, // agregado para cumplir con el tipo
            businessesOwned: profile?.userType === 'Propietario' ? Math.floor(Math.random() * 5) + 1 : 0,
            totalViews: Math.floor(Math.random() * 200) + 50
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        Alert.alert('Error', 'No se pudo cargar la información de perfil');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, []);

  // Save profile changes
  const saveProfileChanges = async () => {
    setLoading(true);
    try {
      const user = firebase.auth().currentUser;
      if (user) {
        await firebase.firestore()
          .collection('users')
          .doc(user.uid)
          .update({
            displayName: tempProfile.displayName,
            phoneNumber: tempProfile.phoneNumber,
            address: tempProfile.address,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        
        setProfile(prev => prev ? {
          ...prev,
          displayName: tempProfile.displayName || prev.displayName,
          phoneNumber: tempProfile.phoneNumber || prev.phoneNumber,
          address: tempProfile.address || prev.address,
        } : null);
        
        setEditMode(false);
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'No se pudo actualizar la información de perfil');
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setLogoutModalVisible(false);
    setLoading(true);
    try {
      await firebase.auth().signOut();
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Función para seleccionar y subir foto de perfil
  const handleChangePhoto = async () => {
    try {
      // Solicitar permisos de galería
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar una foto.');
        return;
      }
      
      // Abrir selector de imágenes
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        setUploadingPhoto(true);
        
        try {
          // Subir imagen a Firebase Storage
          const user = firebase.auth().currentUser;
          if (!user) throw new Error('No hay usuario autenticado');
          
          // Crear nombre único para la imagen
          const filename = `profile_photos/${user.uid}/${Date.now().toString()}`;
          const storageRef = firebase.storage().ref(filename);
          
          // Convertir URI a blob
          const response = await fetch(selectedImage.uri);
          const blob = await response.blob();
          
          // Subir blob a Firebase Storage
          await storageRef.put(blob);
          
          // Obtener URL de la imagen
          const downloadURL = await storageRef.getDownloadURL();
          
          // Actualizar perfil del usuario en Firestore
          await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .update({
              photoURL: downloadURL,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          
          // Actualizar la UI
          setProfile(prevProfile => prevProfile ? {
            ...prevProfile,
            photoURL: downloadURL
          } : null);
          
          Alert.alert('Éxito', 'Tu foto de perfil ha sido actualizada');
        } catch (error) {
          console.error('Error al subir imagen:', error);
          Alert.alert('Error', 'No se pudo actualizar tu foto de perfil');
        } finally {
          setUploadingPhoto(false);
        }
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'Hubo un problema al seleccionar la imagen');
    }
  };

  // Real-time listener for reviews count
  useEffect(() => {
    const user = firebase.auth().currentUser;
    if (user) {
      const unsubscribe = firebase.firestore()
        .collection('reviews')
        .where('userId', '==', user.uid)
        .where('moderationStatus', '==', 'approved')
        .onSnapshot(snapshot => {
          setUserStats(prevStats => ({
            ...prevStats,
            reviews: snapshot.size
          }));
        }, error => {
          console.error('Error al escuchar reseñas:', error);
        });
      return () => unsubscribe();
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

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
        <Text style={styles.title}>Mi Perfil</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => editMode ? saveProfileChanges() : setEditMode(true)}
        >
          <MaterialIcons 
            name={editMode ? "check" : "edit"} 
            size={24} 
            color="#007AFF" 
          />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile?.photoURL ? (
              <Image 
                source={{ uri: profile.photoURL }}
                style={styles.avatar} 
              />
            ) : (
              <View style={[styles.avatar, styles.defaultAvatar]}>
                <MaterialIcons name="person" size={50} color="#FFFFFF" />
              </View>
            )}
            
            {uploadingPhoto ? (
              <View style={styles.changePhotoButton}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.changePhotoButton}
                onPress={handleChangePhoto}
                disabled={uploadingPhoto}
              >
                <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.profileInfo}>
            {editMode ? (
              <TextInput
                style={styles.profileNameInput}
                value={tempProfile.displayName || ''}
                onChangeText={text => setTempProfile({...tempProfile, displayName: text})}
                placeholder="Nombre completo"
              />
            ) : (
              <Text style={styles.profileName}>{profile?.displayName}</Text>
            )}
            
            <View style={styles.userTypeBadge}>
              <MaterialIcons 
                name={profile?.userType === 'Propietario' ? "store" : "person"} 
                size={16} 
                color="#FFFFFF" 
              />
              <Text style={styles.userTypeText}>{profile?.userType}</Text>
            </View>
            
            <Text style={styles.joinDateText}>
              Miembro desde {new Date(profile?.createdAt || Date.now()).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        {/* Personal Information Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Información Personal</Text>
          
          <View style={styles.infoItem}>
            <MaterialIcons name="email" size={22} color="#007AFF" />
            <Text style={styles.infoLabel}>Correo:</Text>
            <Text style={styles.infoValue}>{profile?.email}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <MaterialIcons name="phone" size={22} color="#007AFF" />
            <Text style={styles.infoLabel}>Teléfono:</Text>
            {editMode ? (
              <TextInput
                style={styles.infoInput}
                value={tempProfile.phoneNumber || ''}
                onChangeText={text => setTempProfile({...tempProfile, phoneNumber: text})}
                placeholder="Agregar teléfono"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.infoValue}>
                {profile?.phoneNumber || 'No especificado'}
              </Text>
            )}
          </View>
          
          <View style={styles.infoItem}>
            <MaterialIcons name="location-on" size={22} color="#007AFF" />
            <Text style={styles.infoLabel}>Dirección:</Text>
            {editMode ? (
              <TextInput
                style={styles.infoInput}
                value={tempProfile.address || ''}
                onChangeText={text => setTempProfile({...tempProfile, address: text})}
                placeholder="Agregar dirección"
              />
            ) : (
              <Text style={styles.infoValue}>
                {profile?.address || 'No especificada'}
              </Text>
            )}
          </View>
        </View>
        
        {/* Settings Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          
          {/* Add "Mis Negocios" button for business owners */}
          {profile?.userType === 'Propietario' && (
            <>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => navigation.navigate('MyBusinesses')}
              >
                <MaterialIcons name="store" size={24} color="#007AFF" />
                <Text style={styles.menuItemText}>Mis Negocios</Text>
                <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  // Si no hay un negocio seleccionado, deberíamos mostrar una lista
                  // Por simplicidad, aquí vamos a navegar directamente si hay un negocio
                  if (profile.uid) {
                    // TODO: Aquí deberíamos obtener el businessId del usuario
                    // Por ahora usaremos un placeholder
                    // En una implementación real, deberías consultar el primer negocio del usuario
                    const businessId = profile.uid; // Usar el ID del usuario como placeholder
                    const businessName = "Mi Negocio"; // Placeholder
                    navigation.navigate('BusinessOrders', { 
                      businessId,
                      businessName
                    });
                  } else {
                    Alert.alert('Aviso', 'No tienes negocios registrados aún.');
                  }
                }}
              >
                <MaterialIcons name="shopping-basket" size={24} color="#007AFF" />
                <Text style={styles.menuItemText}>Pedidos de mis negocios</Text>
                <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
              </TouchableOpacity>
            </>
          )}
          
          {/* Add Favorites Link */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Favorites')}
          >
            <MaterialIcons name="favorite" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Mis Favoritos</Text>
            <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
          </TouchableOpacity>
          
          {/* Add Reservations Link */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('MyReservations', { 
              isBusinessView: profile?.userType === 'Propietario' 
            })}
          >
            <MaterialIcons name="event" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>
              {profile?.userType === 'Propietario'
                ? 'Gestionar Reservaciones'
                : 'Mis Reservaciones'}
            </Text>
            <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
          </TouchableOpacity>
          
          {/* Add Orders Link */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('OrdersList')}
          >
            <MaterialIcons name="receipt-long" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Mis Pedidos</Text>
            <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
          </TouchableOpacity>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="notifications" size={22} color="#007AFF" />
              <Text style={styles.settingLabel}>Notificaciones</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#D1D1D6', true: '#007AFF' }}
              thumbColor={'#FFFFFF'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="nightlight-round" size={22} color="#007AFF" />
              <Text style={styles.settingLabel}>Modo oscuro</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#D1D1D6', true: '#007AFF' }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        {/* Centro de Ayuda Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Centro de Ayuda</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('FAQs')}
          >
            <MaterialIcons name="help-outline" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Preguntas Frecuentes</Text>
            <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Support')}
          >
            <MaterialIcons name="headset-mic" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Contactar Soporte</Text>
            <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('TermsConditions')}
          >
            <MaterialIcons name="description" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Términos y Condiciones</Text>
            <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setLogoutModalVisible(true)}
        >
          <MaterialIcons name="logout" size={22} color="white" />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
        
        <View style={styles.footer} />
      </ScrollView>
      
      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <MaterialIcons name="home" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Inicio</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Map')}
        >
          <MaterialIcons name="explore" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Explorar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItemCenter}
          onPress={() => navigation.navigate('AddBusiness')}
        >
          <View style={styles.navItemCenterButton}>
            <MaterialIcons name="add" size={28} color="white" />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Conversations')}
        >
          <MaterialIcons name="chat" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Mensajes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <MaterialIcons name="person" size={24} color="#007AFF" />
          <Text style={styles.navItemTextActive}>Perfil</Text>
        </TouchableOpacity>
      </View>
      
      {/* Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cerrar Sesión</Text>
            <Text style={styles.modalText}>
              ¿Estás seguro que deseas cerrar sesión?
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleLogout}
              >
                <Text style={styles.modalConfirmText}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  editButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  defaultAvatar: {
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  profileNameInput: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    marginBottom: 8,
    textAlign: 'center',
    minWidth: 200,
  },
  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userTypeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  joinDateText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
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
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  infoLabel: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
    marginLeft: 12,
    width: 80,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    color: '#666666',
  },
  infoInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    padding: 0,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  activityDateContainer: {
    width: 80,
  },
  activityDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 16,
    color: '#333333',
  },
  activityBold: {
    fontWeight: '600',
  },
  activityNormal: {
    fontWeight: 'normal',
  },
  noActivityText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    padding: 16,
  },
  logoutButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  logoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  footer: {
    height: 60,
  },
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    height: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemCenterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navItemText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  navItemTextActive: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    marginRight: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalConfirmText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default ProfileScreen;
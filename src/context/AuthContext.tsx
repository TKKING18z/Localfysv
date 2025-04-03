import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Definición de tipo para el servicio de notificaciones
interface NotificationService {
  configureNotifications: () => Promise<any>;
  requestNotificationPermissions: () => Promise<{success: boolean; data?: {granted: boolean}}>;
  registerForPushNotifications: () => Promise<{success: boolean; data?: {token: string}}>;
  saveTokenToFirestore: (userId: string, token: string) => Promise<any>;
  removeTokenFromFirestore: (userId: string, token: string) => Promise<any>;
}

// Define los tipos para nuestro contexto
interface AuthContextType {
  user: firebase.User | null;
  isLoading: boolean;
  loading: boolean;
  isGoogleLoading: boolean; // Nuevo: estado de carga para Google
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string, role?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (data: any) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>; // Nueva función para iniciar sesión con Google
}

// Crear el contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook para usar el contexto de autenticación
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Proveedor del contexto
export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Nuevo estado para Google auth
  
  // Verificar si hay una sesión al iniciar
  useEffect(() => {
    console.log('AuthProvider initialized, checking for existing session...');
    
    // Cargar dinámicamente el servicio de notificaciones para evitar dependencias circulares
    let notificationService: NotificationService | undefined;
    try {
      notificationService = require('../../services/NotificationService').notificationService;
      
      // Inicializar notificaciones si el servicio está disponible
      if (notificationService) {
        notificationService.configureNotifications().catch((err: Error) => {
          console.error('Error configuring notifications:', err);
        });
      }
    } catch (err: unknown) {
      console.error('Error loading notification service:', err);
    }
    
    // Guardamos la referencia al suscriptor para limpiarla después
    const unsubscribe = firebase.auth().onAuthStateChanged(async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid);
      
      if (firebaseUser) {
        // Usuario autenticado
        setUser(firebaseUser);
        // Guardar info básica de sesión en AsyncStorage como respaldo
        try {
          await AsyncStorage.setItem('user_uid', firebaseUser.uid);
          await AsyncStorage.setItem('user_email', firebaseUser.email || '');
          await AsyncStorage.setItem('user_display_name', firebaseUser.displayName || '');
          console.log('Session info saved to AsyncStorage');
          
          // Registrar para notificaciones push después de iniciar sesión
          if (notificationService) {
            try {
              const permissionResult = await notificationService.requestNotificationPermissions();
              if (permissionResult.success && permissionResult.data?.granted) {
                const tokenResult = await notificationService.registerForPushNotifications();
                if (tokenResult.success && tokenResult.data?.token) {
                  // Guardar token en Firestore
                  await notificationService.saveTokenToFirestore(firebaseUser.uid, tokenResult.data.token);
                }
              }
            } catch (notificationError: unknown) {
              console.error('Error setting up notifications:', notificationError);
              // No fallar el login por problemas con notificaciones
            }
          }
        } catch (error: unknown) {
          console.error('Error saving session info to AsyncStorage:', error);
        }
      } else {
        // No hay usuario autenticado
        setUser(null);
        // Limpiar info de sesión en AsyncStorage
        try {
          await AsyncStorage.removeItem('user_uid');
          await AsyncStorage.removeItem('user_email');
          await AsyncStorage.removeItem('user_display_name');
          console.log('Session info removed from AsyncStorage');
        } catch (error: unknown) {
          console.error('Error removing session info from AsyncStorage:', error);
        }
      }
      
      setIsLoading(false);
    });
    
    // Limpieza al desmontar
    return () => unsubscribe();
  }, []);

  // Función para iniciar sesión
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Intentar iniciar sesión con Firebase
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      console.log('Login successful:', userCredential.user?.uid);
      
      // No necesitamos setUser aquí, ya que el onAuthStateChanged lo hará
      
      return true;
    } catch (error: any) {
      console.error('Login error:', error.message);
      Alert.alert('Error de inicio de sesión', error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Nueva función para iniciar sesión con Google
  const signInWithGoogle = async (): Promise<boolean> => {
    try {
      setIsGoogleLoading(true);
      
      // Configurar proveedor de Google
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      // En aplicaciones móviles, usamos signInWithRedirect() o signInWithPopup()
      // dependiendo de la plataforma y configuración
      const result = await firebase.auth().signInWithPopup(provider);
      
      if (result.user) {
        console.log('Google login successful:', result.user.uid);
        // onAuthStateChanged se encargará de actualizar el estado
        return true;
      } else {
        console.error('No user returned from Google sign in');
        return false;
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      // Mensajes de error más amigables
      if (error.code === 'auth/popup-closed-by-user') {
        Alert.alert('Inicio de sesión cancelado', 'Has cerrado la ventana de inicio de sesión de Google.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // No mostrar alerta para este caso, ya que es una operación normal
        console.log('Popup request cancelled');
      } else {
        Alert.alert('Error al iniciar sesión con Google', 
                    error.message || 'Ocurrió un error durante el inicio de sesión con Google.');
      }
      return false;
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Función para registrar un nuevo usuario
  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Crear usuario en Firebase
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      
      // Actualizar perfil con el nombre
      if (userCredential.user) {
        await userCredential.user.updateProfile({
          displayName: name
        });
        
        // Refrescar el usuario para que tenga el displayName actualizado
        await userCredential.user.reload();
        console.log('Registration successful:', userCredential.user.uid);
      }
      
      return true;
    } catch (error: any) {
      console.error('Registration error:', error.message);
      Alert.alert('Error de registro', error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Add signUp as an alias for register
  const signUp = async (email: string, password: string, name: string, role?: string): Promise<boolean> => {
    return register(email, password, name);
  };

  // Función para cerrar sesión
  const logout = async (): Promise<void> => {
    try {
      // Eliminar token de notificación antes de cerrar sesión
      if (user) {
        try {
          // Cargar dinámicamente el servicio de notificaciones
          const notificationService: NotificationService | undefined = require('../../services/NotificationService').notificationService;
          if (notificationService) {
            // Obtener token actual
            const tokenResult = await notificationService.registerForPushNotifications();
            if (tokenResult.success && tokenResult.data?.token) {
              // Eliminar token de Firestore
              await notificationService.removeTokenFromFirestore(user.uid, tokenResult.data.token);
            }
          }
        } catch (notificationError: unknown) {
          console.error('Error removing notification token:', notificationError);
          // Continuar con el cierre de sesión aunque falle la eliminación del token
        }
      }
      
      await firebase.auth().signOut();
      console.log('Logout successful');
      // No necesitamos setUser aquí, ya que el onAuthStateChanged lo hará
    } catch (error: any) {
      console.error('Logout error:', error.message);
      Alert.alert('Error al cerrar sesión', error.message);
    }
  };

  // Función para restablecer contraseña
  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      console.log('Password reset email sent');
      return true;
    } catch (error: any) {
      console.error('Password reset error:', error.message);
      Alert.alert('Error al restablecer contraseña', error.message);
      return false;
    }
  };

  // Función para actualizar el perfil
  const updateProfile = async (data: any): Promise<boolean> => {
    try {
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }
      
      await user.updateProfile(data);
      // Refrescar el usuario
      await user.reload();
      // Actualizar el estado para reflejar los cambios
      const currentUser = firebase.auth().currentUser;
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      console.log('Profile updated successfully');
      return true;
    } catch (error: any) {
      console.error('Profile update error:', error.message);
      Alert.alert('Error al actualizar perfil', error.message);
      return false;
    }
  };

  // Proporcionar el contexto a los componentes hijos
  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      loading: isLoading,
      isGoogleLoading,
      login,
      register,
      signUp,
      logout,
      resetPassword,
      updateProfile,
      signInWithGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
};
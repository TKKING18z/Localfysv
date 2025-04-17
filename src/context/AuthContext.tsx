import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
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

// Definir las claves para AsyncStorage
const STORAGE_KEYS = {
  USER_DATA: 'user_data',
  AUTH_PERSISTENCE: 'auth_persistence',
  SESSION_DATA: 'session_data'
};

// Interfaz para los datos de sesión
interface SessionData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLogin: string;
  authMethod: 'email' | 'google';
}

// Interfaz para el resultado del registro
interface SignUpResult {
  success: boolean;
  user?: firebase.User;
  error?: string;
}

// Define los tipos para nuestro contexto
interface AuthContextType {
  user: firebase.User | null;
  isLoading: boolean;
  loading: boolean;
  isGoogleLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string, role: string) => Promise<SignUpResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (data: any) => Promise<boolean>;
  saveSessionData: (firebaseUser: firebase.User, authMethod: 'email' | 'google') => Promise<void>;
  restoreSession: () => Promise<SessionData | null>;
}

// Crear el contexto
const AuthContext = createContext<AuthContextType | null>(null);

// Hook para usar el contexto de autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Proveedor del contexto
export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  // Función para guardar los datos de sesión
  const saveSessionData = async (firebaseUser: firebase.User, authMethod: 'email' | 'google') => {
    const sessionData: SessionData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      lastLogin: new Date().toISOString(),
      authMethod
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(sessionData));
      console.log('Session data saved successfully');
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  };

  // Función para restaurar la sesión
  const restoreSession = async () => {
    try {
      const sessionData = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_DATA);
      if (sessionData) {
        const parsedData: SessionData = JSON.parse(sessionData);
        console.log('Restored session data:', parsedData);
        return parsedData;
      }
    } catch (error) {
      console.error('Error restoring session:', error);
    }
    return null;
  };

  // Verificar si hay una sesión al iniciar
  useEffect(() => {
    console.log('AuthProvider initialized, checking for existing session...');
    
    let notificationService: NotificationService | undefined;
    try {
      notificationService = require('../../services/NotificationService').notificationService;
      
      if (notificationService) {
        notificationService.configureNotifications().catch((err: Error) => {
          console.error('Error configuring notifications:', err);
        });
      }
    } catch (err: unknown) {
      console.error('Error loading notification service:', err);
    }
    
    const unsubscribe = firebase.auth().onAuthStateChanged(async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Restaurar o guardar datos de sesión
        const existingSession = await restoreSession();
        const authMethod = existingSession?.authMethod || 'email';
        await saveSessionData(firebaseUser, authMethod);
        
        if (notificationService) {
          try {
            const permissionResult = await notificationService.requestNotificationPermissions();
            if (permissionResult.success && permissionResult.data?.granted) {
              const tokenResult = await notificationService.registerForPushNotifications();
              if (tokenResult.success && tokenResult.data?.token) {
                await notificationService.saveTokenToFirestore(firebaseUser.uid, tokenResult.data.token);
              }
            }
          } catch (notificationError: unknown) {
            console.error('Error setting up notifications:', notificationError);
          }
        }
      } else {
        setUser(null);
        // Limpiar datos de sesión
        try {
          await AsyncStorage.multiRemove([
            STORAGE_KEYS.USER_DATA,
            STORAGE_KEYS.AUTH_PERSISTENCE,
            STORAGE_KEYS.SESSION_DATA
          ]);
          console.log('Session data cleared');
        } catch (error) {
          console.error('Error clearing session data:', error);
        }
      }
      
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Función para iniciar sesión
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log(`Iniciando sesión con email: ${email}`);
      
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      
      if (userCredential.user) {
        const userDoc = await firebase.firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .get();
        
        if (userDoc.exists) {
          const userToSet = userCredential.user;
          setUser(userToSet);
          
          // Guardar datos de sesión
          await saveSessionData(userToSet, 'email');
          
          console.log("Login exitoso, datos de usuario guardados");
          return true;
        }
      }
      return false;
    } catch (error: any) {
      console.error('Login error:', error.message);
      Alert.alert('Error de inicio de sesión', error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Función para registrar un nuevo usuario
  const signUp = async (email: string, password: string, name: string, role: string): Promise<SignUpResult> => {
    try {
      setIsLoading(true);
      
      // Crear usuario en Firebase Auth
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      
      if (userCredential.user) {
        // Actualizar el perfil con el nombre
        await userCredential.user.updateProfile({
          displayName: name
        });
        
        // Crear documento en Firestore
        await firebase.firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .set({
            displayName: name,
            email: email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            authProvider: 'email'
          });
        
        return { 
          success: true, 
          user: userCredential.user 
        };
      }
      
      return {
        success: false,
        error: 'No se pudo crear el usuario'
      };
    } catch (error: any) {
      console.error('Error en el registro:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Función para cerrar sesión
  const logout = async (): Promise<void> => {
    try {
      if (user) {
        try {
          const notificationService: NotificationService | undefined = require('../../services/NotificationService').notificationService;
          if (notificationService) {
            const tokenResult = await notificationService.registerForPushNotifications();
            if (tokenResult.success && tokenResult.data?.token) {
              await notificationService.removeTokenFromFirestore(user.uid, tokenResult.data.token);
            }
          }
        } catch (notificationError: unknown) {
          console.error('Error removing notification token:', notificationError);
        }
      }
      
      // Limpiar datos de sesión antes de cerrar sesión
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.AUTH_PERSISTENCE,
        STORAGE_KEYS.SESSION_DATA
      ]);
      
      await firebase.auth().signOut();
      console.log('Logout successful');
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
      setIsLoading(true);
      
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }
      
      // Actualizar el perfil del usuario en Firestore
      await firebase.firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      
      // Si hay cambios en displayName o photoURL, actualizar también en Firebase Auth
      if (data.displayName || data.photoURL) {
        await user.updateProfile({
          displayName: data.displayName || user.displayName,
          photoURL: data.photoURL || user.photoURL
        });
      }
      
      console.log('Profile updated successfully');
      return true;
    } catch (error: any) {
      console.error('Profile update error:', error.message);
      Alert.alert('Error al actualizar perfil', error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Valores del contexto
  const value = {
    user,
    isLoading,
    loading: isLoading,
    isGoogleLoading,
    login,
    signUp,
    logout,
    resetPassword,
    updateProfile,
    saveSessionData,
    restoreSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
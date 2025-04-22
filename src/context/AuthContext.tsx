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
  saveSessionData: (firebaseUser: firebase.User, authMethod: 'email' | 'google') => Promise<SessionData | null>;
  restoreSession: () => Promise<SessionData | null>;
  isNewUser: boolean;
  setIsNewUser: (value: boolean) => void;
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
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // Función para guardar los datos de sesión
  const saveSessionData = async (firebaseUser: firebase.User, authMethod: 'email' | 'google') => {
    try {
      // Check if user is new before saving session
      await checkIfUserIsNew(firebaseUser.uid);
      
      // Original code for saving session data
      const userData: SessionData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || '',
        lastLogin: new Date().toISOString(),
        authMethod,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(userData));
      console.log("Saved session for:", userData.email);
      return userData;
    } catch (error) {
      console.error('Error saving session data:', error);
      return null;
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
      
      try {
        if (firebaseUser) {
          // Set user state after a slight delay to ensure all React renders complete first
          setTimeout(() => {
            setUser(firebaseUser);
          }, 0);
          
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
          // Set user state to null after a slight delay
          setTimeout(() => {
            setUser(null);
          }, 0);
          
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
      } catch (err) {
        console.error('Error processing auth state change:', err);
        setTimeout(() => {
          setUser(null);
        }, 0);
      } finally {
        // Set loading state after a slight delay
        setTimeout(() => {
          setIsLoading(false);
        }, 0);
      }
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
          
          // Use setTimeout to defer state update
          setTimeout(() => {
            setUser(userToSet);
          }, 0);
          
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
      setTimeout(() => {
        setIsLoading(false);
      }, 0);
    }
  };

  // Función para registrar un nuevo usuario
  const signUp = async (email: string, password: string, name: string, role: string): Promise<SignUpResult> => {
    try {
      setIsLoading(true);
      
      // Este usuario es definitivamente nuevo, así que marcarlo como tal inmediatamente
      setIsNewUser(true);
      
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
        
        console.log('[AuthContext] Usuario registrado correctamente, marcado como nuevo');
        
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
    console.log('[AuthContext] Starting logout process');
    
    try {
      // 1. Primero desactivar cualquier indicador de usuario nuevo para evitar problemas de navegación
      setIsNewUser(false);
      
      // 2. Preparar una bandera para saber si la limpieza funcionó correctamente
      let cleanupSuccessful = true;
      
      // 3. Si hay un usuario, intentar limpiar recursos asociados
      if (user) {
        try {
          console.log('[AuthContext] Cleaning up resources for user:', user.uid);
          
          // Intentar limpiar listeners de Chat de forma segura
          try {
            // Usar la función estática exportada que no depende de hooks
            const chatModule = require('./ChatContext');
            
            if (chatModule && typeof chatModule.cleanupChatListeners === 'function') {
              console.log('[AuthContext] Calling chat cleanup function');
              chatModule.cleanupChatListeners(user.uid);
            } else {
              console.log('[AuthContext] Chat cleanup function not available');
            }
          } catch (chatError) {
            console.error('[AuthContext] Error during chat cleanup:', chatError);
            // No fallar todo el proceso de logout por este error
            cleanupSuccessful = false;
          }
          
          // Limpiar token de notificaciones si es posible
          try {
            let notificationService;
            
            try {
              notificationService = require('../../services/NotificationService').notificationService;
            } catch (importError) {
              console.error('[AuthContext] Could not import notification service:', importError);
            }
            
            if (notificationService) {
              console.log('[AuthContext] Cleaning up notification tokens');
              
              try {
                const tokenResult = await notificationService.registerForPushNotifications();
                if (tokenResult.success && tokenResult.data?.token) {
                  await notificationService.removeTokenFromFirestore(user.uid, tokenResult.data.token);
                }
              } catch (tokenError) {
                console.error('[AuthContext] Error removing notification token:', tokenError);
                // No fallar todo el proceso por este error
                cleanupSuccessful = false;
              }
            }
          } catch (notificationError) {
            console.error('[AuthContext] Error in notification cleanup:', notificationError);
            cleanupSuccessful = false;
          }
        } catch (resourceError) {
          console.error('[AuthContext] Error cleaning up user resources:', resourceError);
          cleanupSuccessful = false;
        }
      }
      
      // 4. Limpiar AsyncStorage
      try {
        console.log('[AuthContext] Cleaning AsyncStorage data');
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.USER_DATA,
          STORAGE_KEYS.AUTH_PERSISTENCE,
          STORAGE_KEYS.SESSION_DATA
        ]);
      } catch (storageError) {
        console.error('[AuthContext] Error clearing storage:', storageError);
        cleanupSuccessful = false;
      }
      
      // 5. Un pequeño retraso antes de cerrar sesión para evitar problemas de sincronización
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 6. Cerrar sesión en Firebase sin importar si hubo errores en la limpieza
      console.log('[AuthContext] Signing out from Firebase');
      await firebase.auth().signOut();
      
      // Si todo funcionó correctamente, actualizar el log
      if (cleanupSuccessful) {
        console.log('[AuthContext] Logout completed successfully with all cleanups');
      } else {
        console.log('[AuthContext] Logout completed with some cleanup errors');
      }
      
      // 7. Limpiar el estado local después del logout completo
      setTimeout(() => {
        // No usar setUser directamente aquí - Firebase.onAuthStateChanged se encargará de esto
        console.log('[AuthContext] Local state cleanup complete');
      }, 100);
      
    } catch (error: any) {
      console.error('[AuthContext] Critical error during logout:', error);
      
      // Intentar cerrar sesión a pesar de errores
      try {
        await firebase.auth().signOut();
        console.log('[AuthContext] Emergency signout successful');
      } catch (finalError) {
        console.error('[AuthContext] Even emergency signout failed:', finalError);
        throw new Error(`No se pudo cerrar sesión: ${error.message}`);
      }
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

  // Mejorar la función checkIfUserIsNew
  const checkIfUserIsNew = async (userId: string) => {
    try {
      console.log('[AuthContext] Verificando si el usuario es nuevo:', userId);
      const firstLoginKey = `@first_login_${userId}`;
      const isFirstLogin = await AsyncStorage.getItem(firstLoginKey);
      
      if (!isFirstLogin) {
        // Usuario está ingresando por primera vez
        console.log('[AuthContext] Es primera vez del usuario, marcando como nuevo');
        await AsyncStorage.setItem(firstLoginKey, 'true');
        setIsNewUser(true);
        return true;
      } else {
        console.log('[AuthContext] Usuario ya ha ingresado antes, no es nuevo');
        setIsNewUser(false);
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Error al verificar si el usuario es nuevo:', error);
      setIsNewUser(false);
      return false;
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
    restoreSession,
    isNewUser,
    setIsNewUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
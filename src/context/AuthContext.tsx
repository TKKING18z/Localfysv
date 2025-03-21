import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Define los tipos para nuestro contexto
interface AuthContextType {
  user: firebase.User | null;
  isLoading: boolean;
  loading: boolean; // Add alias for loading
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string, role?: string) => Promise<boolean>; // Add alias for register
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (data: any) => Promise<boolean>;
}

// Crear el contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Proveedor del contexto
export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Verificar si hay una sesión al iniciar
  useEffect(() => {
    console.log('AuthProvider initialized, checking for existing session...');
    
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
        } catch (error) {
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
        } catch (error) {
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
      loading: isLoading, // Add loading as alias for isLoading
      login,
      register,
      signUp, // Add the new signUp alias
      logout,
      resetPassword,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para acceder al contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  
  return context;
};
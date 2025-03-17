// src/context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { authService, UserData, UserRole } from '../services/authService';

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<boolean>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
}

// Crear el contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Proveedor del contexto
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Observar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(async (firebaseUser) => {
      setLoading(true);
      try {
        if (firebaseUser) {
          // Obtener datos actualizados del usuario desde Firestore
          const userDoc = await firebase.firestore().collection('users').doc(firebaseUser.uid).get();
          
          // Combinar datos de Firebase Auth con datos de Firestore
          const userData = userDoc.exists ? userDoc.data() : {};
          
          // Asegurar que tenemos el rol del usuario - obtenerlo de Firestore o usar un valor por defecto
          const userRole = userData?.role || 'customer';
          
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: userData?.displayName || firebaseUser.displayName,
            photoURL: userData?.photoURL || firebaseUser.photoURL,
            role: userRole, // Asegurarnos de incluir el rol del usuario
            // Otros campos según necesites
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error en observador de autenticación:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Iniciar sesión
  const signIn = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await authService.signIn(email, password);
      if (response.success && response.user) {
        setUser(response.user);
        return true;
      } else if (response.error) {
        Alert.alert("Error de acceso", response.error);
      }
      return false;
    } catch (error) {
      console.error("Error en inicio de sesión:", error);
      Alert.alert("Error", "No se pudo iniciar sesión");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Registrar usuario
  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await authService.signUp(email, password, name, role);
      if (response.success && response.user) {
        setUser(response.user);
        return true;
      } else if (response.error) {
        Alert.alert("Error de registro", response.error);
      }
      return false;
    } catch (error) {
      console.error("Error en registro:", error);
      Alert.alert("Error", "No se pudo crear la cuenta");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Cerrar sesión
  const signOut = async (): Promise<void> => {
    try {
      await authService.signOut();
      setUser(null);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      Alert.alert("Error", "No se pudo cerrar sesión");
    }
  };

  // Recuperar contraseña
  const forgotPassword = async (email: string): Promise<boolean> => {
    try {
      const response = await authService.forgotPassword(email);
      if (!response.success && response.error) {
        Alert.alert("Error", response.error);
      }
      return response.success;
    } catch (error) {
      console.error("Error en recuperación de contraseña:", error);
      Alert.alert("Error", "No se pudo enviar el correo de recuperación");
      return false;
    }
  };

  // Valores del contexto
  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    forgotPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Importación necesaria para auth state changes
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
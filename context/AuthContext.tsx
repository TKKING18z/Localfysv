import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../config/firebase';
import { Platform } from 'react-native';
import { appleAuthService } from '../src/services/appleAuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definir tipo para el usuario
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Definir el contexto
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAppleAuthAvailable: boolean;
  signInWithApple: () => Promise<{success: boolean, error?: string}>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  signOut: async () => {},
  isAppleAuthAvailable: false,
  signInWithApple: async () => ({ success: false }),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user as User);
      setLoading(false);
    });

    // Check if Apple Authentication is available
    const checkAppleAuthAvailability = async () => {
      if (Platform.OS === 'ios') {
        const available = await appleAuthService.isAvailable();
        setIsAppleAuthAvailable(available);
      }
    };

    checkAppleAuthAvailability();

    return unsubscribe;
  }, []);

  const signOut = () => auth.signOut();

  const signInWithApple = async () => {
    if (!isAppleAuthAvailable) {
      return { success: false, error: "Apple authentication is not available on this device" };
    }
    
    try {
      return await appleAuthService.signInWithApple();
    } catch (error: any) {
      console.error("Error in Apple sign in:", error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    currentUser,
    loading,
    signOut,
    isAppleAuthAvailable,
    signInWithApple,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

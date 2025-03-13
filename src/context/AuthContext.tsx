import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { Alert } from 'react-native';

// Define user role type
export type UserRole = 'customer' | 'business_owner';

// Define user type
interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
}

// Define auth context type
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<boolean>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get user profile from Firestore
          const userDoc = await firebase.firestore()
            .collection('users')
            .doc(firebaseUser.uid)
            .get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Validar que el rol sea uno de los valores esperados
            const userRole: UserRole = 
              userData?.role === 'business_owner' ? 'business_owner' : 'customer';
              
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: userData?.displayName || firebaseUser.displayName || '',
              role: userRole,
            });
            
            console.log("Usuario autenticado con rol:", userRole);
          } else {
            // User document doesn't exist - create a basic one
            console.log("No se encontró documento de usuario, creando uno básico");
            const basicUserData = {
              displayName: firebaseUser.displayName || 'Usuario',
              email: firebaseUser.email || '',
              role: 'customer' as UserRole,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await firebase.firestore()
              .collection('users')
              .doc(firebaseUser.uid)
              .set(basicUserData);
              
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Usuario',
              role: 'customer',
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      await firebase.auth().signInWithEmailAndPassword(email, password);
      return true;
    } catch (error: any) {
      console.error("Error signing in:", error);
      
      // Mensajes de error específicos
      let errorMessage = "Error al iniciar sesión";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No existe una cuenta con este correo electrónico";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Contraseña incorrecta";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Correo electrónico no válido";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Demasiados intentos fallidos. Intenta más tarde";
      }
      
      Alert.alert("Error de acceso", errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<boolean> => {
    try {
      setLoading(true);
      console.log(`Registrando usuario con rol: ${role}`);
      
      // Create user in Firebase Auth
      const credentials = await firebase.auth().createUserWithEmailAndPassword(email, password);
      
      if (credentials.user) {
        // Update display name
        await credentials.user.updateProfile({
          displayName: name,
        });

        // Create user document in Firestore with the correct role
        await firebase.firestore().collection('users').doc(credentials.user.uid).set({
          displayName: name,
          email,
          role, // Asegurarse de que esto se guarde correctamente
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        
        console.log(`Usuario registrado exitosamente con rol: ${role}`);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Error signing up:", error);
      
      // Mensajes de error específicos
      let errorMessage = "Error al crear cuenta";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este correo electrónico ya está en uso";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Correo electrónico no válido";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "La contraseña es demasiado débil";
      }
      
      Alert.alert("Error de registro", errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      await firebase.auth().signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Reset password
  const forgotPassword = async (email: string): Promise<boolean> => {
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      return true;
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return false;
    }
  };

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

// Create custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
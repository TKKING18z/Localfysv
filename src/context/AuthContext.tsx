import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

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
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: userData?.displayName || firebaseUser.displayName || '',
              role: userData?.role || 'customer',
            });
          } else {
            // User document doesn't exist
            setUser(null);
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
    } catch (error) {
      console.error("Error signing in:", error);
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
      // Create user in Firebase Auth
      const credentials = await firebase.auth().createUserWithEmailAndPassword(email, password);
      
      if (credentials.user) {
        // Update display name
        await credentials.user.updateProfile({
          displayName: name,
        });

        // Create user document in Firestore
        await firebase.firestore().collection('users').doc(credentials.user.uid).set({
          displayName: name,
          email,
          role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        return true;
      }
      return false;
    } catch (error) {
      console.error("Error signing up:", error);
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
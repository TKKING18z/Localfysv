// src/services/authService.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { Alert } from 'react-native';

// Definir tipos
export type UserRole = 'customer' | 'business_owner';

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  phoneNumber?: string | null;
  address?: string | null;
  photoURL?: string | null;
  createdAt?: Date;
}

interface AuthResponse {
  success: boolean;
  user?: UserData | null;
  error?: string;
}

// Funciones del servicio de autenticación
export const authService = {
  // Iniciar sesión
  signIn: async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      
      if (!userCredential.user) {
        return { success: false, error: 'No se pudo autenticar el usuario' };
      }
      
      // Obtener datos del usuario de Firestore
      const userData = await getUserData(userCredential.user.uid);
      
      return { 
        success: true, 
        user: userData 
      };
    } catch (error: any) {
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
      
      return { success: false, error: errorMessage };
    }
  },
  
  // Registrar usuario
  signUp: async (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<AuthResponse> => {
    try {
      // Crear usuario en Firebase Auth
      const credentials = await firebase.auth().createUserWithEmailAndPassword(email, password);
      
      if (!credentials.user) {
        return { success: false, error: 'No se pudo crear el usuario' };
      }
      
      // Actualizar displayName
      await credentials.user.updateProfile({
        displayName: name
      });
      
      // Crear documento en Firestore
      const userData: UserData = {
        uid: credentials.user.uid,
        displayName: name,
        email: email,
        role: role,
        createdAt: new Date()
      };
      
      await firebase.firestore()
        .collection('users')
        .doc(credentials.user.uid)
        .set(userData);
      
      return { success: true, user: userData };
    } catch (error: any) {
      // Mensajes de error específicos
      let errorMessage = "Error al crear cuenta";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este correo electrónico ya está en uso";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Correo electrónico no válido";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "La contraseña es demasiado débil";
      }
      
      return { success: false, error: errorMessage };
    }
  },
  
  // Cerrar sesión
  signOut: async (): Promise<AuthResponse> => {
    try {
      await firebase.auth().signOut();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Error al cerrar sesión' };
    }
  },
  
  // Recuperar contraseña
  forgotPassword: async (email: string): Promise<AuthResponse> => {
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      return { success: true };
    } catch (error: any) {
      let errorMessage = "Error al enviar el correo de recuperación";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No existe una cuenta con este correo electrónico";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Correo electrónico no válido";
      }
      
      return { success: false, error: errorMessage };
    }
  },
  
  // Obtener usuario actual
  getCurrentUser: async (): Promise<UserData | null> => {
    const firebaseUser = firebase.auth().currentUser;
    if (!firebaseUser) return null;
    
    return await getUserData(firebaseUser.uid);
  },
  
  // Verificar y actualizar integridad de datos del usuario
  verifyUserDataIntegrity: async (userId: string): Promise<AuthResponse> => {
    try {
      // Verificar si existe el documento del usuario
      const userDoc = await firebase.firestore()
        .collection('users')
        .doc(userId)
        .get();
        
      if (!userDoc.exists) {
        // El usuario no tiene documento en Firestore
        const firebaseUser = firebase.auth().currentUser;
        if (!firebaseUser) {
          return { success: false, error: 'Usuario no autenticado' };
        }
        
        // Crear documento básico
        const basicUserData: UserData = {
          uid: userId,
          displayName: firebaseUser.displayName || 'Usuario',
          email: firebaseUser.email,
          role: 'customer', // Rol por defecto
          createdAt: new Date()
        };
        
        await firebase.firestore()
          .collection('users')
          .doc(userId)
          .set(basicUserData);
          
        return { success: true, user: basicUserData };
      }
      
      // Verificar que el rol es válido
      const userData = userDoc.data();
      if (!userData?.role || (userData.role !== 'customer' && userData.role !== 'business_owner')) {
        // Corregir el rol
        await firebase.firestore()
          .collection('users')
          .doc(userId)
          .update({ role: 'customer' });
      }
      
      // Verificar que createdAt existe
      if (!userData?.createdAt) {
        // Si no existe, añadirlo
        await firebase.firestore()
          .collection('users')
          .doc(userId)
          .update({ 
            createdAt: firebase.firestore.FieldValue.serverTimestamp() 
          });
      }
      
      // Obtener y retornar los datos actualizados
      const updatedUser = await getUserData(userId);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Error al verificar integridad de datos:', error);
      return { success: false, error: 'Error al verificar la integridad de los datos' };
    }
  }
};

// Función auxiliar para obtener datos del usuario
async function getUserData(userId: string): Promise<UserData | null> {
  try {
    const doc = await firebase.firestore()
      .collection('users')
      .doc(userId)
      .get();
      
    if (!doc.exists) return null;
    
    const data = doc.data();
    if (!data) return null;
    
    // Asegurarse de que el rol es uno de los valores permitidos
    const role: UserRole = data.role === 'business_owner' ? 'business_owner' : 'customer';
    
    // Manejar de forma segura la fecha de creación
    let createdAt: Date = new Date();
    if (data.createdAt) {
      // Verificar si createdAt es un timestamp de Firestore
      if (typeof data.createdAt.toDate === 'function') {
        try {
          createdAt = data.createdAt.toDate();
        } catch (error) {
          console.warn('Error al convertir timestamp:', error);
          // Mantener el valor por defecto (new Date())
        }
      } else if (data.createdAt instanceof Date) {
        // Si ya es un objeto Date
        createdAt = data.createdAt;
      } else if (typeof data.createdAt === 'string') {
        // Si es una cadena, intentar convertirla
        try {
          createdAt = new Date(data.createdAt);
        } catch (error) {
          console.warn('Error al parsear fecha:', error);
          // Mantener el valor por defecto (new Date())
        }
      }
    }
    
    return {
      uid: userId,
      displayName: data.displayName || null,
      email: data.email || null,
      role: role,
      phoneNumber: data.phoneNumber || null,
      address: data.address || null,
      photoURL: data.photoURL || null,
      createdAt: createdAt
    };
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    return null;
  }
}

// Servicio para gestionar datos de usuarios
export const userService = {
  // Actualizar perfil de usuario
  updateProfile: async (
    userId: string, 
    profileData: Partial<UserData>
  ): Promise<AuthResponse> => {
    try {
      // Asegurarse de que no se pierda createdAt si no está definido
      if (!profileData.createdAt) {
        const userData = await getUserData(userId);
        if (userData?.createdAt) {
          profileData.createdAt = userData.createdAt;
        }
      }
      
      // Actualizar en Firestore
      await firebase.firestore()
        .collection('users')
        .doc(userId)
        .update({
          ...profileData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      
      // Si hay displayName, actualizar también en Auth
      if (profileData.displayName) {
        const user = firebase.auth().currentUser;
        if (user) {
          await user.updateProfile({
            displayName: profileData.displayName
          });
        }
      }
      
      // Obtener datos actualizados
      const updatedUser = await getUserData(userId);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      return { success: false, error: 'Error al actualizar el perfil' };
    }
  },
  
  // Obtener datos de usuario
  getUserData: async (userId: string): Promise<UserData | null> => {
    return await getUserData(userId);
  },
  
  // Verificar integridad de datos del usuario (duplicado de authService para compatibilidad)
  verifyUserDataIntegrity: async (userId: string): Promise<AuthResponse> => {
    return await authService.verifyUserDataIntegrity(userId);
  },
  
  // Convertir usuario a propietario de negocio
  convertToBusinessOwner: async (userId: string): Promise<AuthResponse> => {
    try {
      // Actualizar rol en Firestore
      await firebase.firestore()
        .collection('users')
        .doc(userId)
        .update({
          role: 'business_owner',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      
      // Obtener datos actualizados
      const updatedUser = await getUserData(userId);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Error al convertir usuario:', error);
      return { success: false, error: 'No se pudo convertir la cuenta a propietario de negocio' };
    }
  }
};
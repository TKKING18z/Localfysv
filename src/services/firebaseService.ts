import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';  // Esta importación es crucial
import 'firebase/compat/storage';
import { Business } from '../context/BusinessContext';
import { Promotion, Reservation, ReservationAvailability } from '../types/businessTypes';

// Query options interface
interface QueryOptions {
  limit?: number;
  lastDoc?: firebase.firestore.DocumentSnapshot | null;
  category?: string | null;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  userId?: string | null;
}

// Response interface - Update to allow null in data type
interface FirebaseResponse<T> {
  success: boolean;
  data?: T | null;
  lastDoc?: firebase.firestore.DocumentSnapshot;
  hasMore?: boolean;
  error?: {
    code?: string;
    message: string;
    originalError?: any;
  };
}

// Error handling
const handleFirebaseError = (error: any, context: string): any => {
  console.error(`Error in ${context}:`, error);
  
  // Mapping Firebase error codes to user-friendly messages
  const errorMap: Record<string, string> = {
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'Este correo ya está en uso',
    'auth/invalid-email': 'Correo electrónico inválido',
    'auth/weak-password': 'La contraseña es demasiado débil',
    'auth/network-request-failed': 'Error de conexión a internet',
    'storage/unauthorized': 'No tienes permiso para acceder a este archivo',
    'storage/canceled': 'Operación cancelada',
    'storage/unknown': 'Error desconocido al subir imagen',
  };
  
  return {
    code: error.code,
    message: errorMap[error.code] || 'Ha ocurrido un error inesperado',
    originalError: error
  };
};

// Función de utilidad para limpiar datos antes de enviarlos a Firestore
const cleanDataForFirestore = (data: any): any => {
  // Si el dato es undefined, devuelve null
  if (data === undefined) return null;
  
  // Si el dato es un array, limpia cada elemento
  if (Array.isArray(data)) {
    return data.map(item => cleanDataForFirestore(item));
  }
  
  // Si el dato es un objeto, limpia cada propiedad
  if (data !== null && typeof data === 'object' && !(data instanceof Date) && !(data instanceof firebase.firestore.Timestamp)) {
    const cleanedData: Record<string, any> = {};
    
    // Recorre todas las propiedades del objeto
    Object.keys(data).forEach(key => {
      const value = data[key];
      
      // Si la propiedad no es undefined, límpiala recursivamente
      if (value !== undefined) {
        cleanedData[key] = cleanDataForFirestore(value);
      }
      // Si es undefined, omítela (no la incluyas en cleanedData)
    });
    
    return cleanedData;
  }
  
  // Devuelve el dato sin modificar si no es objeto ni array
  return data;
};

// The main Firebase service
export const firebaseService = {
  // Auth methods
  auth: {
    // Sign in with email and password
    signIn: async (email: string, password: string): Promise<FirebaseResponse<firebase.User>> => {
      try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        return { success: true, data: userCredential.user };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'auth/signIn') };
      }
    },
    
    // Sign up with email and password
    signUp: async (email: string, password: string, userData: any): Promise<FirebaseResponse<firebase.User>> => {
      try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        
        // Create user document
        await firebase.firestore().collection('users').doc(userCredential.user?.uid).set({
          ...userData,
          email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        
        return { success: true, data: userCredential.user };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'auth/signUp') };
      }
    },
    
    // Sign out
    signOut: async (): Promise<FirebaseResponse<null>> => {
      try {
        await firebase.auth().signOut();
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'auth/signOut') };
      }
    },
    
    // Reset password
    resetPassword: async (email: string): Promise<FirebaseResponse<null>> => {
      try {
        await firebase.auth().sendPasswordResetEmail(email);
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'auth/resetPassword') };
      }
    },
    
    // Get current user
    getCurrentUser: (): firebase.User | null => {
      return firebase.auth().currentUser;
    },
    
    // Update user profile
    updateProfile: async (userData: any): Promise<FirebaseResponse<null>> => {
      try {
        const user = firebase.auth().currentUser;
        if (!user) {
          return { success: false, error: { message: 'Usuario no autenticado' } };
        }
        
        await user.updateProfile(userData);
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'auth/updateProfile') };
      }
    }
  },
  
  // Business methods
  businesses: {
    // Get businesses with pagination and filters
    getAll: async (options: QueryOptions = {}): Promise<FirebaseResponse<Business[]>> => {
      try {
        const { 
          limit = 10, 
          lastDoc = null, 
          category = null, 
          sortBy = 'createdAt', 
          sortDirection = 'desc',
          userId = null
        } = options;
        
        let query: firebase.firestore.Query = firebase.firestore().collection('businesses');
        
        // Apply category filter
        if (category) {
          query = query.where('category', '==', category);
        }
        
        // Apply user filter (for favorites or user's businesses)
        if (userId) {
          query = query.where('ownerId', '==', userId);
        }
        
        // Apply sorting
        query = query.orderBy(sortBy, sortDirection);
        
        // Apply pagination
        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }
        
        query = query.limit(limit);
        
        const snapshot = await query.get();
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        
        const businesses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Business[];
        
        return { 
          success: true, 
          data: businesses, 
          lastDoc: lastVisible,
          hasMore: snapshot.docs.length === limit
        };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'businesses/getAll') };
      }
    },
    
    // Get a single business
    getById: async (id: string): Promise<FirebaseResponse<Business>> => {
      try {
        const doc = await firebase.firestore().collection('businesses').doc(id).get();
        
        if (!doc.exists) {
          return { success: false, error: { message: 'Negocio no encontrado' } };
        }
        
        return { success: true, data: { id: doc.id, ...doc.data() } as Business };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'businesses/getById') };
      }
    },
    
    // Create a business
    create: async (businessData: Omit<Business, 'id'>): Promise<FirebaseResponse<{ id: string }>> => {
      try {
        const user = firebase.auth().currentUser;
        if (!user) {
          return { success: false, error: { message: 'Usuario no autenticado' } };
        }
        
        // Limpia los datos antes de agregarlos a Firestore
        const cleanedData = cleanDataForFirestore(businessData);
        
        const businessWithMeta = {
          ...cleanedData, // Usa los datos limpios
          ownerId: user.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        
        console.log('Datos listos para Firestore:', JSON.stringify(businessWithMeta));
        
        const docRef = await firebase.firestore().collection('businesses').add(businessWithMeta);
        
        return { success: true, data: { id: docRef.id } };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'businesses/create') };
      }
    },
    
    // Update a business
    update: async (id: string, data: Partial<Business>): Promise<FirebaseResponse<null>> => {
      try {
        // Limpia los datos antes de actualizarlos en Firestore
        const cleanedData = cleanDataForFirestore(data);
        
        await firebase.firestore().collection('businesses').doc(id).update({
          ...cleanedData, // Usa los datos limpios
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'businesses/update') };
      }
    },
    
    // Delete a business
    delete: async (id: string): Promise<FirebaseResponse<null>> => {
      try {
        await firebase.firestore().collection('businesses').doc(id).delete();
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'businesses/delete') };
      }
    },
    
    // Get businesses by user favorites
    getFavorites: async (userId: string, options: QueryOptions = {}): Promise<FirebaseResponse<Business[]>> => {
      try {
        // First, get user's favorites
        const userDoc = await firebase.firestore().collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
          return { success: false, error: { message: 'Usuario no encontrado' } };
        }
        
        const userData = userDoc.data();
        const favorites = userData?.favorites || [];
        
        if (favorites.length === 0) {
          return { success: true, data: [], hasMore: false };
        }
        
        // Then fetch the businesses
        const businessDocs = await firebase.firestore().collection('businesses')
          .where(firebase.firestore.FieldPath.documentId(), 'in', favorites.slice(0, 10))
          .get();
        
        const businesses = businessDocs.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Business[];
        
        return { success: true, data: businesses, hasMore: favorites.length > 10 };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'businesses/getFavorites') };
      }
    }
  },
  
  // User methods
  users: {
    // Get user data
    getById: async (userId: string): Promise<FirebaseResponse<any>> => {
      try {
        const doc = await firebase.firestore().collection('users').doc(userId).get();
        
        if (!doc.exists) {
          return { success: false, error: { message: 'Usuario no encontrado' } };
        }
        
        return { success: true, data: { id: doc.id, ...doc.data() } };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'users/getById') };
      }
    },
    
    // Update user data
    update: async (userId: string, data: any): Promise<FirebaseResponse<null>> => {
      try {
        await firebase.firestore().collection('users').doc(userId).update({
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'users/update') };
      }
    },
    
    // Toggle favorite business
    toggleFavorite: async (userId: string, businessId: string): Promise<FirebaseResponse<boolean>> => {
      try {
        // Get user document
        const userRef = firebase.firestore().collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
          return { success: false, error: { message: 'Usuario no encontrado' } };
        }
        
        // Check if business is already favorited
        const userData = userDoc.data();
        const favorites = userData?.favorites || [];
        const isFavorite = favorites.includes(businessId);
        
        // Update favorites array
        if (isFavorite) {
          await userRef.update({
            favorites: firebase.firestore.FieldValue.arrayRemove(businessId)
          });
        } else {
          await userRef.update({
            favorites: firebase.firestore.FieldValue.arrayUnion(businessId)
          });
        }
        
        return { success: true, data: !isFavorite };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'users/toggleFavorite') };
      }
    },
    
    // Check if a business is favorited
    isFavorite: async (userId: string, businessId: string): Promise<FirebaseResponse<boolean>> => {
      try {
        const doc = await firebase.firestore().collection('users').doc(userId).get();
        
        if (!doc.exists) {
          return { success: false, error: { message: 'Usuario no encontrado' } };
        }
        
        const userData = doc.data();
        const favorites = userData?.favorites || [];
        
        return { success: true, data: favorites.includes(businessId) };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'users/isFavorite') };
      }
    }
  },
  
  // Storage methods
  storage: {
    // Upload an image
    uploadImage: async (uri: string, path: string): Promise<FirebaseResponse<string>> => {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const ref = firebase.storage().ref().child(path);
        
        await ref.put(blob);
        const downloadUrl = await ref.getDownloadURL();
        
        return { success: true, data: downloadUrl };
      } catch (error) {
        console.error('Error uploading image:', error);
        return { success: false, error: { message: error instanceof Error ? error.message : 'Error desconocido' } };
      }
    },
    
    // Get download URL
    getDownloadURL: async (path: string): Promise<FirebaseResponse<string>> => {
      try {
        const storageRef = firebase.storage().ref();
        const imageRef = storageRef.child(path);
        
        const downloadURL = await imageRef.getDownloadURL();
        
        return { success: true, data: downloadURL };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'storage/getDownloadURL') };
      }
    },
    
    // Delete an image
    deleteImage: async (path: string): Promise<FirebaseResponse<null>> => {
      try {
        const storageRef = firebase.storage().ref();
        const imageRef = storageRef.child(path);
        
        await imageRef.delete();
        
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'storage/deleteImage') };
      }
    }
  },

  // Nuevo servicio para promociones
  promotions: {
    getByBusinessId: async (businessId: string): Promise<FirebaseResponse<Promotion[]>> => {
      try {
        const snapshot = await firebase.firestore()
          .collection('promotions')
          .where('businessId', '==', businessId)
          .where('isActive', '==', true)
          .orderBy('startDate', 'desc')
          .get();
        
        const promotions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Promotion[];
        
        return { success: true, data: promotions };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'promotions/getByBusinessId') };
      }
    },

    getById: async (id: string): Promise<FirebaseResponse<Promotion>> => {
      try {
        const doc = await firebase.firestore().collection('promotions').doc(id).get();
        
        if (!doc.exists) {
          return { success: false, error: { message: 'Promoción no encontrada' } };
        }
        
        return { success: true, data: { id: doc.id, ...doc.data() } as Promotion };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'promotions/getById') };
      }
    },

    create: async (data: Omit<Promotion, 'id'>): Promise<FirebaseResponse<{id: string}>> => {
      try {
        const cleanedData = cleanDataForFirestore(data);
        const docRef = await firebase.firestore().collection('promotions').add({
          ...cleanedData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          isActive: true
        });
        
        return { success: true, data: { id: docRef.id } };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'promotions/create') };
      }
    },
    
    update: async (id: string, data: Partial<Promotion>): Promise<FirebaseResponse<null>> => {
      try {
        const cleanedData = cleanDataForFirestore(data);
        await firebase.firestore().collection('promotions').doc(id).update({
          ...cleanedData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'promotions/update') };
      }
    },
    
    delete: async (id: string): Promise<FirebaseResponse<null>> => {
      try {
        await firebase.firestore().collection('promotions').doc(id).delete();
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'promotions/delete') };
      }
    },
    
    deactivate: async (id: string): Promise<FirebaseResponse<null>> => {
      try {
        await firebase.firestore().collection('promotions').doc(id).update({
          isActive: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'promotions/deactivate') };
      }
    }
  },

  // Nuevo servicio para reservas
  reservations: {
    getByBusinessId: async (businessId: string, status?: string): Promise<FirebaseResponse<Reservation[]>> => {
      try {
        let query: firebase.firestore.Query = firebase.firestore()
          .collection('reservations')
          .where('businessId', '==', businessId)
          .orderBy('date', 'desc');
        
        if (status) {
          query = query.where('status', '==', status);
        }
        
        const snapshot = await query.get();
        
        const reservations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Reservation[];
        
        return { success: true, data: reservations };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/getByBusinessId') };
      }
    },

    getByUserId: async (userId: string): Promise<FirebaseResponse<Reservation[]>> => {
      try {
        const snapshot = await firebase.firestore()
          .collection('reservations')
          .where('userId', '==', userId)
          .orderBy('date', 'desc')
          .get();
        
        const reservations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Reservation[];
        
        return { success: true, data: reservations };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/getByUserId') };
      }
    },

    getByUserAndBusinessId: async (userId: string, businessId: string): Promise<FirebaseResponse<Reservation[]>> => {
      try {
        const snapshot = await firebase.firestore()
          .collection('reservations')
          .where('userId', '==', userId)
          .where('businessId', '==', businessId)
          .orderBy('date', 'desc')
          .get();
        
        const reservations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Reservation[];
        
        return { success: true, data: reservations };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/getByUserAndBusinessId') };
      }
    },

    getById: async (id: string): Promise<FirebaseResponse<Reservation>> => {
      try {
        const doc = await firebase.firestore().collection('reservations').doc(id).get();
        
        if (!doc.exists) {
          return { success: false, error: { message: 'Reserva no encontrada' } };
        }
        
        return { success: true, data: { id: doc.id, ...doc.data() } as Reservation };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/getById') };
      }
    },

    create: async (data: Omit<Reservation, 'id'>): Promise<FirebaseResponse<{id: string}>> => {
      try {
        const cleanedData = cleanDataForFirestore(data);
        const docRef = await firebase.firestore().collection('reservations').add({
          ...cleanedData,
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, data: { id: docRef.id } };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/create') };
      }
    },
    
    update: async (id: string, data: Partial<Reservation>): Promise<FirebaseResponse<null>> => {
      try {
        const cleanedData = cleanDataForFirestore(data);
        await firebase.firestore().collection('reservations').doc(id).update({
          ...cleanedData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/update') };
      }
    },
    
    updateStatus: async (id: string, status: 'pending' | 'confirmed' | 'canceled' | 'completed'): Promise<FirebaseResponse<null>> => {
      try {
        await firebase.firestore().collection('reservations').doc(id).update({
          status,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/updateStatus') };
      }
    },
    
    delete: async (id: string): Promise<FirebaseResponse<null>> => {
      try {
        await firebase.firestore().collection('reservations').doc(id).delete();
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/delete') };
      }
    },
    
    getAvailability: async (businessId: string): Promise<FirebaseResponse<ReservationAvailability>> => {
      try {
        const doc = await firebase.firestore()
          .collection('reservation_availability')
          .doc(businessId)
          .get();
          
        if (!doc.exists) {
          return { 
            success: false, 
            error: { message: 'No hay información de disponibilidad para este negocio' } 
          };
        }
        
        // Convertir los datos correcti
        const data = doc.data();
        
        // Verificar que los datos contienen las propiedades necesarias
        if (!data || !data.availableDays || !data.timeSlots || !data.maxPartySizes) {
          return {
            success: false,
            error: { message: 'Los datos de disponibilidad están incompletos o tienen un formato inválido' }
          };
        }
        
        // Crear el objeto con la estructura correcta
        const availabilityData: ReservationAvailability = {
          businessId,
          availableDays: data.availableDays,
          timeSlots: data.timeSlots,
          maxPartySizes: data.maxPartySizes,
          // Propiedades opcionales
          unavailableDates: data.unavailableDates,
          specialSchedules: data.specialSchedules,
        };
        
        return { success: true, data: availabilityData };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/getAvailability') };
      }
    },
    
    saveAvailability: async (data: ReservationAvailability): Promise<FirebaseResponse<null>> => {
      try {
        const cleanedData = cleanDataForFirestore(data);
        await firebase.firestore()
          .collection('reservation_availability')
          .doc(data.businessId)
          .set(cleanedData, { merge: true });
          
        return { success: true };
      } catch (error) {
        return { success: false, error: handleFirebaseError(error, 'reservations/saveAvailability') };
      }
    }
  }
};
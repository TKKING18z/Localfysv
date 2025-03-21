import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC2S36sPSd2XEJmxxkqJ-lQUJc7ySL5Uvw",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "testlocalfysv25.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "testlocalfysv25",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "testlocalfysv25.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "281205862532",
    appId: process.env.FIREBASE_APP_ID || "1:281205862532:web:aa25ca39606dda5db6d2d1",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-Z7V3LK64ZL"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app();
}

// Configurar persistencia para autenticación
if (Platform.OS === 'web') {
  // Para web, necesitamos establecer explícitamente la persistencia
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
} else {
  // Para móviles, la persistencia local es el valor predeterminado
  // Pero podemos verificar que la sesión se mantenga correctamente
  const currentUser = firebase.auth().currentUser;
  console.log('Current user on initialization:', currentUser?.uid);
}

export const auth = firebase.auth();
export const firestore = firebase.firestore();
export const storage = firebase.storage();

export default firebase;
// firebase.config.js - Firebase v10 configuration
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC2S36sPSd2XEJmxxkqJ-lQUJc7ySL5Uvw",
  authDomain: "testlocalfysv25.firebaseapp.com",
  projectId: "testlocalfysv25",
  storageBucket: "testlocalfysv25.firebasestorage.app",
  messagingSenderId: "281205862532",
  appId: "1:281205862532:web:aa25ca39606dda5db6d2d1",
  measurementId: "G-Z7V3LK64ZL"
};

// Inicializar Firebase si no está ya inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app();
}

export default firebase;
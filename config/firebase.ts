import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

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

export const auth = firebase.auth();
export const firestore = firebase.firestore();
export const storage = firebase.storage();

export default firebase;

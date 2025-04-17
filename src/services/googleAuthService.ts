/**
 * googleAuthService.ts
 * Service to handle Google authentication with Expo
 */
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Platform } from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure WebBrowser for redirect
WebBrowser.maybeCompleteAuthSession();

// Your web client ID from Google Cloud Console
const WEB_CLIENT_ID = '281205862532-imt64nhl458nbm9jnf9gff2cb939ngr3.apps.googleusercontent.com';
// Your iOS client ID from Google Cloud Console
const IOS_CLIENT_ID = '281205862532-3o2ot4ulh7nbu3vu0q80qd4gbt6q3fi3.apps.googleusercontent.com';
// Your Android client ID from Google Cloud Console
const ANDROID_CLIENT_ID = '281205862532-r81b17icaar84ja153rhnegoslpbph53.apps.googleusercontent.com';

// Storage keys
const GOOGLE_AUTH_STORAGE_KEY = 'google_auth_data';

// Hook para la autenticación de Google
export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Platform.OS === 'ios' 
      ? IOS_CLIENT_ID 
      : (Platform.OS === 'android' ? ANDROID_CLIENT_ID : WEB_CLIENT_ID),
    androidClientId: ANDROID_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    selectAccount: true,
  });

  return { request, response, promptAsync };
};

// Servicio de autenticación de Google
export const googleAuthService = {
  // Manejar el inicio de sesión con Google
  handleSignInWithGoogle: async (response: any) => {
    try {
      if (response?.type === 'success') {
        const { id_token } = response.params;
        
        // Crear credencial para Firebase
        const credential = firebase.auth.GoogleAuthProvider.credential(id_token);
        
        // Iniciar sesión en Firebase con la credencial
        const userCredential = await firebase.auth().signInWithCredential(credential);
        
        if (userCredential.user) {
          // Guardar datos de autenticación de Google
          const googleAuthData = {
            id_token,
            user: {
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              displayName: userCredential.user.displayName,
              photoURL: userCredential.user.photoURL
            },
            timestamp: new Date().toISOString()
          };
          
          await AsyncStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(googleAuthData));
          
          // Verificar si el usuario ya existe en Firestore
          const userDoc = await firebase.firestore()
            .collection('users')
            .doc(userCredential.user.uid)
            .get();
          
          if (!userDoc.exists) {
            // Si es un nuevo usuario, crear documento en Firestore
            await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
              email: userCredential.user.email,
              displayName: userCredential.user.displayName,
              photoURL: userCredential.user.photoURL,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              authProvider: 'google'
            });
          }
          
          return { success: true, user: userCredential.user };
        }
      } else if (response?.type === 'cancel') {
        return { success: false, error: "Inicio de sesión con Google cancelado" };
      }
      
      return { success: false, error: "Error en la autenticación con Google" };
    } catch (error: any) {
      console.error('Error en la autenticación con Google:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Restaurar sesión de Google
  restoreGoogleSession: async () => {
    try {
      const googleAuthData = await AsyncStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
      if (googleAuthData) {
        const parsedData = JSON.parse(googleAuthData);
        // Verificar si los datos son recientes (menos de 7 días)
        const savedTimestamp = new Date(parsedData.timestamp).getTime();
        const now = new Date().getTime();
        const daysDiff = (now - savedTimestamp) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 7) {
          return { success: true, data: parsedData };
        } else {
          // Si los datos son antiguos, eliminarlos
          await AsyncStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
        }
      }
      return { success: false };
    } catch (error) {
      console.error('Error al restaurar sesión de Google:', error);
      return { success: false, error };
    }
  },
  
  // Limpiar datos de sesión de Google
  clearGoogleSession: async () => {
    try {
      await AsyncStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
      return { success: true };
    } catch (error) {
      console.error('Error al limpiar sesión de Google:', error);
      return { success: false, error };
    }
  }
};
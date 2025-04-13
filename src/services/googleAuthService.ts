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

// Configure WebBrowser for redirect
WebBrowser.maybeCompleteAuthSession();

// Your web client ID from Google Cloud Console
const WEB_CLIENT_ID = '281205862532-imt64nhl458nbm9jnf9gff2cb939ngr3.apps.googleusercontent.com';
// Your iOS client ID from Google Cloud Console (if you tienes uno)
const IOS_CLIENT_ID = '281205862532-3o2ot4ulh7nbu3vu0q80qd4gbt6q3fi3.apps.googleusercontent.com';
// Your Android client ID from Google Cloud Console (if you tienes uno)
const ANDROID_CLIENT_ID = '281205862532-r81b17icaar84ja153rhnegoslpbph53.apps.googleusercontent.com';

// No podemos usar hooks aquí directamente, pero podemos crear una función para el componente
// que lo usará
export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Platform.OS === 'ios' 
      ? IOS_CLIENT_ID 
      : (Platform.OS === 'android' ? ANDROID_CLIENT_ID : WEB_CLIENT_ID),
    androidClientId: ANDROID_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    // En desarrollo, usar el proxy
    selectAccount: true,
  });

  return { request, response, promptAsync };
};

// Tipo para la respuesta de Google
interface GoogleAuthResponse {
  type: string;
  params: {
    id_token?: string;
    [key: string]: any;
  };
}

/**
 * Service to handle Google authentication
 */
export const googleAuthService = {
  /**
   * Esta función debe ser llamada desde un componente React
   * donde se use el hook useGoogleAuth
   */
  handleSignInWithGoogle: async (response: GoogleAuthResponse | null) => {
    try {
      console.log("Processing Google sign in response");
      
      if (response?.type === 'success') {
        const { id_token } = response.params;
        
        if (!id_token) {
          return { success: false, error: "No se obtuvo token de acceso de Google" };
        }
        
        // Sign in to Firebase with Google credential
        const credential = firebase.auth.GoogleAuthProvider.credential(id_token);
        const userCredential = await firebase.auth().signInWithCredential(credential);
        
        if (!userCredential.user) {
          return { success: false, error: "No se pudo autenticar con Firebase" };
        }
        
        // Check if user exists in Firestore
        const userDoc = await firebase.firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .get();
        
        if (!userDoc.exists) {
          // Create new user in Firestore
          const userData = {
            uid: userCredential.user.uid,
            displayName: userCredential.user.displayName,
            email: userCredential.user.email,
            role: 'customer',
            photoURL: userCredential.user.photoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          
          await firebase.firestore()
            .collection('users')
            .doc(userCredential.user.uid)
            .set(userData);
          
          console.log("Created new user in Firestore");
        } else {
          console.log("User already exists in Firestore");
        }
        
        return { success: true };
      } else if (response?.type === 'cancel') {
        return { success: false, error: "Inicio de sesión con Google cancelado" };
      } else {
        return { success: false, error: `Error al iniciar sesión con Google: ${response?.type || 'unknown'}` };
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Error desconocido al iniciar sesión con Google" 
      };
    }
  }
};
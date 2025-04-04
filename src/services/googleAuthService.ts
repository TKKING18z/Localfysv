/**
 * googleAuthService.ts
 * Service to handle Google authentication with Expo
 */
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { Platform } from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Configure WebBrowser for redirect
WebBrowser.maybeCompleteAuthSession();

// Your web client ID from Google Cloud Console
const WEB_CLIENT_ID = '281205862532-9n4vrvl1o6qnmjk14jjhrnlnh0cjlcgk.apps.googleusercontent.com';
// Your iOS client ID from Google Cloud Console (if you tienes uno)
const IOS_CLIENT_ID = '';
// Your Android client ID from Google Cloud Console (if you tienes uno)
const ANDROID_CLIENT_ID = '';

/**
 * Service to handle Google authentication
 */
export const googleAuthService = {
  /**
   * Sign in with Google
   * @returns Promise with auth response
   */
  signInWithGoogle: async () => {
    try {
      console.log("Starting Google sign in process");
      
      // Initialize the Google auth request
      const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: Platform.OS === 'ios' ? IOS_CLIENT_ID : (Platform.OS === 'android' ? ANDROID_CLIENT_ID : WEB_CLIENT_ID),
        webClientId: WEB_CLIENT_ID,
      });

      // Check if the request is ready
      if (!request) {
        console.log("Auth request not ready");
        return { success: false, error: "Error de configuración de autenticación de Google" };
      }

      // Prompt the user to authenticate
      console.log("Prompting user for Google auth");
      const result = await promptAsync();
      
      if (result.type === 'success') {
        console.log("Google authentication successful, getting user info");
        
        // Exchange auth code for tokens
        const { authentication } = result;
        
        if (!authentication) {
          return { success: false, error: "No se pudo obtener la autenticación de Google" };
        }
        
        const { accessToken, idToken } = authentication;
        
        if (!accessToken && !idToken) {
          return { success: false, error: "No se obtuvo token de acceso de Google" };
        }
        
        // Sign in to Firebase with Google credential
        const credential = firebase.auth.GoogleAuthProvider.credential(idToken, accessToken);
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
      } else if (result.type === 'cancel') {
        return { success: false, error: "Inicio de sesión con Google cancelado" };
      } else {
        return { success: false, error: `Error al iniciar sesión con Google: ${result.type}` };
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
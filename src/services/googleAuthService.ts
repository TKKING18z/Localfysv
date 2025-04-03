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
import { UserData } from './authService';

// Configure WebBrowser for redirect
WebBrowser.maybeCompleteAuthSession();

// Your web client ID from Google Cloud Console
const WEB_CLIENT_ID = '281205862532-9n4vrvl1o6qnmjk14jjhrnlnh0cjlcgk.apps.googleusercontent.com';
// Your iOS client ID from Google Cloud Console (if you have one)
const IOS_CLIENT_ID = '';
// Your Android client ID from Google Cloud Console (if you have one)
const ANDROID_CLIENT_ID = '';

/**
 * Service to handle Google authentication
 */
export const googleAuthService = {
  /**
   * Initialize the Google auth hook
   * @returns Auth request, response, and promptAsync function
   */
  useGoogleAuth: () => {
    return Google.useAuthRequest({
      clientId: WEB_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID,
      androidClientId: ANDROID_CLIENT_ID,
      webClientId: WEB_CLIENT_ID,
    });
  },

  /**
   * Sign in with Google and get Firebase credentials
   * @param accessToken Google access token
   * @returns Promise with auth response
   */
  signInWithGoogle: async (accessToken: string): Promise<{ success: boolean; user?: UserData; error?: string }> => {
    try {
      // Create a Google credential with the token
      const googleCredential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
      
      // Sign in to Firebase with the Google credential
      const userCredential = await firebase.auth().signInWithCredential(googleCredential);
      
      if (!userCredential.user) {
        return { success: false, error: 'No se pudo autenticar el usuario con Google' };
      }
      
      // Check if user document exists in Firestore
      const userDoc = await firebase.firestore()
        .collection('users')
        .doc(userCredential.user.uid)
        .get();
      
      if (!userDoc.exists) {
        // Create a new user document
        const newUserData: UserData = {
          uid: userCredential.user.uid,
          displayName: userCredential.user.displayName,
          email: userCredential.user.email,
          role: 'customer',
          photoURL: userCredential.user.photoURL,
          createdAt: new Date()
        };
        
        await firebase.firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .set(newUserData);
          
        return { success: true, user: newUserData };
      }
      
      // User exists, get their data
      const userData = userDoc.data() as UserData;
      return { success: true, user: userData };
    } catch (error: any) {
      console.error('Error durante la autenticación con Google:', error);
      let errorMessage = 'Error durante la autenticación con Google';
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'Ya existe una cuenta con este correo electrónico pero con otro método de inicio de sesión';
      }
      
      return { success: false, error: errorMessage };
    }
  },
  
  /**
   * Get user info from Google
   * @param accessToken Google access token
   * @returns User info from Google
   */
  getUserInfo: async (accessToken: string) => {
    try {
      const response = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      return await response.json();
    } catch (error) {
      console.error('Error getting user info from Google:', error);
      throw error;
    }
  }
};
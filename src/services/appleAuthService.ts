/**
 * appleAuthService.ts
 * Service to handle Apple authentication with Expo
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for Apple auth data
const APPLE_AUTH_STORAGE_KEY = 'apple_auth_data';

export const appleAuthService = {
  // Check if Apple Authentication is available on the device
  isAvailable: async (): Promise<boolean> => {
    return await AppleAuthentication.isAvailableAsync();
  },
  
  // Sign in with Apple
  signInWithApple: async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      // After Apple Authentication
      if (credential) {
        // Convert to Firebase credential
        const { identityToken } = credential;
        if (!identityToken) {
          throw new Error('No identity token provided by Apple');
        }

        // Create Firebase credential
        const provider = new firebase.auth.OAuthProvider('apple.com');
        const firebaseCredential = provider.credential({
          idToken: identityToken,
          rawNonce: credential.state || undefined, // Handle null case
        });

        // Sign in to Firebase with credential
        const userCredential = await firebase.auth().signInWithCredential(firebaseCredential);
        
        if (userCredential.user) {
          // Handle user name if this is the first sign-in
          let displayName = userCredential.user.displayName;
          
          // Apple only sends the name on the first login, so we need to save it
          if (!displayName && credential.fullName) {
            displayName = `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim();
            
            // If we got a name from Apple, update the Firebase user profile
            if (displayName) {
              await userCredential.user.updateProfile({
                displayName: displayName
              });
            }
          }
          
          // Check if user exists in Firestore
          const userDoc = await firebase.firestore()
            .collection('users')
            .doc(userCredential.user.uid)
            .get();
            
          const emailToSave = userCredential.user.email || credential.email || '';
          
          if (!userDoc.exists) {
            // If new user, create document in Firestore
            await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
              email: emailToSave,
              displayName: displayName || '',
              photoURL: userCredential.user.photoURL || '',
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              authProvider: 'apple'
            });
          } else if (displayName && !userDoc.data()?.displayName) {
            // If existing user has no display name but we got one now, update it
            await firebase.firestore().collection('users').doc(userCredential.user.uid).update({
              displayName: displayName
            });
          }
          
          // Save Apple auth data for later use (especially the user's name)
          const appleAuthData = {
            user: {
              uid: userCredential.user.uid,
              email: emailToSave,
              displayName: displayName || '',
              photoURL: userCredential.user.photoURL || ''
            },
            credential: {
              user: credential.user,
              fullName: credential.fullName,
              email: credential.email,
              state: credential.state
            },
            timestamp: new Date().toISOString()
          };
          
          await AsyncStorage.setItem(APPLE_AUTH_STORAGE_KEY, JSON.stringify(appleAuthData));
          
          return { success: true, user: userCredential.user };
        }
      }
      
      return { success: false, error: "Apple authentication failed" };
    } catch (error: any) {
      console.error('Error in Apple authentication:', error);
      
      // Don't show error for user cancellation
      if (error.code === 'ERR_CANCELED') {
        return { success: false, error: "Sign in with Apple was canceled" };
      }
      
      return { success: false, error: error.message };
    }
  },
  
  // Get saved Apple auth data
  getSavedAppleAuthData: async () => {
    try {
      const appleAuthData = await AsyncStorage.getItem(APPLE_AUTH_STORAGE_KEY);
      if (appleAuthData) {
        return { success: true, data: JSON.parse(appleAuthData) };
      }
      return { success: false };
    } catch (error) {
      console.error('Error getting saved Apple auth data:', error);
      return { success: false, error };
    }
  },
  
  // Clear Apple auth data
  clearAppleAuthData: async () => {
    try {
      await AsyncStorage.removeItem(APPLE_AUTH_STORAGE_KEY);
      return { success: true };
    } catch (error) {
      console.error('Error clearing Apple auth data:', error);
      return { success: false, error };
    }
  }
}; 
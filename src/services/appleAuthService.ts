/**
 * appleAuthService.ts
 * Service to handle Apple authentication with Expo
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// Storage key for Apple auth data
const APPLE_AUTH_STORAGE_KEY = 'apple_auth_data';

// Generate a random string for nonce
const generateNonce = (length: number = 32): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
};

export const appleAuthService = {
  // Check if Apple Authentication is available on the device
  isAvailable: async (): Promise<boolean> => {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      console.log('[Apple Auth] Disponibilidad de autenticación Apple:', isAvailable);
      return isAvailable;
    } catch (error) {
      console.error('[Apple Auth] Error al verificar disponibilidad:', error);
      return false;
    }
  },
  
  // Sign in with Apple
  signInWithApple: async () => {
    try {
      console.log('[Apple Auth] Iniciando proceso de autenticación con Apple');
      
      // Verificar si la autenticación con Apple está disponible
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        console.error('[Apple Auth] La autenticación con Apple no está disponible en este dispositivo');
        return { success: false, error: "La autenticación con Apple no está disponible en este dispositivo" };
      }
      
      // Generate a random nonce - PASO 1
      const rawNonce = generateNonce();
      console.log('[Apple Auth] Nonce generado correctamente');
      
      // Hash the nonce with SHA256 - PASO 2
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      console.log('[Apple Auth] Nonce hasheado correctamente');
      
      // Request authentication from Apple - PASO 3
      console.log('[Apple Auth] Solicitando autenticación a Apple...');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      
      console.log('[Apple Auth] Autenticación con Apple exitosa, datos recibidos');
      
      // After Apple Authentication - PASO 4
      if (!credential) {
        console.error('[Apple Auth] No se recibieron credenciales de Apple');
        return { success: false, error: "No se recibieron credenciales de Apple" };
      }
      
      // Verificar identity token - PASO 5
      const { identityToken } = credential;
      if (!identityToken) {
        console.error('[Apple Auth] Apple no proporcionó un identity token');
        return { success: false, error: "No se recibió identity token de Apple" };
      }
      
      console.log('[Apple Auth] Identity token recibido correctamente');

      try {
        // Create Firebase credential properly according to Firebase docs - PASO 6
        console.log('[Apple Auth] Creando credencial para Firebase...');
        const provider = new firebase.auth.OAuthProvider('apple.com');
        const appleCredential = provider.credential({
          idToken: identityToken,
          rawNonce: rawNonce // Es importante usar el nonce original, no el hasheado
        });
        
        console.log('[Apple Auth] Credencial de Firebase creada correctamente');

        // Sign in to Firebase with credential - PASO 7
        console.log('[Apple Auth] Iniciando sesión en Firebase...');
        const userCredential = await firebase.auth().signInWithCredential(appleCredential);
        console.log('[Apple Auth] Sesión iniciada en Firebase correctamente');
        
        if (!userCredential.user) {
          console.error('[Apple Auth] Firebase no devolvió un usuario después de la autenticación');
          return { success: false, error: "Error al obtener el usuario de Firebase" };
        }
        
        // Handle user name if this is the first sign-in - PASO 8
        let displayName = userCredential.user.displayName;
        console.log('[Apple Auth] Nombre de usuario actual:', displayName || 'No disponible');
        
        // Apple only sends the name on the first login, so we need to save it
        if (!displayName && credential.fullName) {
          displayName = `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim();
          console.log('[Apple Auth] Nombre recibido de Apple:', displayName || 'No disponible');
          
          // If we got a name from Apple, update the Firebase user profile
          if (displayName) {
            console.log('[Apple Auth] Actualizando perfil en Firebase con el nombre...');
            try {
              await userCredential.user.updateProfile({
                displayName: displayName
              });
              console.log('[Apple Auth] Perfil de Firebase actualizado correctamente');
            } catch (updateError) {
              console.error('[Apple Auth] Error al actualizar perfil en Firebase:', updateError);
              // Continuamos a pesar del error, ya que esto no es crítico
            }
          }
        }
        
        // Inicializar variable para indicar si es usuario nuevo
        let isNewUser = false;

        // Save to Firestore - PASO 9
        try {
          console.log('[Apple Auth] Verificando si el usuario existe en Firestore...');
          const userDoc = await firebase.firestore()
            .collection('users')
            .doc(userCredential.user.uid)
            .get();
            
          const emailToSave = userCredential.user.email || credential.email || '';
          
          // Actualizar si es un usuario nuevo
          isNewUser = !userDoc.exists;
          
          if (!userDoc.exists) {
            console.log('[Apple Auth] Usuario nuevo, creando documento en Firestore...');
            // If new user, create document in Firestore
            await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
              email: emailToSave,
              displayName: displayName || '',
              photoURL: userCredential.user.photoURL || '',
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              authProvider: 'apple'
            });
            console.log('[Apple Auth] Documento de usuario creado en Firestore');
          } else if (displayName && !userDoc.data()?.displayName) {
            console.log('[Apple Auth] Actualizando nombre en documento de Firestore...');
            // If existing user has no display name but we got one now, update it
            await firebase.firestore().collection('users').doc(userCredential.user.uid).update({
              displayName: displayName
            });
            console.log('[Apple Auth] Nombre actualizado en Firestore');
          } else {
            console.log('[Apple Auth] Usuario existente en Firestore, no se requieren cambios');
          }
        } catch (firestoreError) {
          console.error('[Apple Auth] Error al interactuar con Firestore:', firestoreError);
          // No retornamos error aquí, seguimos con el proceso de autenticación
          // ya que el usuario ya está autenticado en Firebase
        }
        
        // Save Apple auth data for later use - PASO 10
        try {
          console.log('[Apple Auth] Guardando datos de autenticación en AsyncStorage...');
          const appleAuthData = {
            user: {
              uid: userCredential.user.uid,
              email: userCredential.user.email || credential.email || '',
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
          console.log('[Apple Auth] Datos guardados en AsyncStorage correctamente');
        } catch (storageError) {
          console.error('[Apple Auth] Error al guardar datos en AsyncStorage:', storageError);
          // No retornamos error aquí, es solo almacenamiento local
        }
        
        console.log('[Apple Auth] Proceso completo de autenticación exitoso');
        return { 
          success: true, 
          user: userCredential.user,
          isNewUser: isNewUser
        };
      } catch (firebaseError: any) {
        console.error('[Apple Auth] Error en la autenticación con Firebase:', firebaseError);
        return { 
          success: false, 
          error: `Error de Firebase: ${firebaseError.message || 'Desconocido'}`,
          code: firebaseError.code
        };
      }
    } catch (error: any) {
      console.error('[Apple Auth] Error en el proceso de autenticación con Apple:', error);
      
      // Manejar cancelación explícitamente
      if (error.code === 'ERR_CANCELED') {
        return { success: false, error: "El usuario canceló la autenticación con Apple", code: error.code };
      }
      
      // Manejar otros errores conocidos de Apple
      if (error.code === 'ERR_APPLE_AUTHENTICATION_REQUEST_FAILED') {
        return { 
          success: false, 
          error: "La solicitud de autenticación con Apple falló", 
          details: error.message || '',
          code: error.code
        };
      }
      
      // Cualquier otro error
      return { 
        success: false, 
        error: error.message || "Error desconocido en la autenticación con Apple",
        code: error.code || 'UNKNOWN_ERROR'
      };
    }
  },
  
  // Get saved Apple auth data
  getSavedAppleAuthData: async () => {
    try {
      console.log('[Apple Auth] Obteniendo datos guardados de autenticación...');
      const appleAuthData = await AsyncStorage.getItem(APPLE_AUTH_STORAGE_KEY);
      if (appleAuthData) {
        console.log('[Apple Auth] Datos recuperados correctamente');
        return { success: true, data: JSON.parse(appleAuthData) };
      }
      console.log('[Apple Auth] No se encontraron datos guardados');
      return { success: false, error: "No hay datos de autenticación guardados" };
    } catch (error) {
      console.error('[Apple Auth] Error al obtener datos guardados:', error);
      return { success: false, error: "Error al recuperar datos guardados de autenticación" };
    }
  },
  
  // Clear Apple auth data
  clearAppleAuthData: async () => {
    try {
      console.log('[Apple Auth] Eliminando datos guardados de autenticación...');
      await AsyncStorage.removeItem(APPLE_AUTH_STORAGE_KEY);
      console.log('[Apple Auth] Datos eliminados correctamente');
      return { success: true };
    } catch (error) {
      console.error('[Apple Auth] Error al eliminar datos guardados:', error);
      return { success: false, error: "Error al eliminar datos guardados de autenticación" };
    }
  }
}; 
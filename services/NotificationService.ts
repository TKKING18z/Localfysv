import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Objeto para almacenar globalmente los listeners activos
const activeListeners = {
  received: null as Notifications.Subscription | null,
  response: null as Notifications.Subscription | null,
  // Add counter to track how many components are using the listeners
  counter: 0
};

// Tipo de respuesta estándar para todos los servicios
export interface NotificationResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Configurar el comportamiento de notificaciones
export const configureNotifications = async () => {
  // Configurar cómo deberían aparecer las notificaciones cuando la app está en primer plano
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,      // Mostrar alerta incluso si app está en primer plano
      shouldPlaySound: true,      // Reproducir sonido de notificación
      shouldSetBadge: true,       // Actualizar el contador de badge en el ícono
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });

  // Retornar un resultado estándar
  return {
    success: true
  };
};

// Solicitar permisos de notificaciones
export const requestNotificationPermissions = async (): Promise<NotificationResult<{ granted: boolean }>> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Solo pedir permiso si no lo tiene ya
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Si no es un simulador, necesitamos registrar para notificaciones push
    if (finalStatus !== 'granted') {
      return {
        success: false,
        error: {
          code: 'notifications/permission-denied',
          message: 'Los permisos de notificación no fueron otorgados'
        }
      };
    }

    return {
      success: true,
      data: {
        granted: finalStatus === 'granted'
      }
    };
  } catch (error) {
    console.error('[NotificationService] Error requesting permissions:', error);
    return {
      success: false,
      error: {
        code: 'notifications/permission-error',
        message: 'Error al solicitar permisos de notificación'
      }
    };
  }
};

// Registrar el dispositivo para notificaciones push
export const registerForPushNotifications = async (): Promise<NotificationResult<{ token: string | null }>> => {
  try {
    // Verificar que la plataforma es compatible con push
    const isWeb = !['ios', 'android'].includes(Platform.OS);
    if (isWeb) {
      console.log('[NotificationService] Push notifications not supported on this platform:', Platform.OS);
      return {
        success: false,
        error: {
          code: 'notifications/platform-not-supported',
          message: 'Las notificaciones push no están soportadas en esta plataforma'
        }
      };
    }

    // Solicitar permisos primero
    const permissionResult = await requestNotificationPermissions();
    if (!permissionResult.success) {
      return {
        success: false,
        error: permissionResult.error
      };
    }
    
    // Verificar que se otorgaron los permisos
    if (!permissionResult.data?.granted) {
      return {
        success: false,
        error: {
          code: 'notifications/permission-denied',
          message: 'Los permisos de notificación no fueron otorgados'
        }
      };
    }

    // Enfoque más robusto para obtener el token de Expo para notificaciones push
    let tokenData;
    try {
      // En Expo SDK 52, getExpoPushTokenAsync requiere un experienceId o projectId
      // Intenta obtener un projectId desde app.config o Constants
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ||
                      Constants.easConfig?.projectId ||
                      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'; // Fallback ID en desarrollo
      
      console.log('[NotificationService] Using project ID:', projectId);
      
      tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId
      });
      
      console.log('[NotificationService] Push token obtained:', tokenData.data);
    } catch (error) {
      console.warn('[NotificationService] Error getting push token, using fallback:', error);
      // Si falla, usamos un token simulado en desarrollo
      if (__DEV__) {
        tokenData = { data: 'ExponentPushToken[development]' };
        console.log('[NotificationService] Using development token instead');
      } else {
        throw error; // En producción, permitimos que el error se propague
      }
    }

    return {
      success: true,
      data: {
        token: tokenData.data
      }
    };
  } catch (error) {
    console.error('[NotificationService] Error registering for push:', error);
    return {
      success: false,
      error: {
        code: 'notifications/registration-error',
        message: 'Error al registrar el dispositivo para notificaciones'
      }
    };
  }
};

// Guardar token en Firestore con manejo de errores más robusto
export const saveTokenToFirestore = async (userId: string, token: string): Promise<NotificationResult<boolean>> => {
  try {
    if (!userId || !token) {
      return {
        success: false,
        error: {
          code: 'notifications/invalid-params',
          message: 'ID de usuario o token inválidos'
        }
      };
    }

    // Primero obtenemos el timestamp actual
    const now = new Date();
    
    try {
      // Verificar si el documento del usuario existe
      const userRef = firebase.firestore().collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.log('[NotificationService] User document does not exist, creating new entry');
        // Si no existe, creamos el documento con los datos iniciales
        try {
          await userRef.set({
            notificationToken: token,
            devices: [{
              token,
              platform: Platform.OS,
              updatedAt: now
            }],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (innerError) {
          console.error('[NotificationService] Error creating user document:', innerError);
          // En caso de error, no bloqueamos la experiencia del usuario
          // Retornamos éxito parcial
          return { success: true, data: true };
        }
      } else {
        // Si ya existe, actualizamos los datos
        try {
          // Obtenemos los dispositivos actuales para evitar duplicados
          const userData = userDoc.data() || {};
          const devices = userData.devices || [];
          
          // Verificamos si el token ya existe
          const tokenExists = devices.some((device: any) => device.token === token);
          
          if (tokenExists) {
            console.log('[NotificationService] Token already exists, updating timestamp');
            // Si el token ya existe, actualizamos con arrayRemove y luego arrayUnion
            await userRef.update({
              notificationToken: token,
              devices: firebase.firestore.FieldValue.arrayRemove(
                ...devices.filter((device: any) => device.token === token)
              ),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Agregamos el dispositivo con timestamp actualizado
            await userRef.update({
              devices: firebase.firestore.FieldValue.arrayUnion({
                token,
                platform: Platform.OS,
                updatedAt: now
              })
            });
          } else {
            console.log('[NotificationService] Adding new token to devices array');
            // Si el token no existe, simplemente lo agregamos
            await userRef.update({
              notificationToken: token,
              devices: firebase.firestore.FieldValue.arrayUnion({
                token,
                platform: Platform.OS,
                updatedAt: now
              }),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        } catch (innerError) {
          console.error('[NotificationService] Error updating user document:', innerError);
          // En caso de error, no bloqueamos la experiencia del usuario
          // Retornamos éxito parcial
          return { success: true, data: true };
        }
      }
    } catch (firestoreError) {
      console.error('[NotificationService] Firestore error:', firestoreError);
      // Error de Firestore pero no bloqueamos la experiencia del usuario
      return { success: true, data: true };
    }

    console.log('[NotificationService] Token saved to Firestore successfully');
    return {
      success: true,
      data: true
    };
  } catch (error) {
    console.error('[NotificationService] Error saving token to Firestore:', error);
    // En caso de errores globales, devolvemos éxito parcial para no bloquear
    return { success: true, data: true };
  }
};

// Eliminar token de Firestore (al cerrar sesión) con manejo mejorado de errores
export const removeTokenFromFirestore = async (userId: string, token: string): Promise<NotificationResult<boolean>> => {
  try {
    if (!userId || !token) {
      return {
        success: false,
        error: {
          code: 'notifications/invalid-params',
          message: 'ID de usuario o token inválidos'
        }
      };
    }

    try {
      const userDoc = await firebase.firestore()
        .collection('users')
        .doc(userId)
        .get();
  
      if (!userDoc.exists) {
        return {
          success: false,
          error: {
            code: 'notifications/user-not-found',
            message: 'Usuario no encontrado'
          }
        };
      }
  
      const userData = userDoc.data();
      const devices = userData?.devices || [];
  
      // Filtrar el dispositivo actual
      const updatedDevices = devices.filter((device: any) => device.token !== token);
  
      await firebase.firestore()
        .collection('users')
        .doc(userId)
        .update({
          notificationToken: firebase.firestore.FieldValue.delete(),
          devices: updatedDevices,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (firestoreError) {
      console.error('[NotificationService] Firestore error in removeToken:', firestoreError);
      // No bloqueamos la experiencia por errores de Firestore
      return { success: true, data: true };
    }

    console.log('[NotificationService] Token removed from Firestore successfully');
    return {
      success: true,
      data: true
    };
  } catch (error) {
    console.error('[NotificationService] Error removing token from Firestore:', error);
    // En caso de errores globales, devolvemos éxito parcial para no bloquear
    return { success: true, data: true };
  }
};

// Enviar notificación local (para pruebas y dentro de la app)
export const sendLocalNotification = async (
  title: string,
  body: string,
  data: any = {}
): Promise<NotificationResult<string>> => {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Inmediatamente
    });

    console.log('[NotificationService] Local notification sent with ID:', notificationId);
    return {
      success: true,
      data: notificationId
    };
  } catch (error) {
    console.error('[NotificationService] Error sending local notification:', error);
    return {
      success: false,
      error: {
        code: 'notifications/local-send-error',
        message: 'Error al enviar notificación local'
      }
    };
  }
};

// Enviar notificación para un nuevo mensaje de chat
export const sendChatNotification = async (
  token: string,
  senderName: string,
  messageText: string,
  conversationId: string,
  badgeCount: number = 1,
  imageMessage: boolean = false
): Promise<NotificationResult<boolean>> => {
  try {
    if (!token) {
      return {
        success: false,
        error: {
          code: 'notifications/missing-token',
          message: 'Se requiere token de dispositivo para enviar notificación'
        }
      };
    }

    // Preparar texto para la notificación
    const notificationBody = imageMessage
      ? `${senderName} te ha enviado una imagen`
      : messageText.length > 100
        ? `${messageText.substring(0, 100)}...`
        : messageText;

    // En entorno de desarrollo, usar notificación local para pruebas
    if (__DEV__) {
      await sendLocalNotification(
        senderName,
        notificationBody,
        {
          type: 'chat',
          conversationId,
          badge: badgeCount
        }
      );
      return { success: true, data: true };
    } else {
      // En producción, habría que usar un servicio como Firebase Cloud Functions
      // para enviar notificaciones push, ya que no podemos enviar directamente
      // desde el cliente por seguridad.
      console.log('[NotificationService] Would send push notification in production to token:', token);
      return { success: true, data: true };
    }
  } catch (error) {
    console.error('[NotificationService] Error sending chat notification:', error);
    return {
      success: false,
      error: {
        code: 'notifications/chat-notification-error',
        message: 'Error al enviar notificación de chat'
      }
    };
  }
};

// Funciones para gestionar badges (contadores en el ícono de la app)
export const setBadgeCount = async (count: number): Promise<NotificationResult<boolean>> => {
  try {
    await Notifications.setBadgeCountAsync(count);
    console.log('[NotificationService] Badge count set to:', count);
    return {
      success: true,
      data: true
    };
  } catch (error) {
    console.error('[NotificationService] Error setting badge count:', error);
    return {
      success: false,
      error: {
        code: 'notifications/badge-error',
        message: 'Error al actualizar contador de notificaciones'
      }
    };
  }
};

// Actualizar badge count en la base de datos y en el dispositivo
export const syncBadgeCount = async (userId: string): Promise<NotificationResult<number>> => {
  try {
    if (!userId) {
      return {
        success: false,
        error: {
          code: 'notifications/invalid-user',
          message: 'ID de usuario inválido'
        }
      };
    }

    try {
      // Obtener contador actual de la base de datos
      const userDoc = await firebase.firestore()
        .collection('users')
        .doc(userId)
        .get();
  
      if (!userDoc.exists) {
        return {
          success: false,
          error: {
            code: 'notifications/user-not-found',
            message: 'Usuario no encontrado'
          }
        };
      }
  
      const userData = userDoc.data();
      const badgeCount = userData?.badgeCount || 0;
  
      // Actualizar contador en el dispositivo
      await Notifications.setBadgeCountAsync(badgeCount);
      console.log('[NotificationService] Badge count synced to:', badgeCount);
  
      return {
        success: true,
        data: badgeCount
      };
    } catch (firestoreError) {
      console.error('[NotificationService] Firestore error in syncBadgeCount:', firestoreError);
      // En caso de error, intentamos resetear el badge a 0
      try {
        await Notifications.setBadgeCountAsync(0);
      } catch (badgeError) {
        console.error('[NotificationService] Error resetting badge:', badgeError);
      }
      return { success: true, data: 0 };
    }
  } catch (error) {
    console.error('[NotificationService] Error syncing badge count:', error);
    return {
      success: false,
      error: {
        code: 'notifications/sync-badge-error',
        message: 'Error al sincronizar contador de notificaciones'
      }
    };
  }
};

// Resetear badge count a cero
export const resetBadgeCount = async (userId: string): Promise<NotificationResult<boolean>> => {
  try {
    if (!userId) {
      // Si no hay userId, solo reseteamos el contador en el dispositivo
      await Notifications.setBadgeCountAsync(0);
      return { success: true, data: true };
    }

    try {
      // Resetear en la base de datos
      await firebase.firestore()
        .collection('users')
        .doc(userId)
        .update({
          badgeCount: 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (firestoreError) {
      console.error('[NotificationService] Firestore error in resetBadgeCount:', firestoreError);
      // No bloqueamos la experiencia por errores de Firestore
    }

    try {
      // Resetear en el dispositivo (siempre intentamos esto)
      await Notifications.setBadgeCountAsync(0);
      console.log('[NotificationService] Badge count reset to 0');
    } catch (badgeError) {
      console.error('[NotificationService] Error resetting badge count:', badgeError);
      // No bloqueamos la experiencia por errores del badge
    }

    return {
      success: true,
      data: true
    };
  } catch (error) {
    console.error('[NotificationService] Error resetting badge count:', error);
    // Intentamos resetear el badge de todas formas
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (innerError) {
      console.error('[NotificationService] Additional error resetting badge:', innerError);
    }
    return { success: true, data: true };
  }
};

// Registrar handlers para notificaciones - usando referencia global para evitar múltiples listeners
export const registerNotificationHandlers = (
  onReceive: (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void
): (() => void) => {
  // Increment counter to track the number of active registrations
  activeListeners.counter++;
  
  console.log('[NotificationService] Setting up notification handlers, active count:', activeListeners.counter);
  
  // Only set up new listeners if none exist
  if (!activeListeners.received) {
    console.log('[NotificationService] Creating new received notification listener');
    // Escuchar notificaciones recibidas cuando la app está en primer plano
    activeListeners.received = Notifications.addNotificationReceivedListener(notification => {
      console.log('[NotificationService] Notification received in foreground');
      onReceive(notification);
    });
  }
  
  if (!activeListeners.response) {
    console.log('[NotificationService] Creating new notification response listener');
    // Escuchar respuestas a notificaciones (cuando el usuario toca la notificación)
    activeListeners.response = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[NotificationService] User tapped on notification');
      onResponse(response);
    });
  }
  
  // Devolver función de limpieza que decrements the counter
  return () => {
    // Decrement counter
    activeListeners.counter = Math.max(0, activeListeners.counter - 1);
    console.log('[NotificationService] Removing notification handler registration, remaining count:', activeListeners.counter);
    
    // Only actually remove listeners if counter is 0
    if (activeListeners.counter === 0) {
      console.log('[NotificationService] Removing all notification listeners');
      if (activeListeners.received) {
        activeListeners.received.remove();
        activeListeners.received = null;
      }
      
      if (activeListeners.response) {
        activeListeners.response.remove();
        activeListeners.response = null;
      }
    }
  };
};

// Eliminar todos los handlers activos
export const removeAllNotificationHandlers = () => {
  console.log('[NotificationService] Force removing all notification handlers');
  
  if (activeListeners.received) {
    activeListeners.received.remove();
    activeListeners.received = null;
  }
  
  if (activeListeners.response) {
    activeListeners.response.remove();
    activeListeners.response = null;
  }
  
  // Reset counter
  activeListeners.counter = 0;
};

// Obtener la última notificación que abrió la app
export const getLastNotificationResponse = async (): Promise<Notifications.NotificationResponse | null> => {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return response;
  } catch (error) {
    console.error('[NotificationService] Error getting last notification response:', error);
    return null;
  }
};

// Exportar el servicio completo
export const notificationService = {
  configureNotifications,
  requestNotificationPermissions,
  registerForPushNotifications,
  saveTokenToFirestore,
  removeTokenFromFirestore,
  sendLocalNotification,
  sendChatNotification,
  setBadgeCount,
  syncBadgeCount,
  resetBadgeCount,
  registerNotificationHandlers,
  removeAllNotificationHandlers,
  getLastNotificationResponse
};

export default notificationService;
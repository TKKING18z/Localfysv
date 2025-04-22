import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import { EventEmitter } from 'events';

// Define notification types
export type NotificationType = 
  | 'chat' 
  | 'order_new' 
  | 'order_status' 
  | 'system' 
  | 'promo' 
  | 'reservation_new' 
  | 'reservation_status';

// Notification data interface
export interface NotificationData {
  title: string;
  message: string;
  type: NotificationType;
  data?: any;
  duration?: number;
  autoDismiss?: boolean;
  id?: string;
}

// Create an event emitter for notifications
const notificationEmitter = new EventEmitter();

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
export const configureNotifications = async (): Promise<NotificationResult> => {
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
    if (Platform.OS === 'web') {
      console.warn('[NotificationService] Push notifications not fully supported on web.');
      // Podríamos retornar un token simulado o null dependiendo de la estrategia
      return { success: true, data: { token: null } };
    }

    // Solicitar permisos primero
    const permissionResult = await requestNotificationPermissions();
    if (!permissionResult.success || !permissionResult.data?.granted) {
      return {
        success: false,
        error: permissionResult.error || {
          code: 'notifications/permission-denied',
          message: 'Los permisos de notificación no fueron otorgados',
        },
      };
    }

    // Obtener el token de Expo para notificaciones push
    let expoPushToken;
    try {
      // Intenta obtener el token usando projectId si está disponible
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId && !__DEV__) {
        console.error('[NotificationService] Missing Expo projectId in app config (extra.eas.projectId). Notifications might not work in production.');
        // No lanzamos error para permitir desarrollo/pruebas sin EAS projectId
      }
      expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      console.log('[NotificationService] Expo Push token:', expoPushToken.data);
    } catch (error: any) {
      console.error('[NotificationService] Error getting Expo Push Token:', error);
      // Considera retornar error o un token nulo/simulado
      return {
        success: false,
        error: {
          code: 'notifications/token-fetch-error',
          message: `Failed to get push token: ${error.message}`,
        },
      };
    }

    // Configuración específica de Android (Canal de Notificación)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250], // Patrón de vibración
        lightColor: '#FF231F7C', // Color de la luz LED (si aplica)
      });
    }

    return {
      success: true,
      data: {
        token: expoPushToken.data,
      },
    };
  } catch (error: any) {
    console.error('[NotificationService] Error registering for push:', error);
    return {
      success: false,
      error: {
        code: 'notifications/registration-error',
        message: error.message || 'Error al registrar el dispositivo para notificaciones',
      },
    };
  }
};

// Guardar token en Firestore (versión simplificada usando notificationToken)
export const saveTokenToFirestore = async (userId: string, token: string | null): Promise<NotificationResult<boolean>> => {
  // Si el token es nulo (ej. en web o error), no intentamos guardarlo
  if (!token) {
    console.log('[NotificationService] No token provided, skipping save to Firestore.');
    return { success: true, data: false }; // Indica que no se guardó nada
  }

  try {
    if (!userId) {
      return {
        success: false,
        error: {
          code: 'notifications/invalid-user',
          message: 'ID de usuario inválido para guardar token',
        },
      };
    }

    const userRef = firebase.firestore().collection('users').doc(userId);
    const updateData = {
      notificationToken: token,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      // Opcional: guardar plataforma
      lastPlatform: Platform.OS,
    };

    // Usamos set con merge:true para crear o actualizar el documento
    await userRef.set(updateData, { merge: true });

    console.log(`[NotificationService] Token saved/updated for user ${userId}`);
    return {
      success: true,
      data: true,
    };
  } catch (error: any) {
    console.error('[NotificationService] Error saving token to Firestore:', error);
    return {
      success: false,
      error: {
        code: 'notifications/token-save-error',
        message: error.message || 'Error al guardar token en la base de datos',
      },
    };
  }
};

// Eliminar token de Firestore (al cerrar sesión)
export const removeTokenFromFirestore = async (userId: string): Promise<NotificationResult<boolean>> => {
  try {
    if (!userId) {
      return { success: false, error: { code: 'notifications/invalid-user', message: 'ID de usuario inválido' } };
    }

    const userRef = firebase.firestore().collection('users').doc(userId);

    // Eliminamos el campo notificationToken y actualizamos timestamp
    await userRef.update({
      notificationToken: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[NotificationService] Token removed for user ${userId}`);
    return {
      success: true,
      data: true,
    };
  } catch (error: any) {
    console.error('[NotificationService] Error removing token from Firestore:', error);
    // Considerar no fallar si el documento no existe o el campo ya no está
    if (error.code === 'not-found') {
      console.warn(`[NotificationService] User ${userId} not found or token already removed.`);
      return { success: true, data: false }; // No se eliminó nada, pero no es un error fatal
    }
    return {
      success: false,
      error: {
        code: 'notifications/token-remove-error',
        message: error.message || 'Error al eliminar token de la base de datos',
      },
    };
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

// Resetear badge count a cero (llamando a la Cloud Function)
export const resetBadgeCount = async (): Promise<NotificationResult<boolean>> => {
  try {
    // Obtenemos la referencia a la Cloud Function
    const resetBadgeFunction = firebase.functions().httpsCallable('resetBadgeCount');

    // Llamamos a la función (no necesita enviar userId, lo toma del contexto)
    const result = await resetBadgeFunction();

    if (result.data.success) {
      console.log('[NotificationService] Cloud Function resetBadgeCount called successfully.');
      // También reseteamos en el dispositivo localmente para inmediatez
      await Notifications.setBadgeCountAsync(0);
      return { success: true, data: true };
    } else {
      console.error('[NotificationService] Cloud Function resetBadgeCount returned failure:', result.data);
      return {
        success: false,
        error: {
          code: 'notifications/reset-badge-cloud-error',
          message: 'La función para resetear el contador falló.',
        },
      };
    }
  } catch (error: any) {
    console.error('[NotificationService] Error calling resetBadgeCount Cloud Function:', error);
    // Manejar errores específicos de functions (permisos, etc.)
    let code = 'notifications/reset-badge-error';
    let message = error.message || 'Error al llamar la función para resetear contador.';
    if (error.code === 'unauthenticated') {
      code = 'notifications/unauthenticated';
      message = 'Usuario no autenticado para resetear badge.';
    } else if (error.code === 'permission-denied') {
      code = 'notifications/permission-denied';
      message = 'Permiso denegado para resetear badge.';
    }
    return {
      success: false,
      error: { code, message },
    };
  }
};

// Registrar handlers para notificaciones
export const registerNotificationHandlers = (
  onReceive: (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void
): (() => void) => {
  // Escuchar notificaciones recibidas cuando la app está en primer plano
  const receivedSubscription = Notifications.addNotificationReceivedListener(onReceive);
  
  // Escuchar respuestas a notificaciones (cuando el usuario toca la notificación)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onResponse);
  
  // Devolver función de limpieza
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
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

// In-app notification functions (from the smaller file)
export const showNotification = (notification: NotificationData): void => {
  notificationEmitter.emit('show-notification', notification);
};

export const onShowNotification = (callback: (notification: NotificationData) => void): () => void => {
  notificationEmitter.on('show-notification', callback);
  return () => {
    notificationEmitter.off('show-notification', callback);
  };
};

export const showReservationCreatedNotification = (reservationId: string, businessName: string): void => {
  showNotification({
    title: 'Reserva Recibida',
    message: `Tu reserva en ${businessName} ha sido registrada. El negocio ha sido notificado y te avisaremos cuando la confirmen.`,
    type: 'reservation_new',
    data: { reservationId },
    duration: 5000,
    autoDismiss: true
  });
};

export const showReservationStatusNotification = (
  reservationId: string, 
  businessName: string, 
  status: 'confirmed' | 'canceled' | 'completed'
): void => {
  let title = 'Actualización de Reserva';
  let message = `Tu reserva en ${businessName} ha sido actualizada.`;

  switch (status) {
    case 'confirmed':
      title = 'Reserva Confirmada';
      message = `¡Tu reserva en ${businessName} ha sido confirmada!`;
      break;
    case 'canceled':
      title = 'Reserva Cancelada';
      message = `Tu reserva en ${businessName} ha sido cancelada.`;
      break;
    case 'completed':
      title = 'Reserva Completada';
      message = `Gracias por tu visita a ${businessName}. Esperamos que hayas disfrutado de tu experiencia.`;
      break;
  }

  showNotification({
    title,
    message,
    type: 'reservation_status',
    data: { reservationId },
    duration: 5000,
    autoDismiss: true
  });
};

// Exportar el servicio completo
export const notificationService = {
  // Push notification methods
  configureNotifications,
  requestNotificationPermissions,
  registerForPushNotifications,
  saveTokenToFirestore,
  removeTokenFromFirestore,
  sendLocalNotification,
  setBadgeCount,
  syncBadgeCount,
  resetBadgeCount,
  registerNotificationHandlers,
  getLastNotificationResponse,
  
  // In-app notification methods
  showNotification,
  onShowNotification,
  showReservationCreatedNotification,
  showReservationStatusNotification,
};

export default notificationService;
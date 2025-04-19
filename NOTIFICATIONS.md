# Implementación de Notificaciones en Localfy

Este documento detalla cómo implementar las notificaciones push en el proyecto Localfy.

## Requisitos

- Proyecto Firebase con Firestore y Authentication configurados
- Proyecto Expo con proyecto ID para notificaciones
- Firebase CLI instalada y configurada

## Configuración de Firebase Cloud Functions

### Paso 1: Inicializar Firebase Functions

```bash
firebase init functions
```

Esto creará una carpeta `functions` en la raíz de tu proyecto.

### Paso 2: Editar el archivo index.js

Reemplaza el contenido del archivo `functions/index.js` con el siguiente código:

```javascript
/**
 * Firebase Cloud Functions para manejo de notificaciones push
 * 
 * Estas funciones se encargan de enviar notificaciones push a los dispositivos
 * cuando hay nuevos mensajes o actualizaciones en la app.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Función que escucha nuevos mensajes y envía notificaciones push
 * Esta función se activa cuando se crea un nuevo documento en la colección messages de una conversación
 */
exports.sendChatNotification = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    try {
      const messageData = snapshot.data();
      const { conversationId, messageId } = context.params;
      
      // Si no hay datos válidos, terminamos la función
      if (!messageData || !messageData.senderId) {
        console.log('Mensaje sin datos válidos, omitiendo notificación');
        return null;
      }
      
      console.log(`Nuevo mensaje detectado - conversación: ${conversationId}, mensaje: ${messageId}`);
      
      // Obtener datos de la conversación
      const conversationRef = admin.firestore().collection('conversations').doc(conversationId);
      const conversationDoc = await conversationRef.get();
      
      if (!conversationDoc.exists) {
        console.log(`La conversación ${conversationId} no existe, omitiendo notificación`);
        return null;
      }
      
      const conversationData = conversationDoc.data();
      const participants = conversationData.participants || [];
      
      // No enviar notificación al emisor del mensaje
      const senderId = messageData.senderId;
      const recipientIds = participants.filter(id => id !== senderId);
      
      if (recipientIds.length === 0) {
        console.log('No hay destinatarios para este mensaje, omitiendo notificación');
        return null;
      }
      
      console.log(`Enviando notificación a ${recipientIds.length} destinatarios`);
      
      // Preparar el mensaje para la notificación
      const senderName = messageData.senderName || 'Usuario';
      let notificationBody = '';
      
      if (messageData.type === 'image') {
        notificationBody = `${senderName} te ha enviado una imagen`;
      } else {
        const text = messageData.text || '';
        notificationBody = text.length > 100 ? `${text.substring(0, 100)}...` : text;
      }
      
      // Lotes de actualización para eficiencia
      const batch = admin.firestore().batch();
      const notificationPromises = [];
      
      // Para cada destinatario, obtener sus tokens y enviar notificación
      for (const recipientId of recipientIds) {
        try {
          // Obtener datos del usuario
          const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
          
          if (!userDoc.exists) {
            console.log(`Usuario ${recipientId} no encontrado, omitiendo notificación`);
            continue;
          }
          
          const userData = userDoc.data();
          
          // Obtener todos los tokens disponibles para este usuario
          const tokens = [];
          // Token principal (si existe)
          if (userData.notificationToken) {
            tokens.push(userData.notificationToken);
          }
          
          // Tokens de dispositivos adicionales
          if (userData.devices && Array.isArray(userData.devices)) {
            userData.devices.forEach(device => {
              if (device && device.token && !tokens.includes(device.token)) {
                tokens.push(device.token);
              }
            });
          }
          
          if (tokens.length === 0) {
            console.log(`Usuario ${recipientId} no tiene tokens registrados, omitiendo notificación`);
            continue;
          }
          
          // Incrementar badgeCount para este usuario
          const currentBadge = userData.badgeCount || 0;
          const newBadgeCount = currentBadge + 1;
          
          batch.update(userDoc.ref, {
            badgeCount: newBadgeCount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Datos para la notificación
          const payload = {
            notification: {
              title: senderName,
              body: notificationBody,
              badge: `${newBadgeCount}`,
              sound: 'default'
            },
            data: {
              type: 'chat',
              conversationId: conversationId,
              messageId: messageId,
              senderId: senderId,
              senderName: senderName,
              click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
          };
          
          console.log(`Enviando notificación a usuario ${recipientId} con ${tokens.length} tokens`);
          
          // Enviar a todos los tokens disponibles para este usuario
          notificationPromises.push(
            admin.messaging().sendMulticast({
              tokens,
              ...payload
            })
          );
        } catch (userError) {
          console.error(`Error procesando usuario ${recipientId}:`, userError);
        }
      }
      
      // Confirmar todas las actualizaciones de badge
      await batch.commit();
      
      // Enviar todas las notificaciones y procesar resultados
      const results = await Promise.allSettled(notificationPromises);
      
      let successCount = 0;
      let failureCount = 0;
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          const response = result.value;
          successCount += response.successCount;
          failureCount += response.failureCount;
        } else {
          failureCount++;
        }
      });
      
      console.log(`Notificaciones enviadas - Éxitos: ${successCount}, Fallos: ${failureCount}`);
      return { success: true, sent: successCount, failed: failureCount };
    } catch (error) {
      console.error('Error al enviar notificación de chat:', error);
      return { success: false, error: error.message };
    }
  });

/**
 * Función que resetea el contador de badge del usuario
 * Esta función puede ser llamada desde la aplicación cliente cuando se leen los mensajes
 */
exports.resetBadgeCount = functions.https.onCall(async (data, context) => {
  // Verificar que el usuario está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'El usuario debe estar autenticado para usar esta función'
    );
  }
  
  const userId = data.userId || context.auth.uid;
  
  // Verificar que el usuario solo está reseteando su propio contador 
  // (a menos que sea un admin, podría implementarse esta verificación más adelante)
  if (userId !== context.auth.uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'No tienes permiso para resetear el contador de otro usuario'
    );
  }
  
  try {
    await admin.firestore().collection('users').doc(userId).update({
      badgeCount: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error al resetear contador de badge:', error);
    throw new functions.https.HttpsError('internal', 'Error al resetear contador de notificaciones', error);
  }
});

/**
 * Función para enviar una notificación push directamente a un usuario
 * Esta función puede ser utilizada administrativamente o para implementar notificaciones manuales
 */
exports.sendDirectNotification = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'El usuario debe estar autenticado para usar esta función'
    );
  }
  
  // Extraer parámetros
  const { userId, title, body, data: notificationData } = data;
  
  if (!userId || !title || !body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Faltan datos obligatorios para la notificación (userId, title, body)'
    );
  }
  
  try {
    // Obtener tokens del usuario
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'El usuario no existe'
      );
    }
    
    const userData = userDoc.data();
    const tokens = [];
    
    // Token principal
    if (userData.notificationToken) {
      tokens.push(userData.notificationToken);
    }
    
    // Tokens de dispositivos adicionales
    if (userData.devices && Array.isArray(userData.devices)) {
      userData.devices.forEach(device => {
        if (device && device.token && !tokens.includes(device.token)) {
          tokens.push(device.token);
        }
      });
    }
    
    if (tokens.length === 0) {
      return {
        success: false,
        message: 'El usuario no tiene tokens de notificación registrados'
      };
    }
    
    // Enviar notificación
    const response = await admin.messaging().sendMulticast({
      tokens,
      notification: {
        title,
        body,
        badge: `${userData.badgeCount || 0}`,
        sound: 'default'
      },
      data: notificationData || {}
    });
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Error enviando notificación directa:', error);
    throw new functions.https.HttpsError('internal', 'Error enviando notificación', error);
  }
});
```

### Paso 3: Actualizar package.json de Functions

Asegúrate que tu archivo `functions/package.json` tenga las dependencias correctas:

```json
{
  "name": "functions",
  "description": "Cloud Functions for Firebase",
  "scripts": {
    "lint": "eslint .",
    "serve": "firebase emulators:start --only functions",
    "shell": "firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "16"
  },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^10.0.2",
    "firebase-functions": "^3.23.0"
  },
  "devDependencies": {
    "eslint": "^8.15.0",
    "eslint-config-google": "^0.14.0",
    "firebase-functions-test": "^0.2.0"
  },
  "private": true
}
```

### Paso 4: Desplegar las funciones

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Configuración en el cliente (Expo/React Native)

### Configuración en app.config.js

Asegúrate de que tu archivo `app.config.js` tenga la configuración para notificaciones:

```javascript
export default {
  // ...otros configs
  plugins: [
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#ffffff"
      }
    ]
  ],
  extra: {
    // ... otras variables
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
  }
};
```

### Uso de notificaciones en la aplicación

El proyecto ya contiene las siguientes implementaciones:

1. `services/NotificationService.ts` - Servicio para manejar todas las operaciones de notificaciones
2. `src/context/AuthContext.tsx` - Integración para registrar el token cuando el usuario inicia sesión
3. `src/context/ChatContext.tsx` - Manejo de contadores de notificaciones para chat
4. `src/screens/chat/ChatScreen.tsx` - Reseteo de notificaciones al leer mensajes
5. `src/navigation/AppNavigator.tsx` - Manejador de notificaciones recibidas

## Troubleshooting

Si encuentras problemas con las notificaciones push, verifica:

1. **Permisos de Firebase**: Asegúrate de que tus reglas de seguridad permiten las operaciones necesarias.
2. **Tokens de dispositivo**: Verifica que los tokens se estén guardando correctamente en Firestore.
3. **Logs de Firebase**: Revisa los logs de las Cloud Functions para detectar errores específicos.
4. **Permisos de aplicación**: En iOS y Android, asegúrate de que el usuario haya concedido permisos de notificación.

## Referencias

- [Documentación de Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)

## Progreso de Implementación (Resumen)

1.  **Identificación de Archivos:** Se analizaron los archivos del proyecto para identificar los componentes clave del sistema de chat (`ChatService.ts`, `ChatContext.tsx`, `ChatScreen.tsx`, etc.).
2.  **Cloud Functions (Backend):**
    *   Se implementó la Cloud Function `sendChatNotification` en `functions/src/index.ts` (basada en `NOTIFICATIONS.md`) para enviar notificaciones push automáticamente cuando se crea un nuevo mensaje en Firestore.
    *   Se implementó la Cloud Function `resetBadgeCount` en `functions/src/index.ts` para permitir que la aplicación cliente resetee el contador de badges del usuario en Firestore.
    *   Se resolvieron problemas durante el despliegue relacionados con errores de linting (longitud de línea, indentación) y compatibilidad de TypeScript con dependencias, actualizando TypeScript a v5.x y modificando temporalmente el script `lint` en `functions/package.json` para permitir el despliegue.
    *   Ambas Cloud Functions (`sendChatNotification`, `resetBadgeCount`) fueron desplegadas exitosamente en Firebase.
    *   Se restauró el script `lint` original en `functions/package.json`.
3.  **Servicio de Notificaciones (Cliente):**
    *   Se revisó y actualizó `services/NotificationService.ts`.
    *   Se simplificó la lógica de guardado de tokens (`saveTokenToFirestore`) para usar un único `notificationToken` por usuario, alineándose con la implementación actual de `sendChatNotification`.
    *   Se modificó la función `resetBadgeCount` del cliente para llamar a la Cloud Function correspondiente en lugar de actualizar Firestore directamente.
    *   Se eliminó la función `sendChatNotification` del cliente, ya que el envío ahora es manejado por la Cloud Function.
4.  **Contexto de Autenticación (Cliente):**
    *   Se verificó `src/context/AuthContext.tsx` y se confirmó que la lógica para registrar el token de notificación (`saveTokenToFirestore`) al iniciar sesión y eliminarlo (`removeTokenFromFirestore`) al cerrar sesión ya estaba implementada correctamente dentro del listener `onAuthStateChanged`.
5.  **Navegador Principal (Cliente):**
    *   Se inició la configuración de los listeners de notificaciones (`addNotificationReceivedListener`, `addNotificationResponseReceivedListener`) en `src/navigation/AppNavigator.tsx` para manejar la recepción y la interacción del usuario con las notificaciones.

    Name:Localfy key
Key ID:9NYAXNRHN3
Services:Apple Push Notifications service (APNs)
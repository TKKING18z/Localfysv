/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

/* eslint-disable */
// Desactivando reglas de estilo temporalmente para permitir el despliegue
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

// Inicializar Firebase Admin SDK
admin.initializeApp();

// Inicializar Expo SDK
const expo = new Expo();

// Importar módulos específicos de Cloud Functions v2
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

/**
 * Interfaz para el ticket de respuesta de Expo
 */
interface ExpoPushTicket {
  status: "ok" | "error";
  message?: string;
  details?: any;
  id?: string;
}

/**
 * Interfaz para los datos de un mensaje (simplificada)
 */
interface MessageData {
  senderId?: string;
  senderName?: string;
  text?: string;
  type?: string; // 'text', 'image', etc.
}

/**
 * Interfaz para los datos de una conversación (simplificada)
 */
interface ConversationData {
  participants?: string[];
  // Otros campos de la conversación si son necesarios
}

/**
 * Interfaz para los datos de un usuario (simplificada)
 */
interface UserData {
  notificationToken?: string; // Token principal
  devices?: {token?: string}[]; // Lista de dispositivos/tokens adicionales
  badgeCount?: number;
  // Otros campos del usuario si son necesarios
}

/**
 * Función que escucha nuevos mensajes y envía notificaciones push.
 * Se activa cuando se crea un nuevo documento en la colección messages
 * de una conversación.
 */
export const sendChatNotification = functions.firestore
  .document("conversations/{conversationId}/messages/{messageId}")
  .onCreate(async (
    snapshot: functions.firestore.QueryDocumentSnapshot,
    context: functions.EventContext
  ) => {
    // Declarar fuera del try para acceso en catch
    const {conversationId, messageId} = context.params;

    try {
      const messageData = snapshot.data() as MessageData | undefined;

      // Si no hay datos válidos o senderId, terminamos la función
      if (!messageData || !messageData.senderId) {
        logger.log(
          "Mensaje sin datos válidos o senderId, omitiendo notificación",
          {conversationId, messageId}
        );
        return null;
      }

      logger.log(
        `Nuevo mensaje detectado - conversación: ${conversationId}, ` +
            `mensaje: ${messageId}`
      );

      // Obtener datos de la conversación
      const conversationRef = admin
        .firestore()
        .collection("conversations")
        .doc(conversationId);
      const conversationDoc = await conversationRef.get();

      if (!conversationDoc.exists) {
        logger.log(
          `La conversación ${conversationId} no existe, ` +
              "omitiendo notificación"
        );
        return null;
      }

      const conversationData =
          conversationDoc.data() as ConversationData | undefined;
      const participants = conversationData?.participants || [];

      // No enviar notificación al emisor del mensaje
      const senderId = messageData.senderId;
      // Asegurarnos que el senderId sea una cadena para la comparación correcta
      const senderIdString = String(senderId);
      
      // Aquí está el problema: Necesitamos filtrar correctamente para que el remitente no reciba notificaciones
      logger.log(`SenderId: ${senderIdString}, participants: ${JSON.stringify(participants)}`);
      
      // Filtramos explícitamente utilizando toString() para asegurar que la comparación sea por valor, no por referencia
      const recipientIds = participants.filter((id) => {
        // Convertir ambos a string para comparación consistente
        return String(id) !== String(senderIdString);
      });

      logger.log(`Destinatarios finales: ${JSON.stringify(recipientIds)}`);

      if (recipientIds.length === 0) {
        logger.log(
          "No hay destinatarios para este mensaje, omitiendo notificación",
          {conversationId}
        );
        return null;
      }

      logger.log(
        `Enviando notificación a ${recipientIds.length} destinatarios`,
        {conversationId}
      );

      // Preparar el mensaje para la notificación
      const senderName = messageData.senderName || "Usuario";
      let notificationBody = "";

      if (messageData.type === "image") {
        notificationBody = `${senderName} te ha enviado una imagen`;
      } else {
        const text = messageData.text || "";
        // Ajustado a 97 para dejar espacio a '...'
        notificationBody = text.length > 100 ?
          `${text.substring(0, 97)}...` : text;
      }

      // Lotes de actualización para eficiencia
      const batch = admin.firestore().batch();
      const fcmTokens: string[] = []; // Lista para tokens de FCM
      const expoTokens: string[] = []; // Lista para tokens de Expo

      // Para cada destinatario, obtener sus tokens y preparar notificación
      for (const recipientId of recipientIds) {
        try {
          // Obtener datos del usuario
          const userDoc = await admin
            .firestore()
            .collection("users")
            .doc(recipientId)
            .get();

          if (!userDoc.exists) {
            logger.log(
              `Usuario ${recipientId} no encontrado, omitiendo notificación`
            );
            continue;
          }

          const userData = userDoc.data() as UserData | undefined;
          const userTokens: string[] = [];

          // Token principal (si existe)
          if (userData?.notificationToken) {
            userTokens.push(userData.notificationToken);
          }

          // Tokens de dispositivos adicionales
          if (userData?.devices && Array.isArray(userData.devices)) {
            userData.devices.forEach((device) => {
              if (device && device.token && !userTokens.includes(device.token)) {
                userTokens.push(device.token);
              }
            });
          }

          if (userTokens.length === 0) {
            logger.log(
              `Usuario ${recipientId} no tiene tokens registrados, ` +
                  "omitiendo notificación"
            );
            continue;
          }

          // Clasificar tokens según su tipo (Expo o FCM)
          userTokens.forEach(token => {
            if (token && typeof token === 'string') {
              if (token.startsWith('ExponentPushToken[')) {
                // Verificación adicional para asegurarnos que no estamos agregando un token del remitente
                if (String(recipientId) !== String(senderIdString)) {
                  expoTokens.push(token);
                } else {
                  logger.warn(`Ignorando token de Expo para el remitente: ${senderIdString}`);
                }
              } else {
                // Verificación adicional para asegurarnos que no estamos agregando un token del remitente
                if (String(recipientId) !== String(senderIdString)) {
                  fcmTokens.push(token);
                } else {
                  logger.warn(`Ignorando token de FCM para el remitente: ${senderIdString}`);
                }
              }
            }
          });

          // Incrementar badgeCount para este usuario
          const currentBadge = userData?.badgeCount || 0;
          const newBadgeCount = currentBadge + 1;

          batch.update(userDoc.ref, {
            badgeCount: newBadgeCount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (userError) {
          logger.error(`Error procesando usuario ${recipientId}:`, userError);
        }
      }

      // Verificación final de tokens
      logger.log(`Tokens FCM: ${fcmTokens.length}, Tokens Expo: ${expoTokens.length}`);
      
      // Verificar que ningún token pertenezca al remitente
      const senderRef = admin.firestore().collection("users").doc(String(senderIdString));
      const senderDoc = await senderRef.get();
      
      if (senderDoc.exists) {
        const senderData = senderDoc.data() as UserData | undefined;
        const senderToken = senderData?.notificationToken;
        
        // Si el token del remitente está en alguna de las listas, eliminarlo
        if (senderToken) {
          const fcmIndex = fcmTokens.indexOf(senderToken);
          if (fcmIndex !== -1) {
            logger.warn(`Eliminando token FCM del remitente de la lista de destinatarios: ${senderToken}`);
            fcmTokens.splice(fcmIndex, 1);
          }
          
          const expoIndex = expoTokens.indexOf(senderToken);
          if (expoIndex !== -1) {
            logger.warn(`Eliminando token Expo del remitente de la lista de destinatarios: ${senderToken}`);
            expoTokens.splice(expoIndex, 1);
          }
        }
      }

      // Confirmar todas las actualizaciones de badge
      try {
        await batch.commit();
        logger.log(
          "Contadores de badge actualizados correctamente.",
          {conversationId}
        );
      } catch (batchError) {
        logger.error(
          "Error al confirmar el batch de actualización de badges:",
          batchError
        );
        // Continuar con el envío de notificaciones si es posible
      }

      // Verificar si hay tokens para notificar
      if (fcmTokens.length === 0 && expoTokens.length === 0) {
        logger.log(
          "No se encontraron tokens válidos para enviar notificaciones.",
          {conversationId}
        );
        return null;
      }

      // Obtener el badgeCount del primer destinatario
      let badgeCountNumber = 1; 
      try {
        if (recipientIds.length > 0) {
          const firstRecipientDoc = await admin
            .firestore()
            .collection("users")
            .doc(recipientIds[0])
            .get();
          if (firstRecipientDoc.exists) {
            const firstRecipientData =
                firstRecipientDoc.data() as UserData | undefined;
            badgeCountNumber = firstRecipientData?.badgeCount || 1;
          }
        }
      } catch (badgeError) {
        logger.warn(
          "No se pudo obtener el badgeCount actualizado " +
              "para la notificación:",
          badgeError
        );
      }

      // Resultados para retornar
      const results = {
        success: true,
        fcmSent: 0,
        fcmFailed: 0,
        expoSent: 0,
        expoFailed: 0
      };

      // Si hay tokens FCM, enviar notificaciones por FCM
      if (fcmTokens.length > 0) {
        // Datos para la notificación FCM
        const fcmPayload: admin.messaging.MulticastMessage = {
          data: {
            type: "chat",
            conversationId: conversationId,
            messageId: messageId,
            senderId: String(senderId),
            senderName: senderName,
          },
          tokens: fcmTokens,
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: badgeCountNumber,
                contentAvailable: true,
                alert: {
                  title: senderName,
                  body: notificationBody,
                },
              },
            },
          },
          android: {
            notification: {
              title: senderName,
              body: notificationBody,
              sound: "default",
            },
            priority: "high",
          },
        };

        logger.log(
          `Enviando notificación FCM a ${fcmTokens.length} tokens`,
          {conversationId}
        );

        try {
          const response = await admin.messaging().sendEachForMulticast(fcmPayload);
          results.fcmSent = response.successCount;
          results.fcmFailed = response.failureCount;

          logger.log(
            `Notificaciones FCM enviadas - Éxitos: ${response.successCount}, ` +
                `Fallos: ${response.failureCount}`,
            {conversationId}
          );

          // Opcional: Manejar tokens inválidos
          if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                logger.warn(
                  `Error enviando a token FCM ${fcmTokens[idx]}: ` +
                      `${resp.error?.message}`,
                );
              }
            });
          }
        } catch (fcmError) {
          logger.error("Error al enviar notificaciones FCM:", fcmError);
        }
      }

      // Si hay tokens Expo, enviar notificaciones por Expo
      if (expoTokens.length > 0) {
        // Filtrar tokens Expo válidos
        const validExpoTokens = expoTokens.filter(token => Expo.isExpoPushToken(token));
        
        if (validExpoTokens.length !== expoTokens.length) {
          logger.warn(`Se detectaron ${expoTokens.length - validExpoTokens.length} tokens Expo inválidos`);
        }

        if (validExpoTokens.length > 0) {
          // Crear mensajes para Expo
          const expoMessages: ExpoPushMessage[] = validExpoTokens.map(token => ({
            to: token,
            sound: 'default',
            title: senderName,
            body: notificationBody,
            badge: badgeCountNumber,
            priority: 'high',
            channelId: 'chat-messages',
            // Configuraciones para notificaciones en segundo plano
            _displayInForeground: true,
            // Estos campos son importantes para asegurar que funcione en segundo plano
            data: {
              type: "chat",
              conversationId: conversationId,
              messageId: messageId,
              senderId: String(senderId),
              senderName: senderName,
              experienceId: '@username/app-slug', // Reemplazar con el experienceId de tu app
              scopeKey: '@username/app-slug', // Mismo que experienceId
            },
          }));

          logger.log(
            `Enviando notificación Expo a ${validExpoTokens.length} tokens`,
            {conversationId}
          );

          try {
            // Crear chunks de mensajes (recomendado por Expo)
            const chunks = expo.chunkPushNotifications(expoMessages);
            
            // Enviar cada chunk
            for (const chunk of chunks) {
              try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                
                // Contar éxitos y fallos
                ticketChunk.forEach((ticket: ExpoPushTicket) => {
                  if (ticket.status === 'ok') {
                    results.expoSent++;
                  } else {
                    results.expoFailed++;
                    logger.warn(`Error enviando notificación Expo: ${ticket.message}`);
                  }
                });
              } catch (chunkError) {
                logger.error("Error al enviar chunk de notificaciones Expo:", chunkError);
                results.expoFailed += chunk.length;
              }
            }

            logger.log(
              `Notificaciones Expo enviadas - Éxitos: ${results.expoSent}, ` +
                  `Fallos: ${results.expoFailed}`,
              {conversationId}
            );
          } catch (expoError) {
            logger.error("Error al enviar notificaciones Expo:", expoError);
          }
        }
      }

      return results;
    } catch (error) {
      logger.error(
        "Error al enviar notificación de chat:",
        error,
        {conversationId, messageId}
      );
      return null;
    }
  });

/**
 * Función que resetea el contador de badge del usuario.
 * Esta función puede ser llamada desde la aplicación cliente
 * cuando se leen los mensajes.
 */
export const resetBadgeCount = functions.https.onCall(async (data, context) => {
  // Verificar que el usuario está autenticado
  if (!context.auth) {
    logger.error("Usuario no autenticado intentando resetear badge.");
    throw new functions.https.HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado para usar esta función.",
    );
  }

  // Usa el UID del contexto de autenticación como ID de usuario
  const userId = context.auth.uid;

  // Opcional: Permitir que un admin resetee el badge de otro usuario
  // const targetUserId = data.userId || userId;
  // if (userId !== targetUserId /* && !isAdmin(context.auth) */ ) {
  //   throw new functions.https.HttpsError(
  //       "permission-denied",
  //       "No tienes permiso para resetear el contador de otro usuario.",
  //   );
  // }

  try {
    logger.log(`Reseteando badge count para usuario: ${userId}`);
    await admin.firestore().collection("users").doc(userId).update({
      badgeCount: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.log(`Badge count reseteado exitosamente para: ${userId}`);
    return {success: true};
  } catch (error) {
    logger.error(`Error al resetear contador de badge para ${userId}:`, error);
    throw new functions.https.HttpsError(
      "internal",
      "Error al resetear contador de notificaciones.",
      error,
    );
  }
});

/**
 * Función que se activa cuando se crea un nuevo pedido y envía notificaciones 
 * push a dueños/administradores del negocio asociado.
 */
export const sendNewOrderNotification = onDocumentCreated("orders/{orderId}", async (event) => {
  const snapshot = event.data;
  const orderId = event.params.orderId;

  if (!snapshot) {
    logger.log(`No hay datos para el pedido ${orderId}, omitiendo notificación`);
    return null;
  }

  try {
    // Obtener datos del pedido
    const orderData = snapshot.data();
    if (!orderData) {
      logger.log(`Pedido ${orderId} sin datos válidos, omitiendo notificación`);
      return null;
    }

    const businessId = orderData.businessId;
    const orderNumber = orderData.orderNumber || `#${orderId.substring(0, 6)}`;
    const total = orderData.total || 0;
    const formattedTotal = total.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });

    // Extraer información de cliente y productos si está disponible
    const customerName = orderData.userName || "Cliente";
    
    // Obtener un resumen de productos si hay items
    let itemsSummary = "";
    if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
      const itemCount = orderData.items.length;
      const firstItemName = orderData.items[0].name || orderData.items[0].productName || "producto";
      
      if (itemCount === 1) {
        itemsSummary = firstItemName;
      } else {
        itemsSummary = `${firstItemName} y ${itemCount - 1} producto(s) más`;
      }
    }

    logger.log(
      `Nuevo pedido detectado - ID: ${orderId}, negocio: ${businessId}, ` +
      `número: ${orderNumber}, total: ${formattedTotal}`
    );

    // 1. Buscar dueño en el documento del negocio
    const businessRef = admin.firestore().collection("businesses").doc(businessId);
    const businessDoc = await businessRef.get();

    const recipientIds: string[] = [];

    if (businessDoc.exists) {
      const businessData = businessDoc.data();
      const ownerId = businessData?.ownerId;
      
      if (ownerId && typeof ownerId === 'string') {
        recipientIds.push(ownerId);
        logger.log(`Dueño principal encontrado: ${ownerId}`);
      }
    }

    // 2. Buscar administradores y gerentes en business_permissions
    const permissionsQuery = admin.firestore()
      .collection("business_permissions")
      .where("businessId", "==", businessId)
      .where("role", "in", ["owner", "admin", "manager"]);
    
    const permissionsSnapshot = await permissionsQuery.get();
    
    permissionsSnapshot.forEach(doc => {
      const permissionData = doc.data();
      const userId = permissionData.userId;
      
      // Evitar duplicados
      if (userId && !recipientIds.includes(userId)) {
        recipientIds.push(userId);
      }
    });

    logger.log(
      `Encontrados ${recipientIds.length} destinatarios para notificación de nuevo pedido`,
      { businessId, roles: "owner, admin, manager" }
    );

    if (recipientIds.length === 0) {
      logger.log(
        "No se encontraron destinatarios para este pedido, omitiendo notificación",
        { businessId }
      );
      return null;
    }

    // Preparar el mensaje para la notificación
    const notificationTitle = "¡Nuevo Pedido! 💰";
    let notificationBody = `Pedido #${orderNumber} - ${formattedTotal}`;
    
    // Añadir detalles del cliente y productos si disponible
    if (itemsSummary) {
      notificationBody += ` | ${itemsSummary}`;
    }
    
    notificationBody += ` | De: ${customerName}`;

    // Lotes de actualización para eficiencia
    const batch = admin.firestore().batch();
    const fcmTokens: string[] = []; // Lista para tokens de FCM
    const expoTokens: string[] = []; // Lista para tokens de Expo

    // Para cada destinatario, obtener sus tokens y preparar notificación
    for (const recipientId of recipientIds) {
      try {
        // Obtener datos del usuario
        const userDoc = await admin
          .firestore()
          .collection("users")
          .doc(recipientId)
          .get();

        if (!userDoc.exists) {
          logger.log(
            `Usuario ${recipientId} no encontrado, omitiendo notificación`
          );
          continue;
        }

        const userData = userDoc.data() as UserData | undefined;
        const userTokens: string[] = [];

        // Token principal (si existe)
        if (userData?.notificationToken) {
          userTokens.push(userData.notificationToken);
        }

        // Tokens de dispositivos adicionales
        if (userData?.devices && Array.isArray(userData.devices)) {
          userData.devices.forEach((device) => {
            if (device && device.token && !userTokens.includes(device.token)) {
              userTokens.push(device.token);
            }
          });
        }

        if (userTokens.length === 0) {
          logger.log(
            `Usuario ${recipientId} no tiene tokens registrados, ` +
                "omitiendo notificación"
          );
          continue;
        }

        // Clasificar tokens según su tipo (Expo o FCM)
        userTokens.forEach(token => {
          if (token && typeof token === 'string') {
            if (token.startsWith('ExponentPushToken[')) {
              expoTokens.push(token);
            } else {
              fcmTokens.push(token);
            }
          }
        });

        // Incrementar badgeCount para este usuario
        const currentBadge = userData?.badgeCount || 0;
        const newBadgeCount = currentBadge + 1;

        batch.update(userDoc.ref, {
          badgeCount: newBadgeCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (userError) {
        logger.error(`Error procesando usuario ${recipientId}:`, userError);
      }
    }

    // Verificación final de tokens
    logger.log(`Tokens FCM: ${fcmTokens.length}, Tokens Expo: ${expoTokens.length}`);

    // Confirmar todas las actualizaciones de badge
    try {
      await batch.commit();
      logger.log(
        "Contadores de badge actualizados correctamente.",
        { orderId }
      );
    } catch (batchError) {
      logger.error(
        "Error al confirmar el batch de actualización de badges:",
        batchError
      );
      // Continuar con el envío de notificaciones si es posible
    }

    // Verificar si hay tokens para notificar
    if (fcmTokens.length === 0 && expoTokens.length === 0) {
      logger.log(
        "No se encontraron tokens válidos para enviar notificaciones.",
        { orderId }
      );
      return null;
    }

    // Obtener el badgeCount del primer destinatario
    let badgeCountNumber = 1; 
    try {
      if (recipientIds.length > 0) {
        const firstRecipientDoc = await admin
          .firestore()
          .collection("users")
          .doc(recipientIds[0])
          .get();
        if (firstRecipientDoc.exists) {
          const firstRecipientData =
              firstRecipientDoc.data() as UserData | undefined;
          badgeCountNumber = firstRecipientData?.badgeCount || 1;
        }
      }
    } catch (badgeError) {
      logger.warn(
        "No se pudo obtener el badgeCount actualizado " +
            "para la notificación:",
        badgeError
      );
    }

    // Resultados para retornar
    const results = {
      success: true,
      fcmSent: 0,
      fcmFailed: 0,
      expoSent: 0,
      expoFailed: 0
    };

    // Si hay tokens FCM, enviar notificaciones por FCM
    if (fcmTokens.length > 0) {
      // Datos para la notificación FCM
      const fcmPayload: admin.messaging.MulticastMessage = {
        data: {
          type: "order_new",
          orderId: orderId,
          businessId: businessId,
          orderNumber: orderNumber,
          total: String(total),
        },
        tokens: fcmTokens,
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: badgeCountNumber,
              contentAvailable: true,
              alert: {
                title: notificationTitle,
                body: notificationBody,
              },
            },
          },
        },
        android: {
          notification: {
            title: notificationTitle,
            body: notificationBody,
            sound: "default",
          },
          priority: "high",
        },
      };

      logger.log(
        `Enviando notificación FCM a ${fcmTokens.length} tokens`,
        { orderId }
      );

      try {
        const response = await admin.messaging().sendEachForMulticast(fcmPayload);
        results.fcmSent = response.successCount;
        results.fcmFailed = response.failureCount;

        logger.log(
          `Notificaciones FCM enviadas - Éxitos: ${response.successCount}, ` +
              `Fallos: ${response.failureCount}`,
          { orderId }
        );

        // Manejar tokens inválidos
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              logger.warn(
                `Error enviando a token FCM ${fcmTokens[idx]}: ` +
                    `${resp.error?.message}`,
              );
            }
          });
        }
      } catch (fcmError) {
        logger.error("Error al enviar notificaciones FCM:", fcmError);
      }
    }

    // Si hay tokens Expo, enviar notificaciones por Expo
    if (expoTokens.length > 0) {
      // Filtrar tokens Expo válidos
      const validExpoTokens = expoTokens.filter(token => Expo.isExpoPushToken(token));
      
      if (validExpoTokens.length !== expoTokens.length) {
        logger.warn(`Se detectaron ${expoTokens.length - validExpoTokens.length} tokens Expo inválidos`);
      }

      if (validExpoTokens.length > 0) {
        // Crear mensajes para Expo
        const expoMessages: ExpoPushMessage[] = validExpoTokens.map(token => ({
          to: token,
          sound: 'default',
          title: notificationTitle,
          body: notificationBody,
          badge: badgeCountNumber,
          priority: 'high',
          channelId: 'orders',
          _displayInForeground: true,
          data: {
            type: "order_new",
            orderId: orderId,
            businessId: businessId,
            orderNumber: orderNumber,
            total: String(total),
            experienceId: '@username/app-slug', // Reemplazar con el experienceId de tu app
            scopeKey: '@username/app-slug', // Mismo que experienceId
          },
        }));

        logger.log(
          `Enviando notificación Expo a ${validExpoTokens.length} tokens`,
          { orderId }
        );

        try {
          // Crear chunks de mensajes (recomendado por Expo)
          const chunks = expo.chunkPushNotifications(expoMessages);
          
          // Enviar cada chunk
          for (const chunk of chunks) {
            try {
              const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
              
              // Contar éxitos y fallos
              ticketChunk.forEach((ticket: ExpoPushTicket) => {
                if (ticket.status === 'ok') {
                  results.expoSent++;
                } else {
                  results.expoFailed++;
                  logger.warn(`Error enviando notificación Expo: ${ticket.message}`);
                }
              });
            } catch (chunkError) {
              logger.error("Error al enviar chunk de notificaciones Expo:", chunkError);
              results.expoFailed += chunk.length;
            }
          }

          logger.log(
            `Notificaciones Expo enviadas - Éxitos: ${results.expoSent}, ` +
                `Fallos: ${results.expoFailed}`,
            { orderId }
          );
        } catch (expoError) {
          logger.error("Error al enviar notificaciones Expo:", expoError);
        }
      }
    }

    return results;
  } catch (error) {
    logger.error(
      "Error al enviar notificación de nuevo pedido:",
      error,
      { orderId }
    );
    return null;
  }
});

/**
 * Función que se activa cuando se actualiza el estado de un pedido y envía
 * notificaciones push al cliente.
 */
export const sendOrderStatusNotification = onDocumentUpdated("orders/{orderId}", async (event) => {
  const orderId = event.params.orderId;
  const newOrderData = event.data?.after.data();
  const previousOrderData = event.data?.before.data();

  if (!newOrderData || !previousOrderData) {
    logger.log(`Datos insuficientes para el pedido ${orderId}, omitiendo notificación`);
    return null;
  }

  try {
    // Verificar si cambió el estado del pedido
    if (newOrderData.status === previousOrderData.status) {
      logger.log(`No hubo cambio en el estado del pedido ${orderId}, omitiendo notificación`);
      return null;
    }

    logger.log(
      `Actualización de estado de pedido detectada - ID: ${orderId}, ` +
      `estado anterior: ${previousOrderData.status}, ` +
      `nuevo estado: ${newOrderData.status}`
    );

    // Preparar título y cuerpo de la notificación según el estado
    let notificationTitle = "Estado del Pedido Actualizado";
    let notificationBody = `Tu pedido ${newOrderData.orderNumber || orderId} `;

    switch (newOrderData.status) {
      case 'paid':
        notificationBody += "ha sido pagado con éxito.";
        break;
      case 'preparing':
        notificationBody += "está siendo preparado.";
        break;
      case 'in_transit':
        notificationBody += "está en camino.";
        break;
      case 'delivered':
        notificationTitle = "¡Pedido Entregado!";
        notificationBody += "ha sido entregado con éxito.";
        break;
      case 'canceled':
        notificationTitle = "Pedido Cancelado";
        notificationBody += "ha sido cancelado.";
        break;
      case 'refunded':
        notificationTitle = "Pedido Reembolsado";
        notificationBody += "ha sido reembolsado.";
        break;
      default:
        notificationBody += `ahora está en estado: ${newOrderData.status}.`;
    }

    // Determinar destinatarios: siempre el cliente (userId)
    // Para estados como 'cancelado', notificar también al dueño
    const recipientIds: string[] = [];
    
    // Añadir cliente
    const userId = newOrderData.userId;
    if (userId) {
      recipientIds.push(userId);
    }

    // Si el pedido fue cancelado, notificar también al dueño/admin
    if (newOrderData.status === 'canceled' || newOrderData.status === 'refunded') {
      const businessId = newOrderData.businessId;
      
      // Buscar dueño en el documento del negocio
      const businessDoc = await admin.firestore()
        .collection("businesses")
        .doc(businessId)
        .get();

      if (businessDoc.exists) {
        const businessData = businessDoc.data();
        const ownerId = businessData?.ownerId;
        
        // Asegurarse de no duplicar destinatarios
        if (ownerId && typeof ownerId === 'string' && ownerId !== userId) {
          recipientIds.push(ownerId);
        }
      }
    }

    if (recipientIds.length === 0) {
      logger.log(
        "No se encontraron destinatarios para la notificación de estado de pedido",
        { orderId }
      );
      return null;
    }

    logger.log(
      `Enviando notificación a ${recipientIds.length} destinatarios`,
      { orderId }
    );

    // Lotes de actualización para eficiencia
    const batch = admin.firestore().batch();
    const fcmTokens: string[] = []; // Lista para tokens de FCM
    const expoTokens: string[] = []; // Lista para tokens de Expo

    // Para cada destinatario, obtener sus tokens y preparar notificación
    for (const recipientId of recipientIds) {
      try {
        // Obtener datos del usuario
        const userDoc = await admin
          .firestore()
          .collection("users")
          .doc(recipientId)
          .get();

        if (!userDoc.exists) {
          logger.log(
            `Usuario ${recipientId} no encontrado, omitiendo notificación`
          );
          continue;
        }

        const userData = userDoc.data() as UserData | undefined;
        const userTokens: string[] = [];

        // Token principal (si existe)
        if (userData?.notificationToken) {
          userTokens.push(userData.notificationToken);
        }

        // Tokens de dispositivos adicionales
        if (userData?.devices && Array.isArray(userData.devices)) {
          userData.devices.forEach((device) => {
            if (device && device.token && !userTokens.includes(device.token)) {
              userTokens.push(device.token);
            }
          });
        }

        if (userTokens.length === 0) {
          logger.log(
            `Usuario ${recipientId} no tiene tokens registrados, ` +
                "omitiendo notificación"
          );
          continue;
        }

        // Clasificar tokens según su tipo (Expo o FCM)
        userTokens.forEach(token => {
          if (token && typeof token === 'string') {
            if (token.startsWith('ExponentPushToken[')) {
              expoTokens.push(token);
            } else {
              fcmTokens.push(token);
            }
          }
        });

        // Incrementar badgeCount para este usuario
        const currentBadge = userData?.badgeCount || 0;
        const newBadgeCount = currentBadge + 1;

        batch.update(userDoc.ref, {
          badgeCount: newBadgeCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (userError) {
        logger.error(`Error procesando usuario ${recipientId}:`, userError);
      }
    }

    // Verificación final de tokens
    logger.log(`Tokens FCM: ${fcmTokens.length}, Tokens Expo: ${expoTokens.length}`);

    // Confirmar todas las actualizaciones de badge
    try {
      await batch.commit();
      logger.log(
        "Contadores de badge actualizados correctamente.",
        { orderId }
      );
    } catch (batchError) {
      logger.error(
        "Error al confirmar el batch de actualización de badges:",
        batchError
      );
      // Continuar con el envío de notificaciones si es posible
    }

    // Verificar si hay tokens para notificar
    if (fcmTokens.length === 0 && expoTokens.length === 0) {
      logger.log(
        "No se encontraron tokens válidos para enviar notificaciones.",
        { orderId }
      );
      return null;
    }

    // Obtener el badgeCount del primer destinatario
    let badgeCountNumber = 1; 
    try {
      if (recipientIds.length > 0) {
        const firstRecipientDoc = await admin
          .firestore()
          .collection("users")
          .doc(recipientIds[0])
          .get();
        if (firstRecipientDoc.exists) {
          const firstRecipientData =
              firstRecipientDoc.data() as UserData | undefined;
          badgeCountNumber = firstRecipientData?.badgeCount || 1;
        }
      }
    } catch (badgeError) {
      logger.warn(
        "No se pudo obtener el badgeCount actualizado " +
            "para la notificación:",
        badgeError
      );
    }

    // Resultados para retornar
    const results = {
      success: true,
      fcmSent: 0,
      fcmFailed: 0,
      expoSent: 0,
      expoFailed: 0
    };

    // Si hay tokens FCM, enviar notificaciones por FCM
    if (fcmTokens.length > 0) {
      // Datos para la notificación FCM
      const fcmPayload: admin.messaging.MulticastMessage = {
        data: {
          type: "order_status",
          orderId: orderId,
          businessId: newOrderData.businessId,
          orderNumber: newOrderData.orderNumber || '',
          status: newOrderData.status,
        },
        tokens: fcmTokens,
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: badgeCountNumber,
              contentAvailable: true,
              alert: {
                title: notificationTitle,
                body: notificationBody,
              },
            },
          },
        },
        android: {
          notification: {
            title: notificationTitle,
            body: notificationBody,
            sound: "default",
          },
          priority: "high",
        },
      };

      logger.log(
        `Enviando notificación FCM a ${fcmTokens.length} tokens`,
        { orderId }
      );

      try {
        const response = await admin.messaging().sendEachForMulticast(fcmPayload);
        results.fcmSent = response.successCount;
        results.fcmFailed = response.failureCount;

        logger.log(
          `Notificaciones FCM enviadas - Éxitos: ${response.successCount}, ` +
              `Fallos: ${response.failureCount}`,
          { orderId }
        );

        // Manejar tokens inválidos
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              logger.warn(
                `Error enviando a token FCM ${fcmTokens[idx]}: ` +
                    `${resp.error?.message}`,
              );
            }
          });
        }
      } catch (fcmError) {
        logger.error("Error al enviar notificaciones FCM:", fcmError);
      }
    }

    // Si hay tokens Expo, enviar notificaciones por Expo
    if (expoTokens.length > 0) {
      // Filtrar tokens Expo válidos
      const validExpoTokens = expoTokens.filter(token => Expo.isExpoPushToken(token));
      
      if (validExpoTokens.length !== expoTokens.length) {
        logger.warn(`Se detectaron ${expoTokens.length - validExpoTokens.length} tokens Expo inválidos`);
      }

      if (validExpoTokens.length > 0) {
        // Crear mensajes para Expo
        const expoMessages: ExpoPushMessage[] = validExpoTokens.map(token => ({
          to: token,
          sound: 'default',
          title: notificationTitle,
          body: notificationBody,
          badge: badgeCountNumber,
          priority: 'high',
          channelId: 'orders',
          _displayInForeground: true,
          data: {
            type: "order_status",
            orderId: orderId,
            businessId: newOrderData.businessId,
            orderNumber: newOrderData.orderNumber || '',
            status: newOrderData.status,
            experienceId: '@username/app-slug', // Reemplazar con el experienceId de tu app
            scopeKey: '@username/app-slug', // Mismo que experienceId
          },
        }));

        logger.log(
          `Enviando notificación Expo a ${validExpoTokens.length} tokens`,
          { orderId }
        );

        try {
          // Crear chunks de mensajes (recomendado por Expo)
          const chunks = expo.chunkPushNotifications(expoMessages);
          
          // Enviar cada chunk
          for (const chunk of chunks) {
            try {
              const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
              
              // Contar éxitos y fallos
              ticketChunk.forEach((ticket: ExpoPushTicket) => {
                if (ticket.status === 'ok') {
                  results.expoSent++;
                } else {
                  results.expoFailed++;
                  logger.warn(`Error enviando notificación Expo: ${ticket.message}`);
                }
              });
            } catch (chunkError) {
              logger.error("Error al enviar chunk de notificaciones Expo:", chunkError);
              results.expoFailed += chunk.length;
            }
          }

          logger.log(
            `Notificaciones Expo enviadas - Éxitos: ${results.expoSent}, ` +
                `Fallos: ${results.expoFailed}`,
            { orderId }
          );
        } catch (expoError) {
          logger.error("Error al enviar notificaciones Expo:", expoError);
        }
      }
    }

    return results;
  } catch (error) {
    logger.error(
      "Error al enviar notificación de actualización de estado de pedido:",
      error,
      { orderId }
    );
    return null;
  }
});

/**
 * Function that sends notification when a new reservation is created
 */
export const sendNewReservationNotification = onDocumentCreated("reservations/{reservationId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.error("No hay datos en el evento");
    return null;
  }

  const reservationData = snapshot.data();
  const { reservationId } = event.params;

  if (!reservationData) {
    logger.error("Reserva sin datos válidos", { reservationId });
    return null;
  }

  try {
    logger.log("Nueva reserva detectada", { 
      reservationId, 
      businessId: reservationData.businessId,
      userId: reservationData.userId
    });

    // Extract needed data from the reservation
    const { businessId, businessName, userId, userName, date, time, partySize, status } = reservationData;

    if (!businessId || !userId) {
      logger.error("Reserva sin businessId o userId", { reservationId });
      return null;
    }

    // Format the date for the notification
    let formattedDate = "fecha no disponible";
    if (date) {
      try {
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        formattedDate = dateObj.toLocaleDateString('es-ES', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } catch (dateError) {
        logger.warn("Error formateando fecha de reserva", { dateError });
        formattedDate = "fecha pendiente";
      }
    }

    // Different notification content for business owner vs customer
    const businessNotificationTitle = "Nueva Reserva";
    const businessNotificationBody = `${userName} ha realizado una reserva para ${partySize} personas el ${formattedDate} a las ${time}`;
    
    const customerNotificationTitle = "Reserva Recibida";
    const customerNotificationBody = `Tu reserva en ${businessName} para el ${formattedDate} a las ${time} ha sido registrada y está pendiente de confirmación`;

    // 1. Find business owner and admins to notify
    const businessDoc = await admin.firestore().collection("businesses").doc(businessId).get();
    
    if (!businessDoc.exists) {
      logger.error("El negocio no existe", { businessId });
      return null;
    }
    
    const businessData = businessDoc.data();
    const businessOwnerIds: string[] = [];
    
    if (businessData?.ownerId) {
      businessOwnerIds.push(businessData.ownerId);
    }
    
    // Also check for business_permissions collection for admins/managers
    try {
      const permissionsSnapshot = await admin.firestore()
        .collection("business_permissions")
        .where("businessId", "==", businessId)
        .where("role", "in", ["owner", "admin", "manager"])
        .get();
      
      permissionsSnapshot.forEach(doc => {
        const permissionData = doc.data();
        if (permissionData.userId && !businessOwnerIds.includes(permissionData.userId)) {
          businessOwnerIds.push(permissionData.userId);
        }
      });
    } catch (permissionsError) {
      logger.warn("Error obteniendo permisos de negocio", { permissionsError });
      // Continue with just the owner
    }
    
    if (businessOwnerIds.length === 0) {
      logger.warn("No se encontraron dueños/administradores para notificar", { businessId });
    } else {
      logger.log(`Notificando a ${businessOwnerIds.length} dueños/administradores del negocio`, { businessId });
    }

    // 2. Prepare to collect notification tokens
    const batch = admin.firestore().batch();
    
    // Separated tokens for business owners and customer
    const ownerFcmTokens: string[] = [];
    const ownerExpoTokens: string[] = [];
    const customerFcmTokens: string[] = [];
    const customerExpoTokens: string[] = [];
    
    const results = {
      businessOwnersUpdated: 0,
      customerUpdated: 0,
      fcmSent: 0,
      fcmFailed: 0,
      expoSent: 0,
      expoFailed: 0
    };

    // 3. Get and update business owners/admins (increment badge count)
    for (const ownerId of businessOwnerIds) {
      try {
        const ownerDoc = await admin.firestore().collection("users").doc(ownerId).get();
        
        if (!ownerDoc.exists) {
          logger.warn(`El usuario dueño/admin ${ownerId} no existe`);
          continue;
        }
        
        const ownerData = ownerDoc.data();
        const currentBadgeCount = ownerData?.badgeCount || 0;
        const newBadgeCount = currentBadgeCount + 1;
        
        // Update badge count
        batch.update(ownerDoc.ref, { 
          badgeCount: newBadgeCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        results.businessOwnersUpdated++;
        
        // Collect notification tokens
        if (ownerData?.notificationToken) {
          if (ownerData.notificationToken.startsWith('ExponentPushToken[')) {
            ownerExpoTokens.push(ownerData.notificationToken);
          } else {
            ownerFcmTokens.push(ownerData.notificationToken);
          }
        }
        
        // Check for additional device tokens
        if (ownerData?.devices && Array.isArray(ownerData.devices)) {
          ownerData.devices.forEach(device => {
            if (device?.token) {
              if (device.token.startsWith('ExponentPushToken[')) {
                if (!ownerExpoTokens.includes(device.token)) {
                  ownerExpoTokens.push(device.token);
                }
              } else {
                if (!ownerFcmTokens.includes(device.token)) {
                  ownerFcmTokens.push(device.token);
                }
              }
            }
          });
        }
      } catch (ownerError) {
        logger.error(`Error procesando dueño/admin ${ownerId}`, { ownerError });
      }
    }

    // 4. Get and update customer (increment badge count)
    try {
      const customerDoc = await admin.firestore().collection("users").doc(userId).get();
      
      if (customerDoc.exists) {
        const customerData = customerDoc.data();
        const currentBadgeCount = customerData?.badgeCount || 0;
        const newBadgeCount = currentBadgeCount + 1;
        
        // Update badge count
        batch.update(customerDoc.ref, { 
          badgeCount: newBadgeCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        results.customerUpdated = 1;
        
        // Collect customer notification tokens
        if (customerData?.notificationToken) {
          if (customerData.notificationToken.startsWith('ExponentPushToken[')) {
            customerExpoTokens.push(customerData.notificationToken);
          } else {
            customerFcmTokens.push(customerData.notificationToken);
          }
        }
        
        // Check for additional device tokens
        if (customerData?.devices && Array.isArray(customerData.devices)) {
          customerData.devices.forEach(device => {
            if (device?.token) {
              if (device.token.startsWith('ExponentPushToken[')) {
                if (!customerExpoTokens.includes(device.token)) {
                  customerExpoTokens.push(device.token);
                }
              } else {
                if (!customerFcmTokens.includes(device.token)) {
                  customerFcmTokens.push(device.token);
                }
              }
            }
          });
        }
      } else {
        logger.warn(`El usuario cliente ${userId} no existe`);
      }
    } catch (customerError) {
      logger.error(`Error procesando cliente ${userId}`, { customerError });
    }

    // 5. Commit badge count updates
    try {
      await batch.commit();
      logger.log("Actualizaciones de badge count aplicadas", { 
        businessOwnersUpdated: results.businessOwnersUpdated,
        customerUpdated: results.customerUpdated 
      });
    } catch (batchError) {
      logger.error("Error al confirmar el batch de actualización de badges:", batchError);
      // Continue with sending notifications if possible
    }

    // 6. Send FCM notifications
    // 6.1 Send to business owners
    if (ownerFcmTokens.length > 0) {
      try {
        const businessPayload: admin.messaging.MulticastMessage = {
          data: {
            type: "reservation_new",
            reservationId,
            businessId,
            userId,
            status
          },
          tokens: ownerFcmTokens,
          notification: {
            title: businessNotificationTitle,
            body: businessNotificationBody
          },
          android: {
            priority: "high"
          },
          apns: {
            payload: {
              aps: {
                badge: 1,
                sound: "default"
              }
            }
          }
        };
        
        const businessResponse = await admin.messaging().sendEachForMulticast(businessPayload);
        results.fcmSent += businessResponse.successCount;
        results.fcmFailed += businessResponse.failureCount;
        
        logger.log(`Notificaciones FCM enviadas a dueños/admins - Éxitos: ${businessResponse.successCount}, Fallos: ${businessResponse.failureCount}`);
      } catch (fcmError) {
        logger.error("Error al enviar notificaciones FCM a dueños/admins", { fcmError });
      }
    }
    
    // 6.2 Send to customer
    if (customerFcmTokens.length > 0) {
      try {
        const customerPayload: admin.messaging.MulticastMessage = {
          data: {
            type: "reservation_new",
            reservationId,
            businessId,
            userId,
            status
          },
          tokens: customerFcmTokens,
          notification: {
            title: customerNotificationTitle,
            body: customerNotificationBody
          },
          android: {
            priority: "high"
          },
          apns: {
            payload: {
              aps: {
                badge: 1,
                sound: "default"
              }
            }
          }
        };
        
        const customerResponse = await admin.messaging().sendEachForMulticast(customerPayload);
        results.fcmSent += customerResponse.successCount;
        results.fcmFailed += customerResponse.failureCount;
        
        logger.log(`Notificaciones FCM enviadas a cliente - Éxitos: ${customerResponse.successCount}, Fallos: ${customerResponse.failureCount}`);
      } catch (fcmError) {
        logger.error("Error al enviar notificaciones FCM a cliente", { fcmError });
      }
    }

    // 7. Send Expo notifications
    // 7.1 Send to business owners
    if (ownerExpoTokens.length > 0) {
      try {
        // Filter valid Expo tokens
        const validOwnerExpoTokens = ownerExpoTokens.filter(token => Expo.isExpoPushToken(token));
        
        if (validOwnerExpoTokens.length > 0) {
          // Create Expo messages
          const ownerExpoMessages: ExpoPushMessage[] = validOwnerExpoTokens.map(token => ({
            to: token,
            sound: 'default',
            title: businessNotificationTitle,
            body: businessNotificationBody,
            badge: 1,
            priority: 'high',
            channelId: 'reservations',
            _displayInForeground: true,
            data: {
              type: "reservation_new",
              reservationId,
              businessId,
              userId,
              status,
              experienceId: '@username/app-slug', // Replace with your app's experienceId
              scopeKey: '@username/app-slug', // Same as experienceId
            },
          }));
          
          // Create chunks of messages (recommended by Expo)
          const ownerChunks = expo.chunkPushNotifications(ownerExpoMessages);
          
          // Send each chunk
          for (const chunk of ownerChunks) {
            try {
              const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
              
              // Count successes and failures
              ticketChunk.forEach((ticket: ExpoPushTicket) => {
                if (ticket.status === 'ok') {
                  results.expoSent++;
                } else {
                  results.expoFailed++;
                  logger.warn(`Error enviando notificación Expo: ${ticket.message}`);
                }
              });
            } catch (chunkError) {
              logger.error("Error al enviar chunk de notificaciones Expo a dueños/admins:", chunkError);
              results.expoFailed += chunk.length;
            }
          }
          
          logger.log(`Notificaciones Expo enviadas a dueños/admins - Éxitos: ${results.expoSent}, Fallos: ${results.expoFailed}`);
        }
      } catch (expoError) {
        logger.error("Error al enviar notificaciones Expo a dueños/admins:", expoError);
      }
    }
    
    // 7.2 Send to customer
    if (customerExpoTokens.length > 0) {
      try {
        // Filter valid Expo tokens
        const validCustomerExpoTokens = customerExpoTokens.filter(token => Expo.isExpoPushToken(token));
        
        if (validCustomerExpoTokens.length > 0) {
          // Create Expo messages
          const customerExpoMessages: ExpoPushMessage[] = validCustomerExpoTokens.map(token => ({
            to: token,
            sound: 'default',
            title: customerNotificationTitle,
            body: customerNotificationBody,
            badge: 1,
            priority: 'high',
            channelId: 'reservations',
            _displayInForeground: true,
            data: {
              type: "reservation_new",
              reservationId,
              businessId,
              userId,
              status,
              experienceId: '@username/app-slug', // Replace with your app's experienceId
              scopeKey: '@username/app-slug', // Same as experienceId
            },
          }));
          
          // Create chunks of messages (recommended by Expo)
          const customerChunks = expo.chunkPushNotifications(customerExpoMessages);
          
          // Send each chunk
          for (const chunk of customerChunks) {
            try {
              const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
              
              // Count successes and failures
              ticketChunk.forEach((ticket: ExpoPushTicket) => {
                if (ticket.status === 'ok') {
                  results.expoSent++;
                } else {
                  results.expoFailed++;
                  logger.warn(`Error enviando notificación Expo: ${ticket.message}`);
                }
              });
            } catch (chunkError) {
              logger.error("Error al enviar chunk de notificaciones Expo a cliente:", chunkError);
              results.expoFailed += chunk.length;
            }
          }
          
          logger.log(`Notificaciones Expo enviadas a cliente - Éxitos: ${results.expoSent}, Fallos: ${results.expoFailed}`);
        }
      } catch (expoError) {
        logger.error("Error al enviar notificaciones Expo a cliente:", expoError);
      }
    }

    // 8. Return results
    logger.log("Procesamiento de notificación de nueva reserva completado", { results });
    return results;
  } catch (error) {
    logger.error("Error general en sendNewReservationNotification", { error });
    return null;
  }
});

/**
 * Function that sends notification when a reservation status is updated
 */
export const sendReservationStatusUpdateNotification = onDocumentUpdated("reservations/{reservationId}", async (event) => {
  const beforeSnapshot = event.data?.before;
  const afterSnapshot = event.data?.after;
  
  if (!beforeSnapshot || !afterSnapshot) {
    logger.error("No hay datos en el evento de actualización");
    return null;
  }
  
  const beforeData = beforeSnapshot.data();
  const afterData = afterSnapshot.data();
  const { reservationId } = event.params;
  
  if (!beforeData || !afterData) {
    logger.error("Datos faltantes en actualización de reserva", { reservationId });
    return null;
  }
  
  // Check if status has changed
  if (beforeData.status === afterData.status) {
    logger.log("El estado de la reserva no cambió, omitiendo notificación", { 
      reservationId, 
      status: afterData.status 
    });
    return null;
  }
  
  try {
    logger.log("Cambio de estado de reserva detectado", { 
      reservationId, 
      oldStatus: beforeData.status,
      newStatus: afterData.status
    });
    
    // Extract needed data
    const { businessId, businessName, userId, userName, date, time, partySize, status } = afterData;
    
    if (!businessId || !userId) {
      logger.error("Reserva sin businessId o userId", { reservationId });
      return null;
    }
    
    // Format the date for the notification
    let formattedDate = "fecha no disponible";
    if (date) {
      try {
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        formattedDate = dateObj.toLocaleDateString('es-ES', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } catch (dateError) {
        logger.warn("Error formateando fecha de reserva", { dateError });
        formattedDate = "fecha pendiente";
      }
    }
    
    // Different messages based on the new status
    let customerNotificationTitle = "Actualización de Reserva";
    let customerNotificationBody = "";
    
    switch (status) {
      case "confirmed":
        customerNotificationTitle = "Reserva Confirmada";
        customerNotificationBody = `¡Tu reserva en ${businessName} para el ${formattedDate} a las ${time} ha sido confirmada!`;
        break;
      case "canceled":
        customerNotificationTitle = "Reserva Cancelada";
        customerNotificationBody = `Tu reserva en ${businessName} para el ${formattedDate} a las ${time} ha sido cancelada.`;
        break;
      case "completed":
        customerNotificationTitle = "Reserva Completada";
        customerNotificationBody = `¡Gracias por visitarnos! Tu reserva en ${businessName} ha sido marcada como completada.`;
        break;
      default:
        customerNotificationTitle = "Actualización de Reserva";
        customerNotificationBody = `El estado de tu reserva en ${businessName} para el ${formattedDate} a las ${time} ha cambiado a "${status}".`;
    }
    
    // Also notify business owner if customer cancels
    let shouldNotifyBusiness = false;
    let businessNotificationTitle = "";
    let businessNotificationBody = "";
    
    if (status === "canceled" && afterData.canceledBy === "customer") {
      shouldNotifyBusiness = true;
      businessNotificationTitle = "Reserva Cancelada por Cliente";
      businessNotificationBody = `${userName} ha cancelado su reserva para ${partySize} personas el ${formattedDate} a las ${time}.`;
    }
    
    // Prepare tokens and batch update
    const customerFcmTokens: string[] = [];
    const customerExpoTokens: string[] = [];
    const ownerFcmTokens: string[] = [];
    const ownerExpoTokens: string[] = [];
    const batch = admin.firestore().batch();
    
    const results = {
      customerUpdated: 0,
      businessUpdated: 0,
      fcmSent: 0,
      fcmFailed: 0,
      expoSent: 0,
      expoFailed: 0
    };
    
    // Get and update customer for notification
    try {
      const customerDoc = await admin.firestore().collection("users").doc(userId).get();
      
      if (customerDoc.exists) {
        const customerData = customerDoc.data();
        const currentBadgeCount = customerData?.badgeCount || 0;
        const newBadgeCount = currentBadgeCount + 1;
        
        // Update badge count
        batch.update(customerDoc.ref, { 
          badgeCount: newBadgeCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        results.customerUpdated = 1;
        
        // Collect customer notification tokens
        if (customerData?.notificationToken) {
          if (customerData.notificationToken.startsWith('ExponentPushToken[')) {
            customerExpoTokens.push(customerData.notificationToken);
          } else {
            customerFcmTokens.push(customerData.notificationToken);
          }
        }
        
        // Check for additional device tokens
        if (customerData?.devices && Array.isArray(customerData.devices)) {
          customerData.devices.forEach(device => {
            if (device?.token) {
              if (device.token.startsWith('ExponentPushToken[')) {
                if (!customerExpoTokens.includes(device.token)) {
                  customerExpoTokens.push(device.token);
                }
              } else {
                if (!customerFcmTokens.includes(device.token)) {
                  customerFcmTokens.push(device.token);
                }
              }
            }
          });
        }
      } else {
        logger.warn(`El usuario ${userId} no existe`);
      }
    } catch (customerError) {
      logger.error(`Error procesando cliente ${userId}:`, customerError);
    }
    
    // If we need to notify business owner too
    const businessOwnerIds: string[] = [];
    if (shouldNotifyBusiness) {
      // Get business owner ID
      try {
        const businessDoc = await admin.firestore().collection("businesses").doc(businessId).get();
        
        if (businessDoc.exists) {
          const businessData = businessDoc.data();
          if (businessData?.ownerId) {
            businessOwnerIds.push(businessData.ownerId);
          }
          
          // Also check for business_permissions collection for admins/managers
          try {
            const permissionsSnapshot = await admin.firestore()
              .collection("business_permissions")
              .where("businessId", "==", businessId)
              .where("role", "in", ["owner", "admin", "manager"])
              .get();
            
            permissionsSnapshot.forEach(doc => {
              const permissionData = doc.data();
              if (permissionData.userId && !businessOwnerIds.includes(permissionData.userId)) {
                businessOwnerIds.push(permissionData.userId);
              }
            });
          } catch (permissionsError) {
            logger.warn("Error obteniendo permisos de negocio", { permissionsError });
            // Continue with just the owner
          }
          
          // Get and update owners/admins
          for (const ownerId of businessOwnerIds) {
            try {
              const ownerDoc = await admin.firestore().collection("users").doc(ownerId).get();
              
              if (!ownerDoc.exists) {
                logger.warn(`El usuario dueño/admin ${ownerId} no existe`);
                continue;
              }
              
              const ownerData = ownerDoc.data();
              const currentBadgeCount = ownerData?.badgeCount || 0;
              const newBadgeCount = currentBadgeCount + 1;
              
              // Update badge count
              batch.update(ownerDoc.ref, { 
                badgeCount: newBadgeCount,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              
              results.businessUpdated++;
              
              // Collect notification tokens
              if (ownerData?.notificationToken) {
                if (ownerData.notificationToken.startsWith('ExponentPushToken[')) {
                  ownerExpoTokens.push(ownerData.notificationToken);
                } else {
                  ownerFcmTokens.push(ownerData.notificationToken);
                }
              }
              
              // Check for additional device tokens
              if (ownerData?.devices && Array.isArray(ownerData.devices)) {
                ownerData.devices.forEach(device => {
                  if (device?.token) {
                    if (device.token.startsWith('ExponentPushToken[')) {
                      if (!ownerExpoTokens.includes(device.token)) {
                        ownerExpoTokens.push(device.token);
                      }
                    } else {
                      if (!ownerFcmTokens.includes(device.token)) {
                        ownerFcmTokens.push(device.token);
                      }
                    }
                  }
                });
              }
            } catch (ownerError) {
              logger.error(`Error procesando dueño/admin ${ownerId}:`, ownerError);
            }
          }
        } else {
          logger.warn(`El negocio ${businessId} no existe`);
        }
      } catch (businessError) {
        logger.error(`Error obteniendo información del negocio ${businessId}:`, businessError);
      }
    }
    
    // Commit badge count updates
    try {
      await batch.commit();
      logger.log("Actualizaciones de badge count aplicadas", { 
        customerUpdated: results.customerUpdated,
        businessUpdated: results.businessUpdated
      });
    } catch (batchError) {
      logger.error("Error al confirmar el batch de actualización de badges:", batchError);
      // Continue with sending notifications if possible
    }
    
    // Send FCM notifications to customer
    if (customerFcmTokens.length > 0) {
      try {
        const customerPayload: admin.messaging.MulticastMessage = {
          data: {
            type: "reservation_status",
            reservationId,
            businessId,
            userId,
            status
          },
          tokens: customerFcmTokens,
          notification: {
            title: customerNotificationTitle,
            body: customerNotificationBody
          },
          android: {
            priority: "high"
          },
          apns: {
            payload: {
              aps: {
                badge: 1,
                sound: "default"
              }
            }
          }
        };
        
        const customerResponse = await admin.messaging().sendEachForMulticast(customerPayload);
        results.fcmSent += customerResponse.successCount;
        results.fcmFailed += customerResponse.failureCount;
        
        logger.log(`Notificaciones FCM enviadas a cliente - Éxitos: ${customerResponse.successCount}, Fallos: ${customerResponse.failureCount}`);
      } catch (fcmError) {
        logger.error("Error al enviar notificaciones FCM a cliente:", fcmError);
      }
    }
    
    // Send FCM notifications to business owners if needed
    if (shouldNotifyBusiness && ownerFcmTokens.length > 0) {
      try {
        const businessPayload: admin.messaging.MulticastMessage = {
          data: {
            type: "reservation_status",
            reservationId,
            businessId,
            userId,
            status
          },
          tokens: ownerFcmTokens,
          notification: {
            title: businessNotificationTitle,
            body: businessNotificationBody
          },
          android: {
            priority: "high"
          },
          apns: {
            payload: {
              aps: {
                badge: 1,
                sound: "default"
              }
            }
          }
        };
        
        const businessResponse = await admin.messaging().sendEachForMulticast(businessPayload);
        results.fcmSent += businessResponse.successCount;
        results.fcmFailed += businessResponse.failureCount;
        
        logger.log(`Notificaciones FCM enviadas a dueños/admins - Éxitos: ${businessResponse.successCount}, Fallos: ${businessResponse.failureCount}`);
      } catch (fcmError) {
        logger.error("Error al enviar notificaciones FCM a dueños/admins:", fcmError);
      }
    }
    
    // Send Expo notifications to customer
    if (customerExpoTokens.length > 0) {
      try {
        // Filter valid Expo tokens
        const validCustomerExpoTokens = customerExpoTokens.filter(token => Expo.isExpoPushToken(token));
        
        if (validCustomerExpoTokens.length > 0) {
          // Create Expo messages
          const customerExpoMessages: ExpoPushMessage[] = validCustomerExpoTokens.map(token => ({
            to: token,
            sound: 'default',
            title: customerNotificationTitle,
            body: customerNotificationBody,
            badge: 1,
            priority: 'high',
            channelId: 'reservations',
            _displayInForeground: true,
            data: {
              type: "reservation_status",
              reservationId,
              businessId,
              userId,
              status,
              experienceId: '@username/app-slug', // Replace with your app's experienceId
              scopeKey: '@username/app-slug', // Same as experienceId
            },
          }));
          
          // Create chunks of messages (recommended by Expo)
          const customerChunks = expo.chunkPushNotifications(customerExpoMessages);
          
          // Send each chunk
          for (const chunk of customerChunks) {
            try {
              const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
              
              // Count successes and failures
              ticketChunk.forEach((ticket: ExpoPushTicket) => {
                if (ticket.status === 'ok') {
                  results.expoSent++;
                } else {
                  results.expoFailed++;
                  logger.warn(`Error enviando notificación Expo: ${ticket.message}`);
                }
              });
            } catch (chunkError) {
              logger.error("Error al enviar chunk de notificaciones Expo a cliente:", chunkError);
              results.expoFailed += chunk.length;
            }
          }
          
          logger.log(`Notificaciones Expo enviadas a cliente - Éxitos: ${results.expoSent}, Fallos: ${results.expoFailed}`);
        }
      } catch (expoError) {
        logger.error("Error al enviar notificaciones Expo a cliente:", expoError);
      }
    }
    
    // Send Expo notifications to business owners if needed
    if (shouldNotifyBusiness && ownerExpoTokens.length > 0) {
      try {
        // Filter valid Expo tokens
        const validOwnerExpoTokens = ownerExpoTokens.filter(token => Expo.isExpoPushToken(token));
        
        if (validOwnerExpoTokens.length > 0) {
          // Create Expo messages
          const ownerExpoMessages: ExpoPushMessage[] = validOwnerExpoTokens.map(token => ({
            to: token,
            sound: 'default',
            title: businessNotificationTitle,
            body: businessNotificationBody,
            badge: 1,
            priority: 'high',
            channelId: 'reservations',
            _displayInForeground: true,
            data: {
              type: "reservation_status",
              reservationId,
              businessId,
              userId,
              status,
              experienceId: '@username/app-slug', // Replace with your app's experienceId
              scopeKey: '@username/app-slug', // Same as experienceId
            },
          }));
          
          // Create chunks of messages (recommended by Expo)
          const ownerChunks = expo.chunkPushNotifications(ownerExpoMessages);
          
          // Send each chunk
          for (const chunk of ownerChunks) {
            try {
              const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
              
              // Count successes and failures
              ticketChunk.forEach((ticket: ExpoPushTicket) => {
                if (ticket.status === 'ok') {
                  results.expoSent++;
                } else {
                  results.expoFailed++;
                  logger.warn(`Error enviando notificación Expo: ${ticket.message}`);
                }
              });
            } catch (chunkError) {
              logger.error("Error al enviar chunk de notificaciones Expo a dueños/admins:", chunkError);
              results.expoFailed += chunk.length;
            }
          }
          
          logger.log(`Notificaciones Expo enviadas a dueños/admins - Éxitos: ${results.expoSent}, Fallos: ${results.expoFailed}`);
        }
      } catch (expoError) {
        logger.error("Error al enviar notificaciones Expo a dueños/admins:", expoError);
      }
    }
    
    // Return results
    logger.log("Procesamiento de notificación de cambio de estado de reserva completado", { results });
    return results;
  } catch (error) {
    logger.error("Error general en sendReservationStatusUpdateNotification", { error });
    return null;
  }
});

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

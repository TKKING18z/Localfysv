"use strict";
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetBadgeCount = exports.sendChatNotification = void 0;
/* eslint-disable */
// Desactivando reglas de estilo temporalmente para permitir el despliegue
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const expo_server_sdk_1 = require("expo-server-sdk");
// Inicializar Firebase Admin SDK
admin.initializeApp();
// Inicializar Expo SDK
const expo = new expo_server_sdk_1.Expo();
/**
 * Función que escucha nuevos mensajes y envía notificaciones push.
 * Se activa cuando se crea un nuevo documento en la colección messages
 * de una conversación.
 */
exports.sendChatNotification = functions.firestore
    .document("conversations/{conversationId}/messages/{messageId}")
    .onCreate(async (snapshot, context) => {
    // Declarar fuera del try para acceso en catch
    const { conversationId, messageId } = context.params;
    try {
        const messageData = snapshot.data();
        // Si no hay datos válidos o senderId, terminamos la función
        if (!messageData || !messageData.senderId) {
            logger.log("Mensaje sin datos válidos o senderId, omitiendo notificación", { conversationId, messageId });
            return null;
        }
        logger.log(`Nuevo mensaje detectado - conversación: ${conversationId}, ` +
            `mensaje: ${messageId}`);
        // Obtener datos de la conversación
        const conversationRef = admin
            .firestore()
            .collection("conversations")
            .doc(conversationId);
        const conversationDoc = await conversationRef.get();
        if (!conversationDoc.exists) {
            logger.log(`La conversación ${conversationId} no existe, ` +
                "omitiendo notificación");
            return null;
        }
        const conversationData = conversationDoc.data();
        const participants = (conversationData === null || conversationData === void 0 ? void 0 : conversationData.participants) || [];
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
            logger.log("No hay destinatarios para este mensaje, omitiendo notificación", { conversationId });
            return null;
        }
        logger.log(`Enviando notificación a ${recipientIds.length} destinatarios`, { conversationId });
        // Preparar el mensaje para la notificación
        const senderName = messageData.senderName || "Usuario";
        let notificationBody = "";
        if (messageData.type === "image") {
            notificationBody = `${senderName} te ha enviado una imagen`;
        }
        else {
            const text = messageData.text || "";
            // Ajustado a 97 para dejar espacio a '...'
            notificationBody = text.length > 100 ?
                `${text.substring(0, 97)}...` : text;
        }
        // Lotes de actualización para eficiencia
        const batch = admin.firestore().batch();
        const fcmTokens = []; // Lista para tokens de FCM
        const expoTokens = []; // Lista para tokens de Expo
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
                    logger.log(`Usuario ${recipientId} no encontrado, omitiendo notificación`);
                    continue;
                }
                const userData = userDoc.data();
                const userTokens = [];
                // Token principal (si existe)
                if (userData === null || userData === void 0 ? void 0 : userData.notificationToken) {
                    userTokens.push(userData.notificationToken);
                }
                // Tokens de dispositivos adicionales
                if ((userData === null || userData === void 0 ? void 0 : userData.devices) && Array.isArray(userData.devices)) {
                    userData.devices.forEach((device) => {
                        if (device && device.token && !userTokens.includes(device.token)) {
                            userTokens.push(device.token);
                        }
                    });
                }
                if (userTokens.length === 0) {
                    logger.log(`Usuario ${recipientId} no tiene tokens registrados, ` +
                        "omitiendo notificación");
                    continue;
                }
                // Clasificar tokens según su tipo (Expo o FCM)
                userTokens.forEach(token => {
                    if (token && typeof token === 'string') {
                        if (token.startsWith('ExponentPushToken[')) {
                            // Verificación adicional para asegurarnos que no estamos agregando un token del remitente
                            if (String(recipientId) !== String(senderIdString)) {
                                expoTokens.push(token);
                            }
                            else {
                                logger.warn(`Ignorando token de Expo para el remitente: ${senderIdString}`);
                            }
                        }
                        else {
                            // Verificación adicional para asegurarnos que no estamos agregando un token del remitente
                            if (String(recipientId) !== String(senderIdString)) {
                                fcmTokens.push(token);
                            }
                            else {
                                logger.warn(`Ignorando token de FCM para el remitente: ${senderIdString}`);
                            }
                        }
                    }
                });
                // Incrementar badgeCount para este usuario
                const currentBadge = (userData === null || userData === void 0 ? void 0 : userData.badgeCount) || 0;
                const newBadgeCount = currentBadge + 1;
                batch.update(userDoc.ref, {
                    badgeCount: newBadgeCount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            catch (userError) {
                logger.error(`Error procesando usuario ${recipientId}:`, userError);
            }
        }
        // Verificación final de tokens
        logger.log(`Tokens FCM: ${fcmTokens.length}, Tokens Expo: ${expoTokens.length}`);
        // Verificar que ningún token pertenezca al remitente
        const senderRef = admin.firestore().collection("users").doc(String(senderIdString));
        const senderDoc = await senderRef.get();
        if (senderDoc.exists) {
            const senderData = senderDoc.data();
            const senderToken = senderData === null || senderData === void 0 ? void 0 : senderData.notificationToken;
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
            logger.log("Contadores de badge actualizados correctamente.", { conversationId });
        }
        catch (batchError) {
            logger.error("Error al confirmar el batch de actualización de badges:", batchError);
            // Continuar con el envío de notificaciones si es posible
        }
        // Verificar si hay tokens para notificar
        if (fcmTokens.length === 0 && expoTokens.length === 0) {
            logger.log("No se encontraron tokens válidos para enviar notificaciones.", { conversationId });
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
                    const firstRecipientData = firstRecipientDoc.data();
                    badgeCountNumber = (firstRecipientData === null || firstRecipientData === void 0 ? void 0 : firstRecipientData.badgeCount) || 1;
                }
            }
        }
        catch (badgeError) {
            logger.warn("No se pudo obtener el badgeCount actualizado " +
                "para la notificación:", badgeError);
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
            const fcmPayload = {
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
            logger.log(`Enviando notificación FCM a ${fcmTokens.length} tokens`, { conversationId });
            try {
                const response = await admin.messaging().sendEachForMulticast(fcmPayload);
                results.fcmSent = response.successCount;
                results.fcmFailed = response.failureCount;
                logger.log(`Notificaciones FCM enviadas - Éxitos: ${response.successCount}, ` +
                    `Fallos: ${response.failureCount}`, { conversationId });
                // Opcional: Manejar tokens inválidos
                if (response.failureCount > 0) {
                    response.responses.forEach((resp, idx) => {
                        var _a;
                        if (!resp.success) {
                            logger.warn(`Error enviando a token FCM ${fcmTokens[idx]}: ` +
                                `${(_a = resp.error) === null || _a === void 0 ? void 0 : _a.message}`);
                        }
                    });
                }
            }
            catch (fcmError) {
                logger.error("Error al enviar notificaciones FCM:", fcmError);
            }
        }
        // Si hay tokens Expo, enviar notificaciones por Expo
        if (expoTokens.length > 0) {
            // Filtrar tokens Expo válidos
            const validExpoTokens = expoTokens.filter(token => expo_server_sdk_1.Expo.isExpoPushToken(token));
            if (validExpoTokens.length !== expoTokens.length) {
                logger.warn(`Se detectaron ${expoTokens.length - validExpoTokens.length} tokens Expo inválidos`);
            }
            if (validExpoTokens.length > 0) {
                // Crear mensajes para Expo
                const expoMessages = validExpoTokens.map(token => ({
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
                logger.log(`Enviando notificación Expo a ${validExpoTokens.length} tokens`, { conversationId });
                try {
                    // Crear chunks de mensajes (recomendado por Expo)
                    const chunks = expo.chunkPushNotifications(expoMessages);
                    // Enviar cada chunk
                    for (const chunk of chunks) {
                        try {
                            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                            // Contar éxitos y fallos
                            ticketChunk.forEach((ticket) => {
                                if (ticket.status === 'ok') {
                                    results.expoSent++;
                                }
                                else {
                                    results.expoFailed++;
                                    logger.warn(`Error enviando notificación Expo: ${ticket.message}`);
                                }
                            });
                        }
                        catch (chunkError) {
                            logger.error("Error al enviar chunk de notificaciones Expo:", chunkError);
                            results.expoFailed += chunk.length;
                        }
                    }
                    logger.log(`Notificaciones Expo enviadas - Éxitos: ${results.expoSent}, ` +
                        `Fallos: ${results.expoFailed}`, { conversationId });
                }
                catch (expoError) {
                    logger.error("Error al enviar notificaciones Expo:", expoError);
                }
            }
        }
        return results;
    }
    catch (error) {
        logger.error("Error al enviar notificación de chat:", error, { conversationId, messageId });
        return null;
    }
});
/**
 * Función que resetea el contador de badge del usuario.
 * Esta función puede ser llamada desde la aplicación cliente
 * cuando se leen los mensajes.
 */
exports.resetBadgeCount = functions.https.onCall(async (data, context) => {
    // Verificar que el usuario está autenticado
    if (!context.auth) {
        logger.error("Usuario no autenticado intentando resetear badge.");
        throw new functions.https.HttpsError("unauthenticated", "El usuario debe estar autenticado para usar esta función.");
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
        return { success: true };
    }
    catch (error) {
        logger.error(`Error al resetear contador de badge para ${userId}:`, error);
        throw new functions.https.HttpsError("internal", "Error al resetear contador de notificaciones.", error);
    }
});
// Puedes agregar aquí la función sendDirectNotification si la necesitas...
//# sourceMappingURL=index.js.map
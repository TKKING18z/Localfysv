Prompt Sugerido:
"Hola, necesito implementar notificaciones push para mi aplicación React Native usando Firebase Cloud Functions (v2, Node.js 22). Específicamente, quiero notificaciones para pedidos:
Nuevo Pedido: Cuando se crea un nuevo documento en la colección orders, se debe enviar una notificación push al dueño(s)/administrador(es) del negocio asociado (businessId).
Actualización de Estado del Pedido: Cuando se actualiza el campo status de un documento en la colección orders, se debe enviar una notificación push al cliente (userId del pedido) informándole del nuevo estado. (Opcional: También notificar al dueño si el estado cambia a 'cancelado' u otro relevante).
Archivos Clave:
functions/index.js: Donde residirán las Cloud Functions.
src/context/OrderContext.tsx: Donde se crean y actualizan los pedidos en Firestore desde la app.
services/NotificationService.ts: Donde se maneja la obtención y guardado de tokens Expo en la app.
Requisitos Técnicos:
Cloud Functions: Usa triggers onDocumentCreated y onDocumentUpdated para la colección orders.
Identificación de Destinatarios:
Dueño/Admin: Buscar el ownerId en el documento del negocio (businesses/{businessId}) y también buscar usuarios con rol 'owner', 'admin', o 'manager' en la colección business_permissions que coincidan con el businessId del pedido.
Cliente: Usar el userId almacenado en el documento del pedido.
Obtención de Tokens: Para cada destinatario (dueño/admin/cliente), buscar sus tokens Expo en el documento users/{userId}, revisando tanto el campo notificationToken como el array devices (asegúrate de manejar ambos y evitar duplicados).
Envío de Notificación Push: Utiliza el SDK firebase-admin (la versión más reciente instalada es 12.1.1, pero si encuentras problemas de compatibilidad conocidos con Node.js 22 / Cloud Functions v2, sugiere o usa una versión estable anterior como la última v11.x). Asegúrate de usar el método correcto para enviar notificaciones a múltiples tokens (históricamente sendMulticast, pero verifica la sintaxis actual para la versión del SDK elegida). Importante: Mis intentos anteriores fallaron con TypeError: sendMulticast is not a function después de actualizar a 12.1.1. Investiga la forma correcta de llamar a la función de envío múltiple en esta versión o sugiere una versión del SDK donde funcione de forma fiable.
Badge Count: Incrementa correctamente el campo badgeCount en el documento Firestore del usuario destinatario (users/{userId}) antes de enviar la notificación.
Sincronización en la App: Asegúrate de que en OrderContext.tsx y NotificationService.ts, la obtención y guardado del token del usuario en Firestore (saveTokenToFirestore) se realice de forma fiable antes de que la creación o actualización del pedido (createOrder, updateOrderStatus) active la Cloud Function. Revisa el flujo en PaymentScreen.tsx también.
Payload: Configura un payload de notificación adecuado que incluya título, cuerpo, badge, sonido y los datos necesarios (como type, orderId, businessId) para que la app pueda manejar la notificación al recibirla o al hacer clic en ella.
Logging: Incluye logs detallados en las Cloud Functions para poder diagnosticar problemas (ej: ID de pedido, usuarios a notificar, tokens encontrados, resultado del envío de FCM).
Por favor, proporciona el código necesario para functions/index.js y las modificaciones pertinentes en OrderContext.tsx y NotificationService.ts para lograr esto de manera robusta."
 , analiza @index.ts de functions ahi es donde esta laa implementacion de las notificaciones pushs ups de mensajes, agarra eso de ejemplo porfavor 
 analiza los archivos de chats, archivos de orders para que tengas una idea
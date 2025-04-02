# Localfy

Localfy es una aplicación móvil para conectar a usuarios con negocios locales, permitiendo ver información, interactuar con negocios y recibir notificaciones.

## Características principales

- Exploración de negocios locales
- Perfiles de negocio detallados con fotos, ubicación y horarios
- Sistema de chat entre usuarios y negocios
- Notificaciones push para mensajes nuevos
- Sistema de reservaciones
- Panel de administración para propietarios de negocios

## Requisitos

- Node.js (versión 14 o superior)
- Expo CLI
- Firebase (Firestore, Authentication, Storage, Functions)
- Cuenta de Expo para notificaciones push

## Configuración del proyecto

1. Clonar el repositorio
2. Instalar dependencias: `npm install`
3. Configurar variables de entorno
4. Configurar Firebase (ver sección abajo)
5. Iniciar la aplicación: `npm start` o `expo start`

## Configuración de Firebase

El proyecto requiere Firebase para funcionar correctamente. Sigue estos pasos para configurarlo:

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Activa los servicios necesarios: Authentication, Firestore, Storage y Functions
3. Configura las reglas de seguridad para Firestore y Storage
4. Obtén las credenciales de la aplicación y colócalas en el archivo `config/firebase.ts`

## Configuración de notificaciones push

Para que las notificaciones push funcionen correctamente, debes:

1. Configurar el proyecto en Expo
2. Añadir el projectId de Expo en `app.config.js`
3. Implementar las funciones Cloud de Firebase siguiendo estos pasos:

```bash
# Crear un directorio para las Cloud Functions
firebase init functions

# En el directorio functions, copia el código de notificaciones
# proporcionado en la documentación

# Desde el directorio raíz, despliega las funciones
firebase deploy --only functions
```

### Código para Cloud Functions de notificaciones

Para implementar las notificaciones, necesitarás crear las siguientes funciones en Firebase:

- Una función activada por Firestore para enviar notificaciones cuando se crea un nuevo mensaje
- Una función HTTP para permitir resetear contadores de notificaciones
- Una función para enviar notificaciones manuales

La documentación detallada y el código de estas funciones se encuentra en el archivo `NOTIFICATIONS.md`.

## Estructura del proyecto

- `/assets` - Recursos estáticos como imágenes y animaciones
- `/components` - Componentes reutilizables
- `/config` - Archivos de configuración
- `/context` - Contextos de React para manejo de estado global
- `/hooks` - Hooks personalizados de React
- `/models` - Definiciones de tipos de TypeScript
- `/screens` - Pantallas de la aplicación
- `/services` - Servicios para interactuar con APIs y Firebase
- `/src` - Código fuente principal
- `/theme` - Definiciones de estilos y temas

## Guía de desarrollo

Para contribuir al proyecto, consulta el archivo CLAUDE.md para conocer las convenciones de código y estilo.

## Licencia
> This session is being continued from a previous conversation that ran out of context. The conversation is 
  summarized below:
  <analysis>
  Let me go through the conversation chronologically to analyze and summarize the key points:

  1. Initial Problem: The user encountered a build error related to the react-native-reanimated plugin.
     - I installed the package using npm and tried to start the app, but the user interrupted the command.

  2. Second Problem: The user reported an error with the Metro bundler related to the 'idb' module from 
  Firebase.
     - I implemented several solutions:
       - Created a custom metro.config.js with resolver configurations
       - Added a polyfill for idb
       - Simplified Firebase imports
       - Created a firebase.config.js file
       - Downgraded Firebase from v11.4.0 to v10.8.0
       - Fixed React Native Reanimated version

  3. Third Problem: The user encountered TypeScript errors with implicit 'any' types.
     - I added explicit type annotations to callback parameters
     - Created a helper function for timestamp conversion to fix date-related TypeScript errors

  4. Fourth Problem: The user reported errors in ChatService related to Firebase permissions.
     - I modified the notification sending logic in ChatService.ts to avoid Firebase permission issues
     - Implemented a safer approach using local notifications for development

  5. Fifth Problem: The user reported repeated notifications for messages.
     - I implemented a notification tracking system using React's useRef to prevent duplicate notifications
     - Added logic to track already seen messages and filter notifications

  6. Sixth Request: The user asked to implement notifications in the bell icon on the HomeScreen.
     - I created a complete notification system including:
       - A badge indicator on the bell icon in HomeScreen
       - A new NotificationsScreen component
       - Navigation setup for the notifications screen
       - UI to display chat notifications
       - Integration with the existing chat context

  Throughout the conversation, the focus was on resolving bugs and implementing a notification system. The 
  most recent work was implementing the bell icon notification feature, with special attention to making 
  notifications function properly without duplicates.
  </analysis>

  <summary>
  1. Primary Request and Intent:
     The user has faced several technical issues and made multiple requests throughout our conversation:
     - Fixing a build error related to the react-native-reanimated plugin
     - Resolving a Metro bundler error related to the 'idb' module from Firebase
     - Fixing TypeScript errors with implicit 'any' types
     - Resolving Firebase permission errors in ChatService.ts
     - Fixing duplicate notifications for chat messages 
     - Implementing a notification system with the bell icon in the HomeScreen that would show message 
  notifications

  2. Key Technical Concepts:
     - React Native with Expo development environment
     - Metro bundler configuration and resolution
     - Firebase integration (authentication, Firestore, storage)
     - Expo Notifications system
     - React hooks (useState, useEffect, useRef, useCallback)
     - TypeScript type annotations and error handling
     - React Navigation for screen routing
     - React Context for state management (ChatContext)
     - Polyfill implementation for compatibility issues

  3. Files and Code Sections:
     - `/Users/marvinalexanderrivaszavala/localfy-new/metro.config.js`
       - Modified to resolve Firebase module dependencies, particularly the 'idb' module
       - Added a custom resolver to handle .cjs files and missing Firebase modules
       - This was crucial for fixing the Metro bundler issues with Firebase v10+

     - `/Users/marvinalexanderrivaszavala/localfy-new/polyfills/idb.js`
       - Created a polyfill to handle IndexedDB functionality for Firebase
       - Implemented a minimal interface to satisfy Firebase requirements
       - Key for resolving Firebase compatibility issues with Metro

     - `/Users/marvinalexanderrivaszavala/localfy-new/polyfills/postinstall.mjs`
       - Created to fix missing module in Firebase

     - `/Users/marvinalexanderrivaszavala/localfy-new/firebase.config.js`
       - Created to centralize Firebase initialization
       - Simplified imports in the main App component

     - `/Users/marvinalexanderrivaszavala/localfy-new/services/ChatService.ts`
       - Modified notification handling in the sendMessage function
       - Replaced Firestore operations that were causing permission errors with local notifications
       - Fixed by implementing environment-specific code (development vs. production)
       ```javascript
       // Solo en desarrollo, enviar notificación local para pruebas
       if (__DEV__) {
         try {
           // Importar el servicio de notificaciones de manera dinámica
           const { notificationService } = require('../services/NotificationService');
           
           // Crear texto para la notificación
           const notificationBody = messageData.imageUrl 
             ? `${senderDisplayName} te ha enviado una imagen` 
             : cleanText.length > 100 
               ? `${cleanText.substring(0, 100)}...` 
               : cleanText;
           
           // Enviar una notificación local para pruebas
           await notificationService.sendLocalNotification(
             senderDisplayName,
             notificationBody,
             {
               type: 'chat',
               conversationId: conversationId,
               messageId: messageRef.id
             }
           );
         } catch (error) {
           // Handle error
         }
       }
       ```

     - `/Users/marvinalexanderrivaszavala/localfy-new/src/context/ChatContext.tsx`
       - Added tracking mechanisms to prevent duplicate notifications
       - Implemented two data structures to track notifications:
         - `notifiedMessageIds` - A Set to track message IDs already notified
         - `notifiedConversations` - A Map to track unread counts per conversation
       - Added filtering logic to show notifications only for new, unread messages 

     - `/Users/marvinalexanderrivaszavala/localfy-new/src/screens/HomeScreen.tsx`
       - Modified to display a notification badge on the bell icon
       - Added navigation to the new Notifications screen
       ```javascript
       <TouchableOpacity 
         style={styles.iconButton} 
         onPress={() => navigation.navigate('Notifications')}
       >
         <View>
           <MaterialIcons name="notifications-none" size={24} color="#007AFF" />
           {unreadTotal > 0 && (
             <View style={styles.notificationBadge}>
               <Text style={styles.notificationBadgeText}>
                 {unreadTotal > 9 ? '9+' : unreadTotal}
               </Text>
             </View>
           )}
         </View>
       </TouchableOpacity>
       ```

     - `/Users/marvinalexanderrivaszavala/localfy-new/src/screens/NotificationsScreen.tsx`
       - Created a new screen to display notifications
       - Implemented a system to convert chat conversations with unread messages into notifications
       - Added UI for displaying, sorting, and handling notifications
       - Implemented navigation to the relevant conversations on notification tap

     - `/Users/marvinalexanderrivaszavala/localfy-new/src/navigation/AppNavigator.tsx`
       - Updated RootStackParamList to include the new Notifications route
       - Imported and added the NotificationsScreen component to the navigation stack

  4. Problem Solving:
     - Resolved Metro bundler issues by implementing custom resolvers and polyfills for Firebase modules
     - Fixed Firebase permission errors by implementing environment-specific code for handling notifications
     - Prevented duplicate notifications by implementing tracking mechanisms using React's useRef
     - Ensured proper TypeScript typing by adding explicit types to callbacks and parameters
     - Created a complete notification system integrated with the existing chat functionality

  5. Pending Tasks:
     - No specific pending tasks were mentioned by the user

  6. Current Work:
     The most recent work was implementing a notification system with a bell icon on the HomeScreen. This 
  involved:
     - Adding a notification badge to the bell icon in HomeScreen.tsx
     - Creating a new NotificationsScreen.tsx to display notifications
     - Updating AppNavigator.tsx to include the new screen in the navigation
     - Ensuring the notification system works correctly with the existing chat context
     - The implementation allows users to see unread message counts on the bell icon and access a dedicated 
  notifications screen showing details of unread messages

  7. Optional Next Step:
     While not explicitly requested, a logical next step would be to enhance the notification system by:
     - Testing the notification flow to ensure it works correctly with the existing chat functionality
     - Adding support for different notification types beyond chat messages (system notifications, 
  promotions)
     - Implementing notification preferences and settings

  </summary>.
  Please continue the conversation from where we left it off without asking the user any further questions. 
  Continue with the last task that you were asked to work on.
Propiedad de Localfy. Todos los derechos reservados.
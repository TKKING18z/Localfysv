# Localfy

Localfy es una aplicación móvil para conectar a usuarios con negocios locales, permitiendo ver información, interactuar con negocios y recibir notificaciones.

## Características principales

- Exploración de negocios locales
- Perfiles de negocio detallados con fotos, ubicación y horarios
- Sistema de chat entre usuarios y negocios
- Notificaciones push para mensajes nuevos
- Sistema de reservaciones
- Panel de administración para propietarios de negocios
- Sistema de gestión de pedidos para negocios

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

## Sistema de gestión de pedidos para negocios

Localfy incluye un completo sistema para que los propietarios de negocios gestionen los pedidos realizados por los usuarios:

### Características principales

- **Vista de pedidos de negocio**: Pantalla dedicada donde los propietarios pueden ver todos los pedidos recibidos
- **Filtrado por estado**: Posibilidad de filtrar pedidos por su estado (creado, pagado, en preparación, en camino, entregado, cancelado)
- **Gestión de estados**: El propietario puede actualizar el estado del pedido a medida que avanza el proceso
- **Cancelación de pedidos**: Opción para cancelar pedidos en estados iniciales
- **Detalles completos**: Vista detallada de cada pedido con información de productos, precios y cliente
- **Verificación de propietario**: Sistema de seguridad que verifica si el usuario es propietario del negocio para mostrar las opciones de gestión

### Flujo de trabajo

1. El cliente realiza un pedido a través de la aplicación
2. El propietario recibe notificación del nuevo pedido
3. Desde su perfil, el propietario accede a "Pedidos de mis negocios"
4. El propietario puede aceptar el pedido y actualizar su estado:
   - Marcar como pagado
   - Iniciar preparación
   - Enviar pedido (en camino)
   - Marcar como entregado
5. El cliente puede seguir el estado de su pedido en tiempo real

### Componentes principales

- `BusinessOrdersScreen.tsx`: Pantalla principal de gestión de pedidos para propietarios
- `OrderDetailsScreen.tsx`: Vista detallada de un pedido específico con opciones de gestión
- Botón en `ProfileScreen.tsx` que redirecciona a los propietarios a sus pedidos

### Servidor de pagos

La aplicación cuenta con un servidor de procesamiento de pagos que:
- Permite pagos con tarjeta mediante Stripe
- Genera información de pedido
- Envía confirmaciones
- Se conecta a través de API RESTful

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

Propiedad de Localfy. Todos los derechos reservados.
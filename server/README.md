# Servidor de Pagos Localfy

Este es el servidor backend para procesar pagos con Stripe en la aplicación Localfy.

## Requisitos

- Node.js 14.x o superior
- npm o yarn
- Cuenta de Stripe

## Instalación

1. Clona este repositorio o copia los archivos a tu servidor
2. Instala las dependencias:

```bash
npm install
# o
yarn install
```

3. Configura las variables de entorno:
   - Copia el archivo `.env.example` a `.env`
   - Actualiza las variables con tus claves de Stripe

## Ejecución

### Desarrollo

```bash
npm run dev
# o
yarn dev
```

### Producción

```bash
npm start
# o
yarn start
```

## Endpoints

- `GET /`: Verificar si el servidor está en línea
- `POST /create-payment-intent`: Crear un PaymentIntent con Stripe
- `POST /webhook`: Recibir eventos de Stripe (requiere configuración adicional)

## Configuración de Webhooks

Para configurar los webhooks en tu dashboard de Stripe:

1. Ve a Desarrolladores > Webhooks
2. Haz clic en "Añadir endpoint"
3. Ingresa la URL de tu servidor + "/webhook" (ej: `https://tudominio.com/webhook`)
4. Selecciona los eventos `payment_intent.succeeded` y `payment_intent.payment_failed`
5. Copia el Webhook Signing Secret y agrégalo a tu archivo `.env` como `STRIPE_WEBHOOK_SECRET`

## Configuración con ngrok para uso remoto

Para que la aplicación funcione con dispositivos remotos (como compartirla con alguien en otro país usando Expo Go), puedes usar ngrok para exponer tu servidor local a internet.

### Requisitos previos

1. Asegúrate de tener instalados todos los paquetes necesarios:
```
cd server
npm install
```

2. Configura tu archivo `.env` en la carpeta `server/`:
```
STRIPE_SECRET_KEY=tu_clave_secreta_de_stripe
PORT=3001
STRIPE_WEBHOOK_SECRET=tu_clave_de_webhook
```

### Iniciar el servidor con ngrok

Para iniciar el servidor y exponerlo a través de ngrok, ejecuta:

```
cd server
node start-with-ngrok.js
```

Este script:
1. Inicia tu servidor de pagos en el puerto configurado (3001 por defecto)
2. Crea un túnel ngrok para exponer tu servidor local a internet
3. Actualiza automáticamente el archivo `.env` de tu aplicación con la URL de ngrok
4. Muestra instrucciones en la consola

### Compartir la aplicación

Una vez que el servidor esté en ejecución con ngrok:

1. Inicia tu aplicación Expo:
```
npx expo start
```

2. Escanea el código QR desde la aplicación Expo Go en tu dispositivo
3. Comparte el enlace de Expo Go con la persona que quieres que use la aplicación
4. La aplicación se conectará automáticamente al servidor a través de ngrok

### Notas importantes

- La URL de ngrok cambia cada vez que inicias el servicio, a menos que tengas una cuenta de pago
- La sesión de ngrok expirará después de algunas horas en el plan gratuito
- Para pruebas de pago, puedes usar la tarjeta de prueba: 4242 4242 4242 4242 con cualquier fecha futura y CVC
- Si actualizas el código del servidor, deberás reiniciar el script `start-with-ngrok.js` 
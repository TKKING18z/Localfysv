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
// Importar dependencias
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Inicializar Express
const app = express();
const port = process.env.PORT || 3000;

// Helper para calcular la comisión de la plataforma
function calculateApplicationFee(amountInCents) {
  // Asegurarnos de que el monto es un número válido
  if (!amountInCents || isNaN(amountInCents) || amountInCents <= 0) {
    return 0;
  }
  
  // Convertir centavos a dólares para los umbrales
  const amountInDollars = amountInCents / 100;
  let applicationFeeInCents = 0;
  
  // Estructura escalonada de comisiones
  if (amountInDollars < 10) {
    applicationFeeInCents = 10; // $0.10 para transacciones menores a $10
  } else if (amountInDollars < 30) {
    applicationFeeInCents = 15; // $0.15 para transacciones entre $10 y $30
  } else {
    // 0.5% del total para transacciones mayores a $30
    applicationFeeInCents = Math.round(amountInCents * 0.005);
    // Asegurar un mínimo de $0.15
    applicationFeeInCents = Math.max(applicationFeeInCents, 15);
  }
  
  return applicationFeeInCents;
}

// Middleware global
app.use(cors());
// IMPORTANTE: NO usar express.json() globalmente, ya que afecta al webhook
// Solo aplicamos express.json para rutas que no sean el webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Ruta para verificar si el servidor está en línea
app.get('/', (req, res) => {
  res.send('Servidor de pagos Localfy activo');
});

// Ruta para crear un PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, email, businessId, cartItems, applicationFee } = req.body;
    
    // Validaciones
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }
    
    // Validar que la comisión sea un número positivo si está presente
    if (applicationFee !== undefined && (isNaN(applicationFee) || applicationFee < 0)) {
      return res.status(400).json({ error: 'Comisión inválida' });
    }
    
    console.log(`Creando PaymentIntent para: $${amount/100} ${currency || 'usd'}`);
    
    // Determinar la comisión a aplicar
    let finalApplicationFee = applicationFee;
    
    // Si no se especifica una comisión, calcularla automáticamente
    if (finalApplicationFee === undefined) {
      finalApplicationFee = calculateApplicationFee(amount);
    }
    
    if (finalApplicationFee > 0) {
      console.log(`Con comisión de plataforma: $${finalApplicationFee/100}`);
    }
    
    // Intentar crear un cliente si tenemos un email
    let customerId;
    if (email) {
      try {
        // Buscar si el cliente ya existe
        const customers = await stripe.customers.list({ email, limit: 1 });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          console.log(`Cliente existente encontrado: ${customerId}`);
        } else {
          // Crear nuevo cliente
          const customer = await stripe.customers.create({ email });
          customerId = customer.id;
          console.log(`Nuevo cliente creado: ${customerId}`);
        }
      } catch (err) {
        console.error('Error al buscar/crear cliente:', err);
        // Continuar sin cliente si falla
      }
    }
    
    // Preparar los parámetros para el PaymentIntent
    const paymentIntentParams = {
      amount,
      currency: currency || 'usd',
      receipt_email: email,
      metadata: {
        businessId,
        cartItems: cartItems ? JSON.stringify(cartItems.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }))) : ''
      },
      ...(customerId && { customer: customerId })
    };
    
    // Agregar la comisión de la aplicación si está presente
    // Nota: Esto requiere que estés usando Stripe Connect con cuentas conectadas
    if (finalApplicationFee && businessId) {
      paymentIntentParams.application_fee_amount = finalApplicationFee;
      
      // Si estás usando Stripe Connect, debes especificar la cuenta de destino
      paymentIntentParams.transfer_data = {
        destination: businessId, // Este debería ser el ID de la cuenta conectada del negocio
      };
    }

    // Crear el PaymentIntent con los parámetros preparados
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Crear un Ephemeral Key para el cliente si tenemos un ID de cliente
    let ephemeralKey;
    if (customerId) {
      ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2020-08-27' }
      );
    }

    // Responder con los datos necesarios
    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey ? ephemeralKey.secret : null,
      customer: customerId || null,
    });
    
    console.log(`PaymentIntent creado con ID: ${paymentIntent.id}`);
  } catch (error) {
    console.error('Error al crear PaymentIntent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nueva ruta para crear una orden
app.post('/orders', async (req, res) => {
  try {
    const { 
      userId, 
      userEmail, 
      userName,
      businessId, 
      businessName, 
      items, 
      total, 
      subtotal,
      paymentMethod,
      address,
      notes,
      isDelivery,
      tax,
      tip,
      deliveryFee
    } = req.body;
    
    // Validaciones básicas
    if (!userId || !businessId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Datos inválidos. Se requiere userId, businessId e items.' 
      });
    }
    
    if (isNaN(total) || total <= 0) {
      return res.status(400).json({ error: 'Total inválido' });
    }
    
    // Generar número de orden único
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `ORD-${timestamp}${random}`;
    
    // Crear el objeto de orden
    const order = {
      orderNumber,
      userId,
      userEmail,
      userName,
      businessId,
      businessName,
      items,
      status: 'created',
      total,
      subtotal,
      tax: tax || 0,
      tip: tip || 0,
      deliveryFee: deliveryFee || 0,
      paymentMethod,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDelivery,
      ...(address && { address }),
      ...(notes && { notes })
    };
    
    // Aquí normalmente guardarías la orden en tu base de datos
    // Por ahora, solo la devolvemos para simular
    
    console.log('Nueva orden creada:', orderNumber);
    
    res.status(201).json({
      success: true,
      order: {
        id: 'order_' + timestamp + random, // ID simulado
        ...order
      }
    });
  } catch (error) {
    console.error('Error al crear orden:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta para actualizar el estado de una orden
app.put('/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    // Validar el estado
    const validStatuses = ['created', 'paid', 'preparing', 'in_transit', 'delivered', 'canceled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    // Aquí normalmente buscarías y actualizarías la orden en tu base de datos
    // Por ahora, solo simulamos la actualización
    
    console.log(`Orden ${orderId} actualizada a estado: ${status}`);
    
    res.json({
      success: true,
      orderId,
      status,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error al actualizar estado de orden:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta para obtener detalles de una orden
app.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Aquí normalmente buscarías la orden en tu base de datos
    // Por ahora, solo devolvemos un mensaje indicando que la orden no se encontró
    
    res.status(404).json({ 
      error: 'Esta es una simulación. En un entorno real, se buscaría la orden en una base de datos.' 
    });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta para calcular la comisión de la plataforma para un monto dado
app.get('/calculate-fee', (req, res) => {
  try {
    const { amount } = req.query;
    
    // Validar el monto
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Monto inválido. Debe ser un número positivo.' });
    }
    
    // Convertir el monto a centavos para el cálculo
    const amountInCents = Math.round(parseFloat(amount) * 100);
    
    // Calcular la comisión
    const feeInCents = calculateApplicationFee(amountInCents);
    
    // Devolver el resultado
    res.json({
      success: true,
      originalAmount: parseFloat(amount),
      fee: feeInCents / 100,
      feePercentage: (feeInCents / amountInCents) * 100
    });
  } catch (error) {
    console.error('Error al calcular comisión:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta para obtener la estructura de comisiones
app.get('/fee-structure', (req, res) => {
  // Esta es la estructura de comisiones que usamos en la app
  const feeStructure = {
    smallTransaction: {
      threshold: 10.00, // Umbral en dólares
      fixedFee: 0.10,   // Comisión fija en dólares
    },
    mediumTransaction: {
      threshold: 30.00, // Umbral en dólares
      fixedFee: 0.15,   // Comisión fija en dólares
    },
    largeTransaction: {
      percentageFee: 0.5, // Comisión porcentual
      minimumFee: 0.15,   // Comisión mínima en dólares
    }
  };
  
  res.json({
    success: true,
    feeStructure
  });
});

// Webhook para recibir eventos de Stripe
// IMPORTANTE: Usar express.raw para webhooks de Stripe
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  let event;
  
  try {
    // Verificar la firma del webhook
    const signature = req.headers['stripe-signature'];
    
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Log del evento recibido
    console.log(`✅ Evento recibido: ${event.type}`);
    console.log(`   ID: ${event.id}`);
    
    // Manejar el evento
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log(`💰 PaymentIntent exitoso: ${paymentIntent.id}`);
        
        // Extraer metadatos del pago
        const businessId = paymentIntent.metadata.businessId;
        const cartItemsJson = paymentIntent.metadata.cartItems;
        
        // Log de comisión si existe
        if (paymentIntent.application_fee_amount) {
          console.log(`💼 Comisión de la plataforma: $${paymentIntent.application_fee_amount/100}`);
        }
        
        // Actualizar el estado de la orden a 'paid' si podemos identificarla
        // En una implementación real, aquí buscarías la orden asociada al pago 
        // y actualizarías su estado en la base de datos
        
        if (businessId) {
          console.log(`💼 Negocio: ${businessId}`);
        }
        
        if (cartItemsJson) {
          try {
            const cartItems = JSON.parse(cartItemsJson);
            console.log(`🛒 Productos: ${cartItems.length}`);
          } catch (e) {
            console.error('Error al parsear cartItems:', e);
          }
        }
        
        break;
      
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log(`❌ Pago fallido: ${failedPayment.id}, ${failedPayment.last_payment_error?.message || 'sin detalle'}`);
        break;
        
      default:
        console.log(`Evento no manejado específicamente: ${event.type}`);
    }
    
    // Devolver una respuesta exitosa
    res.json({received: true});
  } catch (err) {
    console.error(`❌ Error al procesar webhook: ${err.message}`);
    res.status(500).send(`Error en el servidor: ${err.message}`);
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor de pagos Localfy iniciado en http://localhost:${port}`);
}); 
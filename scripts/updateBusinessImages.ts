import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import 'firebase/compat/storage';

// Inicializar Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC2S36sPSd2XEJmxxkqJ-lQUJc7ySL5Uvw",
  authDomain: "testlocalfysv25.firebaseapp.com",
  projectId: "testlocalfysv25",
  storageBucket: "testlocalfysv25.firebasestorage.app",
  messagingSenderId: "281205862532",
  appId: "1:281205862532:web:aa25ca39606dda5db6d2d1",
  measurementId: "G-Z7V3LK64ZL"
};

// Inicializar Firebase si no está inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase inicializado en el script');
} else {
  console.log('Firebase ya estaba inicializado');
}

/**
 * Script para actualizar las fotos de perfil en las conversaciones de negocios
 * Asigna la imagen principal del negocio como avatar del propietario en las conversaciones
 */
const updateBusinessAvatarsInChats = async () => {
  try {
    console.log('🔄 Iniciando actualización de avatares de negocios en conversaciones...');
    
    const db = firebase.firestore();
    
    // 1. Obtener todas las conversaciones de negocios
    const conversationsSnapshot = await db.collection('conversations')
      .where('businessId', '!=', null)
      .get();
    
    console.log(`Encontradas ${conversationsSnapshot.docs.length} conversaciones de negocios`);
    
    // Contador para seguimiento
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // 2. Para cada conversación, buscar la imagen del negocio
    for (const convDoc of conversationsSnapshot.docs) {
      try {
        const convData = convDoc.data();
        const businessId = convData.businessId;
        
        if (!businessId) {
          console.log(`Conversación ${convDoc.id} tiene businessId pero es nulo/vacío, saltando...`);
          skippedCount++;
          continue;
        }
        
        // Identificar el ID del propietario del negocio
        const participants = convData.participants || [];
        if (participants.length < 2) {
          console.log(`Conversación ${convDoc.id} no tiene suficientes participantes, saltando...`);
          skippedCount++;
          continue;
        }
        
        // En una conversación de negocio, asumimos que el propietario es el participante que no es el usuario
        // Identificar al propietario del negocio (normalmente tiene un formato específico como 'business_owner_...')
        let businessOwnerId = '';
        
        for (const participantId of participants) {
          if (participantId.includes('business_owner_')) {
            businessOwnerId = participantId;
            break;
          }
        }
        
        if (!businessOwnerId) {
          console.log(`No se pudo identificar al propietario del negocio en conversación ${convDoc.id}, usando el segundo participante...`);
          // Si no podemos identificar al propietario por el prefijo, usamos el segundo participante
          // Esto es una suposición, puede no ser preciso en todos los casos
          const userId = participants[0]; // Asumimos que el primer participante es el usuario
          businessOwnerId = participants.find((id: string) => id !== userId) || '';
          
          if (!businessOwnerId) {
            console.log(`No se pudo determinar el propietario del negocio en conversación ${convDoc.id}, saltando...`);
            skippedCount++;
            continue;
          }
        }
        
        // Verificar si ya tiene una foto asignada
        const participantPhotos = convData.participantPhotos || {};
        if (participantPhotos[businessOwnerId]) {
          console.log(`Propietario ${businessOwnerId} ya tiene foto en conversación ${convDoc.id}, saltando...`);
          skippedCount++;
          continue;
        }
        
        // 3. Obtener datos del negocio
        console.log(`Buscando imagen para negocio ${businessId}...`);
        const businessDoc = await db.collection('businesses').doc(businessId).get();
        
        if (!businessDoc.exists) {
          console.log(`Negocio ${businessId} no encontrado, saltando...`);
          skippedCount++;
          continue;
        }
        
        const businessData = businessDoc.data();
        if (!businessData?.images || !Array.isArray(businessData.images) || businessData.images.length === 0) {
          console.log(`Negocio ${businessId} no tiene imágenes, saltando...`);
          skippedCount++;
          continue;
        }
        
        // Buscar la imagen principal o usar la primera disponible
        let businessImageUrl: string | null = null;
        
        // Primero buscar imagen marcada como principal
        const mainImage = businessData.images.find((img: any) => img && img.isMain);
        if (mainImage && mainImage.url) {
          businessImageUrl = mainImage.url;
          console.log(`Usando imagen principal para negocio ${businessId}`);
        } else if (businessData.images[0].url) {
          // Si no hay imagen principal, usar la primera
          businessImageUrl = businessData.images[0].url;
          console.log(`Usando primera imagen para negocio ${businessId}`);
        }
        
        if (!businessImageUrl) {
          console.log(`No se encontró URL de imagen válida para negocio ${businessId}, saltando...`);
          skippedCount++;
          continue;
        }
        
        // 4. Actualizar la conversación con la imagen del negocio
        console.log(`Actualizando avatar de propietario ${businessOwnerId} en conversación ${convDoc.id}...`);
        
        // Preparar objeto participantPhotos
        const updatedPhotos = { ...participantPhotos };
        updatedPhotos[businessOwnerId] = businessImageUrl;
        
        // Actualizar en Firestore
        await db.collection('conversations').doc(convDoc.id).update({
          participantPhotos: updatedPhotos,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Conversación ${convDoc.id} actualizada correctamente con imagen de negocio`);
        updatedCount++;
        
      } catch (convError) {
        console.error(`Error procesando conversación ${convDoc.id}:`, convError);
        errorCount++;
      }
    }
    
    // Resumen final
    console.log('\n📊 RESUMEN DE ACTUALIZACIÓN:');
    console.log(`✅ Conversaciones actualizadas: ${updatedCount}`);
    console.log(`⏭️ Conversaciones saltadas: ${skippedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`🔄 Total procesado: ${conversationsSnapshot.docs.length}`);
    
  } catch (error) {
    console.error('Error global en el script:', error);
    throw error;
  }
};

// Ejecutar el script
if (require.main === module) {
  updateBusinessAvatarsInChats()
    .then(() => {
      console.log('Script finalizado con éxito');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error al ejecutar el script:', error);
      process.exit(1);
    });
}

// Exportar la función para poder usarla desde otro lugar
export { updateBusinessAvatarsInChats };
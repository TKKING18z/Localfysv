// Verificar conexión a Firestore
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/firestore');

// Importar configuración
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC2S36sPSd2XEJmxxkqJ-lQUJc7ySL5Uvw",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "testlocalfysv25.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "testlocalfysv25",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "testlocalfysv25.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "281205862532",
    appId: process.env.FIREBASE_APP_ID || "1:281205862532:web:aa25ca39606dda5db6d2d1",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-Z7V3LK64ZL"
};

// Inicializar Firebase si no está inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app();
}

async function verifyFirestoreConnection() {
  console.log('Verificando conexión a Firestore...');
  
  try {
    // Intentar acceder a una colección
    const db = firebase.firestore();
    const businessesCollection = db.collection('businesses');
    const snapshot = await businessesCollection.get();
    
    console.log(`Conexión exitosa! Se encontraron ${snapshot.size} documentos en la colección 'businesses'`);
    
    // Imprimir los primeros 3 documentos como verificación
    if (snapshot.size > 0) {
      console.log('Ejemplos de documentos:');
      let count = 0;
      snapshot.forEach(doc => {
        if (count < 3) {
          console.log(`ID: ${doc.id}, Datos:`, doc.data());
          count++;
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error al conectar con Firestore:', error);
    return false;
  }
}

// Ejecutar la verificación
verifyFirestoreConnection()
  .then(success => {
    if (success) {
      console.log('Verificación completada exitosamente.');
    } else {
      console.log('La verificación falló. Revisa la configuración y las reglas de seguridad.');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error durante la verificación:', err);
    process.exit(1);
  });
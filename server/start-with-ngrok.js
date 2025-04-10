const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ngrok = require('ngrok');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Puerto configurado en server/.env
const PORT = process.env.PORT || 3001;

console.log('Puerto configurado:', PORT);
console.log('Directorio actual:', __dirname);

// Inicia el servidor
console.log('Iniciando servidor de pagos...');
const server = spawn('node', ['server.js'], { 
  cwd: __dirname,
  stdio: 'inherit'
});

// Manejo de errores del servidor
server.on('error', (error) => {
  console.error('Error al iniciar el servidor:', error);
  process.exit(1);
});

// Función para iniciar ngrok
async function startNgrok() {
  try {
    console.log(`Conectando ngrok al puerto ${PORT}...`);
    
    // Usar URL pública directamente en lugar de conectar a través de la API
    const url = await ngrok.connect(PORT);
    
    console.log(`✅ Ngrok conectado: ${url}`);
    
    // Actualizar el archivo .env de la aplicación con la URL de ngrok
    const envFilePath = path.join(__dirname, '..', '.env');
    console.log('Ruta del archivo .env:', envFilePath);
    
    let envContent = '';
    
    try {
      envContent = fs.readFileSync(envFilePath, 'utf8');
      console.log('Archivo .env encontrado y leído');
    } catch (error) {
      console.log('No se encontró archivo .env existente, se creará uno nuevo.', error);
    }
    
    // Actualizar o agregar la variable EXPO_PUBLIC_API_URL
    if (envContent.includes('EXPO_PUBLIC_API_URL=')) {
      console.log('Reemplazando EXPO_PUBLIC_API_URL existente');
      envContent = envContent.replace(
        /EXPO_PUBLIC_API_URL=.*/,
        `EXPO_PUBLIC_API_URL=${url}`
      );
    } else {
      console.log('Agregando nueva variable EXPO_PUBLIC_API_URL');
      envContent += `\nEXPO_PUBLIC_API_URL=${url}\n`;
    }
    
    // Guardar el archivo .env actualizado
    fs.writeFileSync(envFilePath, envContent);
    console.log(`✅ URL de ngrok guardada en .env: EXPO_PUBLIC_API_URL=${url}`);
    console.log('Contenido actualizado del .env:');
    console.log('-----------------------------------');
    console.log(envContent);
    console.log('-----------------------------------');
    
    console.log('\n📱 INSTRUCCIONES:');
    console.log('1. Reinicia tu aplicación Expo para cargar la nueva URL');
    console.log('2. Comparte la URL del Expo Go con tu novia');
    console.log('3. Esta URL de ngrok es temporal y expirará cuando cierres este proceso');
    console.log('\n⚠️ Si tienes problemas de conexión, verifica:');
    console.log('- Que ambos tengan una buena conexión a internet');
    console.log('- Que no haya restricciones de firewall o VPN');
    console.log('- Que el webhook de Stripe esté configurado con esta nueva URL');
  } catch (error) {
    console.error('Error al conectar ngrok:', error);
    process.exit(1);
  }
}

// Esperar un momento para que el servidor inicie antes de lanzar ngrok
console.log('Esperando 3 segundos antes de iniciar ngrok...');
setTimeout(startNgrok, 3000);

// Manejo de señales para cerrar correctamente
process.on('SIGINT', async () => {
  console.log('Cerrando ngrok y servidor...');
  await ngrok.kill();
  server.kill();
  process.exit(0);
}); 
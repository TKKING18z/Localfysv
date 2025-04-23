"use strict";
/**
 * Script para arreglar permisos de negocio
 *
 * Este script añade un usuario como administrador de un negocio
 * para que pueda recibir notificaciones de pedidos.
 */
const admin = require('firebase-admin');
// Initialize Firebase Admin (si no se ha inicializado ya)
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
// IDs a configurar
const USER_ID = '6uOSR1hvDPYVh3JyWBdA8QwWwTX2'; // El ID del usuario de prueba
const BUSINESS_ID = 'BvTti7VDWdGd01XNmZql'; // El ID del negocio China Wok
async function addBusinessPermission() {
    try {
        console.log(`Añadiendo permiso: Usuario ${USER_ID} como admin de negocio ${BUSINESS_ID}`);
        // Verificar si ya existe un permiso
        const existingPermission = await db.collection('business_permissions')
            .where('userId', '==', USER_ID)
            .where('businessId', '==', BUSINESS_ID)
            .get();
        if (!existingPermission.empty) {
            console.log('El permiso ya existe. Actualizando...');
            // Actualizar el permiso existente
            const docId = existingPermission.docs[0].id;
            await db.collection('business_permissions').doc(docId).update({
                role: 'admin',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Permiso actualizado con ID: ${docId}`);
            return;
        }
        // Crear un nuevo permiso
        const permissionData = {
            userId: USER_ID,
            businessId: BUSINESS_ID,
            role: 'admin', // admin, manager, owner, staff
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const docRef = await db.collection('business_permissions').add(permissionData);
        console.log(`Permiso creado con ID: ${docRef.id}`);
        // Verificar el negocio
        const businessDoc = await db.collection('businesses').doc(BUSINESS_ID).get();
        if (businessDoc.exists) {
            const businessData = businessDoc.data();
            console.log(`Negocio encontrado: ${businessData.name || BUSINESS_ID}`);
            // Si el negocio no tiene un ownerId, podemos establecerlo
            if (!businessData.ownerId) {
                console.log('El negocio no tiene ownerId, estableciendo...');
                await db.collection('businesses').doc(BUSINESS_ID).update({
                    ownerId: USER_ID,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log('Negocio actualizado con nuevo ownerId');
            }
            else {
                console.log(`El negocio ya tiene ownerId: ${businessData.ownerId}`);
            }
        }
        else {
            console.log(`Negocio con ID ${BUSINESS_ID} no encontrado`);
        }
    }
    catch (error) {
        console.error('Error al añadir permiso:', error);
    }
}
// Ejecutar la función
addBusinessPermission()
    .then(() => console.log('Script completado'))
    .catch(err => console.error('Error en script:', err))
    .finally(() => process.exit());
//# sourceMappingURL=fix-permissions.js.map
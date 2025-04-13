import { createRef } from 'react';
import { NavigationContainerRef, StackActions } from '@react-navigation/native';

// Tipo para el ref de navegación
export type RootNavigationRef = NavigationContainerRef<any>;

// Crear una referencia global del navegador
export const navigationRef = createRef<RootNavigationRef>();

// Interfaz para las solicitudes de navegación en cola
interface NavigationRequest {
  type: 'navigate' | 'reset';
  name: string;
  params?: any;
  timestamp: number;
  id: string;
}

// Sistema de cola de navegación
let navigationQueue: NavigationRequest[] = [];
let isProcessingQueue = false;
let isNavigationReady = false;

// Tiempo mínimo entre navegaciones (ms)
const MIN_NAVIGATION_INTERVAL = 500;

// Función para generar IDs únicos
const generateId = () => `nav_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Procesar la cola de navegación
const processNavigationQueue = () => {
  if (!isNavigationReady || !navigationRef.current || isProcessingQueue || navigationQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;
  
  // Obtener la solicitud más antigua
  const request = navigationQueue[0];
  const now = Date.now();
  
  // Asegurarse de que ha pasado suficiente tiempo desde que se creó la solicitud
  if (now - request.timestamp < MIN_NAVIGATION_INTERVAL) {
    // Si no ha pasado suficiente tiempo, esperar un poco más
    setTimeout(processNavigationQueue, MIN_NAVIGATION_INTERVAL - (now - request.timestamp));
    isProcessingQueue = false;
    return;
  }
  
  try {
    console.log(`[NavigationService] Processing queued ${request.type} to ${request.name}`, request.params);
    
    if (request.type === 'navigate') {
      navigationRef.current.navigate(request.name, request.params);
    } else if (request.type === 'reset') {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: request.name, params: request.params }],
      });
    }
    
    // Eliminar la solicitud procesada de la cola
    navigationQueue = navigationQueue.filter(r => r.id !== request.id);
    
    // Esperar un tiempo antes de procesar la siguiente solicitud
    setTimeout(() => {
      isProcessingQueue = false;
      // Verificar si hay más solicitudes en la cola
      if (navigationQueue.length > 0) {
        processNavigationQueue();
      }
    }, MIN_NAVIGATION_INTERVAL);
  } catch (error) {
    console.error(`[NavigationService] Error processing ${request.type} to ${request.name}:`, error);
    // Eliminar la solicitud con error para evitar bloqueos
    navigationQueue = navigationQueue.filter(r => r.id !== request.id);
    isProcessingQueue = false;
    
    // Intentar procesar la siguiente
    setTimeout(processNavigationQueue, MIN_NAVIGATION_INTERVAL);
  }
};

// Notificar que la navegación está lista (llamar desde App.js después de que NavigationContainer esté montado)
export function setNavigationReady() {
  console.log('[NavigationService] Navigation is now ready');
  isNavigationReady = true;
  processNavigationQueue();
}

// Agregar una solicitud a la cola de navegación
function queueNavigation(type: 'navigate' | 'reset', name: string, params?: any): string {
  const id = generateId();
  const request: NavigationRequest = {
    type,
    name,
    params,
    timestamp: Date.now(),
    id
  };
  
  // Agregar a la cola
  navigationQueue.push(request);
  console.log(`[NavigationService] Queued ${type} to ${name}`, params);
  
  // Intentar procesar la cola
  setTimeout(processNavigationQueue, 0);
  
  return id;
}

// Funciones públicas de navegación
export function navigate(name: string, params?: object) {
  if (navigationRef.current && isNavigationReady) {
    try {
      console.log(`[NavigationService] Navigating to ${name} with params:`, params);
      navigationRef.current.navigate(name, params);
    } catch (error) {
      console.error('[NavigationService] Navigation error:', error);
      // Si falla, intentar poner en cola
      queueNavigation('navigate', name, params);
    }
  } else {
    console.warn('[NavigationService] Navigation not ready, queuing navigation');
    queueNavigation('navigate', name, params);
  }
}

export function reset(routeName: string, params?: object) {
  if (navigationRef.current && isNavigationReady) {
    try {
      console.log(`[NavigationService] Resetting navigation to ${routeName} with params:`, params);
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: routeName, params }],
      });
    } catch (error) {
      console.error('[NavigationService] Reset navigation error:', error);
      // Si falla, intentar poner en cola
      queueNavigation('reset', routeName, params);
    }
  } else {
    console.warn('[NavigationService] Navigation not ready, queuing reset');
    queueNavigation('reset', routeName, params);
  }
}

export function navigateToOrderConfirmation(orderId: string) {
  if (!orderId) {
    console.error('[NavigationService] Cannot navigate to order confirmation: Missing orderId');
    return;
  }
  
  // Programar la navegación con retardo
  console.log(`[NavigationService] Planning navigation sequence for order: ${orderId}`);
  
  // Paso 1: Primero ir a MainTabs (más seguro)
  reset('MainTabs');
  
  // Paso 2: Después de un retardo, ir a la pantalla de carga
  setTimeout(() => {
    // En lugar de navegar directamente, usar una navegación en cola
    const id = queueNavigation('navigate', 'OrderLoading', {
      orderId,
      orderNumber: orderId
    });
    
    console.log(`[NavigationService] Queued navigation to OrderLoading (${id})`);
  }, 800);
}

// Limpiar todas las navegaciones pendientes
export function clearNavigationQueue() {
  navigationQueue = [];
  console.log('[NavigationService] Navigation queue cleared');
}

// Servicio singleton expuesto
export const NavigationService = {
  navigate,
  reset,
  navigateToOrderConfirmation,
  setNavigationReady,
  clearNavigationQueue,
};

export default NavigationService; 
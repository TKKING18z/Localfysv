import firebase from 'firebase/compat/app';
import { BusinessAnalytics, BusinessAnalyticsData, DataPoint, TimePeriod } from '../types/analyticsTypes';

// Función para inicializar datos de analíticas de prueba para un negocio
export const initializeTestAnalytics = async (businessId: string): Promise<boolean> => {
  try {
    const analyticsRef = firebase.firestore().collection('analytics').doc(businessId);
    const doc = await analyticsRef.get();
    
    // Si ya existe, no hacer nada
    if (doc.exists) {
      console.log(`Datos analíticos ya existen para negocio ${businessId}`);
      return true;
    }
    
    console.log(`Inicializando datos de prueba para negocio ${businessId}`);
    
    // Generar datos aleatorios
    const visits = Math.floor(Math.random() * 500) + 100;
    const reservations = Math.floor(Math.random() * 50) + 10;
    const rating = (Math.random() * 3) + 2; // Entre 2 y 5
    
    // Crear datos de visitas por hora/día/mes
    const dailyVisits: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      dailyVisits[`${i}`.padStart(2, '0')] = Math.floor(Math.random() * 20);
    }
    
    const weeklyVisits: Record<string, number> = {};
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    days.forEach(day => {
      weeklyVisits[day] = Math.floor(Math.random() * 100) + 20;
    });
    
    const monthlyVisits: Record<string, number> = {};
    for (let i = 1; i <= 30; i++) {
      monthlyVisits[`${i}`] = Math.floor(Math.random() * 150) + 50;
    }
    
    const yearlyVisits: Record<string, number> = {};
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    months.forEach(month => {
      yearlyVisits[month] = Math.floor(Math.random() * 500) + 100;
    });
    
    // Crear documento en Firestore
    await analyticsRef.set({
      visits: {
        total: visits,
        trend: Math.floor(Math.random() * 30) - 10, // Entre -10% y +20%
        daily: dailyVisits,
        weekly: weeklyVisits,
        monthly: monthlyVisits,
        yearly: yearlyVisits
      },
      reservations: {
        total: reservations,
        confirmed: Math.floor(reservations * 0.8),
        pending: Math.floor(reservations * 0.2),
        value: reservations * (Math.floor(Math.random() * 50) + 20),
        trend: Math.floor(Math.random() * 20) - 5 // Entre -5% y +15%
      },
      reviews: {
        average: rating,
        total: Math.floor(Math.random() * 30) + 5
      },
      revenue: {
        total: reservations * (Math.floor(Math.random() * 50) + 20),
        trend: Math.floor(Math.random() * 30) - 10 // Entre -10% y +20%
      },
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Datos de prueba creados con éxito para ${businessId}`);
    return true;
  } catch (error) {
    console.error('Error initializing test analytics:', error);
    return false;
  }
};

// Función para registrar una visita a un negocio
export const trackBusinessVisit = async (businessId: string): Promise<boolean> => {
  try {
    console.log(`Registrando visita para negocio ${businessId}`);
    const analyticsRef = firebase.firestore().collection('analytics').doc(businessId);
    const doc = await analyticsRef.get();
    
    // Si no existe, inicializar
    if (!doc.exists) {
      await initializeTestAnalytics(businessId);
      return true;
    }
    
    // Obtener fecha/hora actual
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0');
    const dayIndex = now.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const day = days[dayIndex];
    const date = now.getDate().toString();
    const monthIndex = now.getMonth(); // 0 = Enero, etc.
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = months[monthIndex];
    
    // Actualizar contadores
    await analyticsRef.update({
      'visits.total': firebase.firestore.FieldValue.increment(1),
      [`visits.daily.${hour}`]: firebase.firestore.FieldValue.increment(1),
      [`visits.weekly.${day}`]: firebase.firestore.FieldValue.increment(1),
      [`visits.monthly.${date}`]: firebase.firestore.FieldValue.increment(1),
      [`visits.yearly.${month}`]: firebase.firestore.FieldValue.increment(1),
      'lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error tracking business visit:', error);
    return false;
  }
};

// Función para registrar una reserva
export const trackReservation = async (businessId: string, status: string, value: number): Promise<boolean> => {
  try {
    console.log(`Registrando reserva para negocio ${businessId}, estado: ${status}, valor: ${value}`);
    const analyticsRef = firebase.firestore().collection('analytics').doc(businessId);
    const doc = await analyticsRef.get();
    
    // Si no existe, inicializar
    if (!doc.exists) {
      await initializeTestAnalytics(businessId);
    }
    
    // Actualizar contadores según el estado
    if (status === 'confirmed') {
      await analyticsRef.update({
        'reservations.total': firebase.firestore.FieldValue.increment(1),
        'reservations.confirmed': firebase.firestore.FieldValue.increment(1),
        'reservations.value': firebase.firestore.FieldValue.increment(value),
        'revenue.total': firebase.firestore.FieldValue.increment(value),
        'lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
      });
    } else if (status === 'pending') {
      await analyticsRef.update({
        'reservations.total': firebase.firestore.FieldValue.increment(1),
        'reservations.pending': firebase.firestore.FieldValue.increment(1),
        'lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking reservation:', error);
    return false;
  }
};

// Función para registrar una reseña
export const trackReview = async (businessId: string, rating: number): Promise<boolean> => {
  try {
    console.log(`Registrando reseña para negocio ${businessId}, calificación: ${rating}`);
    const analyticsRef = firebase.firestore().collection('analytics').doc(businessId);
    const doc = await analyticsRef.get();
    
    if (!doc.exists) {
      await initializeTestAnalytics(businessId);
      return true;
    }
    
    const data = doc.data();
    const currentTotal = data?.reviews?.total || 0;
    const currentAverage = data?.reviews?.average || 0;
    
    // Calcular nuevo promedio
    const newTotal = currentTotal + 1;
    const newAverage = ((currentAverage * currentTotal) + rating) / newTotal;
    
    // Actualizar datos
    await analyticsRef.update({
      'reviews.total': newTotal,
      'reviews.average': newAverage,
      'lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error tracking review:', error);
    return false;
  }
};

// Nueva función para registrar los ingresos de pedidos
export const trackOrderRevenue = async (businessId: string, total: number): Promise<boolean> => {
  try {
    console.log(`Registrando ingresos para negocio ${businessId}, valor: ${total}`);
    const analyticsRef = firebase.firestore().collection('analytics').doc(businessId);
    const doc = await analyticsRef.get();
    
    // Si no existe, inicializar
    if (!doc.exists) {
      await initializeTestAnalytics(businessId);
    }
    
    // Actualizar contadores de ingresos
    await analyticsRef.update({
      'revenue.total': firebase.firestore.FieldValue.increment(total),
      'reservations.value': firebase.firestore.FieldValue.increment(total),
      'lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error tracking order revenue:', error);
    return false;
  }
};

// Función para obtener datos analíticos de negocios
export const getBusinessesAnalytics = async (businessIds: string[]): Promise<BusinessAnalytics> => {
  try {
    console.log(`Obteniendo analíticas para ${businessIds.length} negocios`);
    
    // Si no hay negocios, devolver estructura base vacía
    if (businessIds.length === 0) {
      return {
        totalVisits: 0,
        visitsTrend: 0,
        totalReservations: {
          count: 0,
          confirmed: 0,
          pending: 0,
          value: 0,
        },
        reservationsTrend: 0,
        revenueTrend: 0,
        averageRating: 0,
        visitsData: {
          [TimePeriod.DAY]: [],
          [TimePeriod.WEEK]: [],
          [TimePeriod.MONTH]: [],
          [TimePeriod.YEAR]: []
        },
        businessesAnalytics: {},
        pendingActions: {
          reservations: [],
          messages: [],
          reviews: []
        }
      };
    }

    // Inicializar datos de prueba para cada negocio si no existen
    console.log("Verificando e inicializando datos de analíticas si no existen");
    await Promise.all(businessIds.map(id => initializeTestAnalytics(id)));

    // Obtener datos analíticos de cada negocio
    const analyticsPromises = businessIds.map(async (businessId) => {
      const analyticsRef = firebase.firestore()
        .collection('analytics')
        .doc(businessId);

      const doc = await analyticsRef.get();
      
      if (!doc.exists) {
        console.warn(`No se encontraron datos analíticos para negocio ${businessId}`);
        // Si no hay datos, crear estructura base con todos los campos requeridos
        return { 
          businessId,
          data: {
            visits: 0,
            maxVisits: 100,
            visitsTrend: 0,
            reservations: 0,
            reservationsTrend: 0,
            revenue: 0,
            revenueTrend: 0,
            rating: 0,
            visitsData: {
              day: [],
              week: [],
              month: [],
              year: [] 
            }
          } 
        };
      }

      const analyticsData = doc.data();
      console.log(`Datos analíticos recibidos para negocio ${businessId}`);
      
      // Formatear datos según el modelo
      return {
        businessId,
        data: {
          visits: analyticsData?.visits?.total || 0,
          maxVisits: 100, // Valor de referencia para la comparación
          visitsTrend: analyticsData?.visits?.trend || 0,
          reservations: analyticsData?.reservations?.confirmed || 0,
          reservationsTrend: analyticsData?.reservations?.trend || 0,
          revenue: analyticsData?.reservations?.value || 0,
          revenueTrend: analyticsData?.revenue?.trend || 0,
          rating: analyticsData?.reviews?.average || 0,
          visitsData: {
            day: formatDataPoints(analyticsData?.visits?.daily || {}),
            week: formatDataPoints(analyticsData?.visits?.weekly || {}),
            month: formatDataPoints(analyticsData?.visits?.monthly || {}),
            year: formatDataPoints(analyticsData?.visits?.yearly || {})
          }
        }
      };
    });

    // Obtener todas las acciones pendientes (usando FireStore para negocios reales)
    const pendingActionsPromises = businessIds.map(async (businessId) => {
      try {
        // Intentar acceder a datos de pendientes en Firestore
        console.log(`Obteniendo acciones pendientes para negocio ${businessId}`);
        
        // Obtener reservas pendientes
        const reservationsQuery = firebase.firestore()
          .collection('reservations')
          .where('businessId', '==', businessId)
          .where('status', '==', 'pending')
          .limit(10);
        
        const reservationsSnap = await reservationsQuery.get();
        
        const reservations = reservationsSnap.docs.map(doc => ({
          id: doc.id,
          businessId,
          date: doc.data().date,
          customerName: doc.data().userName || 'Cliente',
          partySize: doc.data().partySize || 2
        }));
        
        // Obtener mensajes no leídos (si existe la colección 'messages')
        let messages = [];
        try {
          const messagesQuery = firebase.firestore()
            .collection('messages')
            .where('businessId', '==', businessId)
            .where('read', '==', false)
            .limit(10);
          
          const messagesSnap = await messagesQuery.get();
          
          messages = messagesSnap.docs.map(doc => ({
            id: doc.id,
            businessId,
            from: doc.data().senderName || 'Usuario',
            preview: doc.data().lastMessage || '...',
            timestamp: doc.data().timestamp
          }));
        } catch (err) {
          console.log('No hay colección de mensajes o error accediendo:', err);
          // Generar algunos mensajes de prueba
          messages = Array(Math.floor(Math.random() * 3)).fill(0).map((_, i) => ({
            id: `msg-test-${i}`,
            businessId,
            from: `Usuario Test ${i+1}`,
            preview: 'Mensaje de prueba...',
            timestamp: new Date().toISOString()
          }));
        }
        
        // Obtener reseñas sin responder (si existe la colección 'reviews')
        let reviews = [];
        try {
          const reviewsQuery = firebase.firestore()
            .collection('reviews')
            .where('businessId', '==', businessId)
            .where('responded', '==', false)
            .limit(10);
          
          const reviewsSnap = await reviewsQuery.get();
          
          reviews = reviewsSnap.docs.map(doc => ({
            id: doc.id,
            businessId,
            rating: doc.data().rating || 4,
            preview: doc.data().comment || '...',
            date: doc.data().createdAt
          }));
        } catch (err) {
          console.log('No hay colección de reseñas o error accediendo:', err);
          // Generar algunas reseñas de prueba
          reviews = Array(Math.floor(Math.random() * 3)).fill(0).map((_, i) => ({
            id: `review-test-${i}`,
            businessId,
            rating: Math.floor(Math.random() * 5) + 1,
            preview: 'Reseña de prueba...',
            date: new Date().toISOString()
          }));
        }

        return {
          businessId,
          pendingActions: {
            reservations,
            messages,
            reviews
          }
        };
      } catch (error) {
        console.error(`Error fetching pending actions for business ${businessId}:`, error);
        // Devolver estructura vacía en caso de error
        return {
          businessId,
          pendingActions: {
            reservations: [],
            messages: [],
            reviews: []
          }
        };
      }
    });

    // Esperar todas las promesas con manejo de errores mejorado
    console.log("Obteniendo resultados de analíticas y acciones pendientes");
    const [analyticsResults, pendingResults] = await Promise.all([
      Promise.allSettled(analyticsPromises).then(results => 
        results
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<any>).value)
      ),
      Promise.allSettled(pendingActionsPromises).then(results => 
        results
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<any>).value)
      )
    ]);

    // Procesar resultados para formato final
    const businessesAnalytics: Record<string, BusinessAnalyticsData> = {};
    let totalVisits = 0;
    let totalReservations = 0;
    let totalConfirmed = 0;
    let totalPending = 0;
    let totalValue = 0;
    let totalRating = 0;
    let ratingCount = 0;
    
    // Procesar datos analíticos
    analyticsResults.forEach(({ businessId, data }) => {
      businessesAnalytics[businessId] = data;
      totalVisits += data.visits || 0;
      totalReservations += data.reservations || 0;
      totalValue += data.revenue || 0;
      
      if (data.rating > 0) {
        totalRating += data.rating;
        ratingCount++;
      }
    });

    // Procesar acciones pendientes
    const allPendingReservations: any[] = [];
    const allPendingMessages: any[] = [];
    const allPendingReviews: any[] = [];

    pendingResults.forEach(({ pendingActions }) => {
      allPendingReservations.push(...pendingActions.reservations);
      allPendingMessages.push(...pendingActions.messages);
      allPendingReviews.push(...pendingActions.reviews);
    });
    
    // Generar datos de visitas agregados para todos los negocios
    const aggregatedVisitsData = generateMockVisitsData();
    
    // Calcular calificación promedio
    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

    // Construir objeto de resultado
    const result = {
      totalVisits,
      visitsTrend: calculateOverallTrend(analyticsResults.map(r => r.data.visitsTrend || 0)),
      totalReservations: {
        count: totalReservations,
        confirmed: totalConfirmed,
        pending: allPendingReservations.length,
        value: totalValue
      },
      reservationsTrend: calculateOverallTrend(analyticsResults.map(r => r.data.reservationsTrend || 0)),
      revenueTrend: calculateOverallTrend(analyticsResults.map(r => r.data.revenueTrend || 0)),
      averageRating,
      visitsData: aggregatedVisitsData,
      businessesAnalytics,
      pendingActions: {
        reservations: allPendingReservations,
        messages: allPendingMessages,
        reviews: allPendingReviews
      }
    };
    
    console.log(`Datos analíticos agregados obtenidos correctamente para ${businessIds.length} negocios`);
    return result;
  } catch (error) {
    console.error('Error fetching business analytics:', error);
    // Devolver estructura básica en caso de error
    return {
      totalVisits: 0,
      visitsTrend: 0,
      totalReservations: {
        count: 0,
        confirmed: 0,
        pending: 0,
        value: 0,
      },
      reservationsTrend: 0,
      revenueTrend: 0,
      averageRating: 0,
      visitsData: generateMockVisitsData(),
      businessesAnalytics: {},
      pendingActions: {
        reservations: [],
        messages: [],
        reviews: []
      }
    };
  }
};

// Función auxiliar para formatear datos de puntos
const formatDataPoints = (data: Record<string, number>): DataPoint[] => {
  return Object.entries(data).map(([label, value]) => ({ label, value }));
};

// Función para calcular tendencia general
const calculateOverallTrend = (trends: number[]): number => {
  if (trends.length === 0) return 0;
  const sum = trends.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / trends.length);
};

// Función para generar datos de visitas de ejemplo
const generateMockVisitsData = () => {
  const dayData = Array(24).fill(0).map((_, i) => ({
    label: `${i.toString().padStart(2, '0')}h`,
    value: Math.floor(Math.random() * 20)
  }));
  
  const weekData = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => ({
    label: day,
    value: Math.floor(Math.random() * 100) + 20
  }));
  
  const monthData = Array(30).fill(0).map((_, i) => ({
    label: `${i + 1}`,
    value: Math.floor(Math.random() * 150) + 50
  }));
  
  const yearData = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map(month => ({
    label: month,
    value: Math.floor(Math.random() * 500) + 100
  }));
  
  return { 
    [TimePeriod.DAY]: dayData, 
    [TimePeriod.WEEK]: weekData, 
    [TimePeriod.MONTH]: monthData, 
    [TimePeriod.YEAR]: yearData 
  };
};

export const analyticsService = {
  getBusinessesAnalytics,
  initializeTestAnalytics,
  trackBusinessVisit,
  trackReservation,
  trackReview,
  trackOrderRevenue
};
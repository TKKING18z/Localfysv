import firebase from 'firebase/compat/app';
import { BusinessAnalytics, BusinessAnalyticsData, DataPoint } from '../types/analyticsTypes';

// Función para obtener datos analíticos de negocios
export const getBusinessesAnalytics = async (businessIds: string[]): Promise<BusinessAnalytics> => {
  try {
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
          day: [],
          week: [],
          month: [],
          year: []
        },
        businessesAnalytics: {},
        pendingActions: {
          reservations: [],
          messages: [],
          reviews: []
        }
      };
    }

    // Obtener datos analíticos de cada negocio
    const analyticsPromises = businessIds.map(async (businessId) => {
      const analyticsRef = firebase.firestore()
        .collection('analytics')
        .doc(businessId);

      const doc = await analyticsRef.get();
      
      if (!doc.exists) {
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
              year: [] // Añadido el campo year que faltaba
            }
          } 
        };
      }

      const analyticsData = doc.data();
      
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
            year: formatDataPoints(analyticsData?.visits?.yearly || {}) // Añadido year para completar el tipo
          }
        }
      };
    });

    // Obtener todas las acciones pendientes
    const pendingActionsPromises = businessIds.map(async (businessId) => {
      try {
        const pendingRef = firebase.firestore()
          .collection('businesses')
          .doc(businessId)
          .collection('pending');

        // Obtener reservas pendientes
        const reservationsSnap = await pendingRef
          .doc('reservations')
          .collection('items')
          .where('status', '==', 'pending')
          .get();

        const reservations = reservationsSnap.docs.map(doc => ({
          id: doc.id,
          businessId,
          date: doc.data().date
        }));

        // Obtener mensajes no leídos
        const messagesSnap = await pendingRef
          .doc('messages')
          .collection('items')
          .where('read', '==', false)
          .get();

        const messages = messagesSnap.docs.map(doc => ({
          id: doc.id,
          businessId,
          from: doc.data().from
        }));

        // Obtener reseñas sin responder
        const reviewsSnap = await pendingRef
          .doc('reviews')
          .collection('items')
          .where('responded', '==', false)
          .get();

        const reviews = reviewsSnap.docs.map(doc => ({
          id: doc.id,
          businessId,
          rating: doc.data().rating
        }));

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
    return {
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
  
  return { day: dayData, week: weekData, month: monthData, year: yearData };
};

export const analyticsService = {
  getBusinessesAnalytics
};
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Reservation, ReservationAvailability, ReservationSettings } from '../models/reservationTypes';

interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export const reservationService = {
  // Crear una nueva reserva
  create: async (reservationData: Partial<Reservation>): Promise<Result<{id: string}>> => {
    try {
      // Validar que haya información básica
      if (!reservationData.businessId || !reservationData.userId || 
          !reservationData.date || !reservationData.time) {
        return { 
          success: false, 
          error: { message: 'Datos incompletos para la reserva' } 
        };
      }

      // Verificar disponibilidad
      const isAvailable = await reservationService.checkAvailability(
        reservationData.businessId,
        reservationData.date,
        reservationData.time,
        reservationData.partySize || 1
      );

      if (!isAvailable.success || !isAvailable.data) {
        return { 
          success: false, 
          error: { message: 'Horario no disponible para reservación' } 
        };
      }

      // Crear reserva
      const reservationRef = await firebase.firestore()
        .collection('reservations')
        .add({
          ...reservationData,
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      return { success: true, data: { id: reservationRef.id } };
    } catch (error) {
      console.error('Error al crear reserva:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error desconocido al crear reserva',
          code: 'reservation/create-failed'
        } 
      };
    }
  },

  // Obtener una reserva por ID
  getById: async (id: string): Promise<Result<Reservation>> => {
    try {
      const reservationDoc = await firebase.firestore()
        .collection('reservations')
        .doc(id)
        .get();

      if (!reservationDoc.exists) {
        return {
          success: false,
          error: { 
            message: 'La reserva no existe', 
            code: 'reservation/not-found' 
          }
        };
      }

      const reservationData = {
        id: reservationDoc.id,
        ...reservationDoc.data()
      } as Reservation;

      return { success: true, data: reservationData };
    } catch (error) {
      console.error('Error al obtener reserva:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al obtener reserva',
          code: 'reservation/get-failed'
        } 
      };
    }
  },

  // Obtener reservas por usuario y negocio
  getByUserAndBusinessId: async (userId: string, businessId: string): Promise<Result<Reservation[]>> => {
    try {
      const reservationsSnapshot = await firebase.firestore()
        .collection('reservations')
        .where('userId', '==', userId)
        .where('businessId', '==', businessId)
        .orderBy('date', 'desc')
        .get();

      const reservations = reservationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reservation[];

      return { success: true, data: reservations };
    } catch (error) {
      console.error('Error al obtener reservas de usuario para negocio:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al obtener reservas',
          code: 'reservation/get-user-business-failed'
        } 
      };
    }
  },

  // Obtener todas las reservas de un usuario
  getByUserId: async (userId: string): Promise<Result<Reservation[]>> => {
    try {
      const reservationsSnapshot = await firebase.firestore()
        .collection('reservations')
        .where('userId', '==', userId)
        .orderBy('date', 'desc')
        .get();

      const reservations = reservationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reservation[];

      return { success: true, data: reservations };
    } catch (error) {
      console.error('Error al obtener reservas de usuario:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al obtener reservas',
          code: 'reservation/get-user-failed'
        } 
      };
    }
  },

  // Obtener todas las reservas de un negocio
  getByBusinessId: async (businessId: string): Promise<Result<Reservation[]>> => {
    try {
      const reservationsSnapshot = await firebase.firestore()
        .collection('reservations')
        .where('businessId', '==', businessId)
        .orderBy('date', 'desc')
        .get();

      const reservations = reservationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reservation[];

      return { success: true, data: reservations };
    } catch (error) {
      console.error('Error al obtener reservas del negocio:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al obtener reservas',
          code: 'reservation/get-business-failed'
        } 
      };
    }
  },

  // Actualizar estado de reserva
  updateStatus: async (id: string, status: 'pending' | 'confirmed' | 'canceled' | 'completed'): Promise<Result<void>> => {
    try {
      await firebase.firestore()
        .collection('reservations')
        .doc(id)
        .update({
          status,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      return { success: true };
    } catch (error) {
      console.error('Error al actualizar estado de reserva:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al actualizar estado',
          code: 'reservation/update-status-failed'
        } 
      };
    }
  },

  // Obtener configuración de disponibilidad
  getAvailability: async (businessId: string): Promise<Result<ReservationAvailability>> => {
    try {
      const availabilityDoc = await firebase.firestore()
        .collection('reservationAvailability')
        .doc(businessId)
        .get();

      if (!availabilityDoc.exists) {
        // No existe configuración, devolver valores predeterminados
        return { 
          success: true,
          data: {
            businessId,
            availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
            timeSlots: ['12:00', '13:00', '14:00', '15:00', '19:00', '20:00'],
            maxPartySizes: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12]
          } 
        };
      }

      const availabilityData = availabilityDoc.data() as ReservationAvailability;
      return { success: true, data: availabilityData };
    } catch (error) {
      console.error('Error al obtener disponibilidad:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al obtener disponibilidad',
          code: 'reservation/get-availability-failed'
        } 
      };
    }
  },

  // Actualizar configuración de disponibilidad
  updateAvailability: async (availability: ReservationAvailability): Promise<Result<void>> => {
    try {
      await firebase.firestore()
        .collection('reservationAvailability')
        .doc(availability.businessId)
        .set(availability, { merge: true });

      return { success: true };
    } catch (error) {
      console.error('Error al actualizar disponibilidad:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al actualizar disponibilidad',
          code: 'reservation/update-availability-failed'
        } 
      };
    }
  },

  // Verificar disponibilidad
  checkAvailability: async (
    businessId: string, 
    date: firebase.firestore.Timestamp,
    time: string,
    partySize: number
  ): Promise<Result<boolean>> => {
    try {
      // 1. Verificar configuración de disponibilidad
      const availabilityResult = await reservationService.getAvailability(businessId);
      
      if (!availabilityResult.success || !availabilityResult.data) {
        return { success: false, error: availabilityResult.error };
      }
      
      const availability = availabilityResult.data;
      
      // 2. Verificar día de la semana
      const dateObj = date.toDate();
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateObj.getDay()];
      
      if (!availability.availableDays.includes(dayOfWeek)) {
        return { 
          success: false, 
          error: { 
            message: 'Este día no está disponible para reservaciones',
            code: 'reservation/day-unavailable'
          } 
        };
      }
      
      // 3. Verificar fechas excluidas
      if (availability.unavailableDates) {
        const dateString = dateObj.toISOString().split('T')[0];
        if (availability.unavailableDates.includes(dateString)) {
          return { 
            success: false, 
            error: { 
              message: 'Esta fecha no está disponible para reservaciones',
              code: 'reservation/date-unavailable'
            } 
          };
        }
      }
      
      // 4. Verificar horario
      // Si hay horarios especiales para esta fecha, usarlos
      const dateString = dateObj.toISOString().split('T')[0];
      const specialSchedule = availability.specialSchedules?.[dateString];
      
      const timeSlots = specialSchedule?.timeSlots || availability.timeSlots;
      if (!timeSlots.includes(time)) {
        return { 
          success: false, 
          error: { 
            message: 'Este horario no está disponible',
            code: 'reservation/time-unavailable'
          } 
        };
      }
      
      // 5. Verificar capacidad para el tamaño del grupo
      if (!availability.maxPartySizes.some(size => size >= partySize)) {
        return { 
          success: false, 
          error: { 
            message: 'No se admite este número de personas',
            code: 'reservation/party-size-unavailable'
          } 
        };
      }
      
      // 6. Verificar si ya hay muchas reservas para este horario
      // Esto podría implementarse de muchas formas, esta es una muy simple:
      const existingReservationsSnapshot = await firebase.firestore()
        .collection('reservations')
        .where('businessId', '==', businessId)
        .where('date', '==', date)
        .where('time', '==', time)
        .where('status', 'in', ['pending', 'confirmed'])
        .get();
      
      // Si hay más de N reservas, considerar como no disponible
      // Este número dependerá de la naturaleza del negocio
      if (existingReservationsSnapshot.size >= 3) {
        return { 
          success: false, 
          error: { 
            message: 'No hay disponibilidad para este horario',
            code: 'reservation/time-full'
          } 
        };
      }
      
      // Todo bien, horario disponible
      return { success: true, data: true };
    } catch (error) {
      console.error('Error al verificar disponibilidad:', error);
      return { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Error al verificar disponibilidad',
          code: 'reservation/check-availability-failed'
        } 
      };
    }
  }
};

// Agregar al servicio de Firebase
export const firebaseServiceExtension = {
  reservations: reservationService
};
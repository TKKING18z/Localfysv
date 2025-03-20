import { useState, useEffect, useCallback } from 'react';
import { Reservation } from '../models/reservationTypes';
import { reservationService } from '../services/reservationService';

export enum ReservationFilter {
  ALL = 'all',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  ACTIVE = 'active', // pending o confirmed
  INACTIVE = 'inactive' // completed o canceled
}

interface UseReservationsProps {
  userId?: string;
  businessId?: string;
  initialFilter?: ReservationFilter;
}

export function useReservations({ 
  userId, 
  businessId,
  initialFilter = ReservationFilter.ALL 
}: UseReservationsProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<ReservationFilter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Cargar reservaciones al iniciar
  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let result;

      if (userId && businessId) {
        // Reservaciones de un usuario para un negocio específico
        result = await reservationService.getByUserAndBusinessId(userId, businessId);
      } else if (userId) {
        // Todas las reservaciones de un usuario
        result = await reservationService.getByUserId(userId);
      } else if (businessId) {
        // Todas las reservaciones de un negocio
        result = await reservationService.getByBusinessId(businessId);
      } else {
        setError('Se requiere userId o businessId');
        setLoading(false);
        return;
      }

      if (result.success && result.data) {
        setReservations(result.data);
      } else {
        setError(result.error?.message || 'Error al cargar reservaciones');
      }
    } catch (err) {
      console.error('Error en useReservations:', err);
      setError('Error inesperado al cargar reservaciones');
    } finally {
      setLoading(false);
    }
  }, [userId, businessId]);

  // Cargar al montar o cuando cambien las dependencias
  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  // Filtrar reservaciones según el filtro activo
  useEffect(() => {
    if (!reservations.length) {
      setFilteredReservations([]);
      return;
    }

    let filtered: Reservation[];

    switch (filter) {
      case ReservationFilter.PENDING:
        filtered = reservations.filter(r => r.status === 'pending');
        break;
      case ReservationFilter.CONFIRMED:
        filtered = reservations.filter(r => r.status === 'confirmed');
        break;
      case ReservationFilter.COMPLETED:
        filtered = reservations.filter(r => r.status === 'completed');
        break;
      case ReservationFilter.CANCELED:
        filtered = reservations.filter(r => r.status === 'canceled');
        break;
      case ReservationFilter.ACTIVE:
        filtered = reservations.filter(r => 
          r.status === 'pending' || r.status === 'confirmed');
        break;
      case ReservationFilter.INACTIVE:
        filtered = reservations.filter(r => 
          r.status === 'completed' || r.status === 'canceled');
        break;
      case ReservationFilter.ALL:
      default:
        filtered = [...reservations];
    }

    // Ordenar por fecha, más recientes primero
    filtered.sort((a, b) => {
      const dateA = a.date.toDate?.() || new Date();
      const dateB = b.date.toDate?.() || new Date();
      return dateB.getTime() - dateA.getTime();
    });

    setFilteredReservations(filtered);
  }, [reservations, filter]);

  // Función de refresco
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadReservations();
    setRefreshing(false);
  }, [loadReservations]);

  // Actualizar estado de una reserva
  const updateStatus = useCallback(async (
    reservationId: string, 
    status: 'pending' | 'confirmed' | 'canceled' | 'completed'
  ) => {
    try {
      const result = await reservationService.updateStatus(reservationId, status);
      
      if (result.success) {
        // Actualizar localmente
        setReservations(prev => 
          prev.map(res => 
            res.id === reservationId ? { ...res, status } : res
          )
        );
        return true;
      } else {
        throw new Error(result.error?.message);
      }
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      return false;
    }
  }, []);

  // Funciones helper para estados comunes
  const cancelReservation = useCallback((reservationId: string) => {
    return updateStatus(reservationId, 'canceled');
  }, [updateStatus]);

  const confirmReservation = useCallback((reservationId: string) => {
    return updateStatus(reservationId, 'confirmed');
  }, [updateStatus]);

  const completeReservation = useCallback((reservationId: string) => {
    return updateStatus(reservationId, 'completed');
  }, [updateStatus]);

  // Agrupar reservaciones por fecha
  const getReservationsByDate = useCallback(() => {
    const grouped: {[key: string]: Reservation[]} = {};
    
    for (const reservation of filteredReservations) {
      try {
        const date = reservation.date.toDate();
        const dateStr = date.toISOString().split('T')[0];
        
        if (!grouped[dateStr]) {
          grouped[dateStr] = [];
        }
        
        grouped[dateStr].push(reservation);
      } catch (err) {
        console.error('Error agrupando reserva:', err);
      }
    }
    
    return grouped;
  }, [filteredReservations]);

  return {
    reservations: filteredReservations,
    loading,
    error,
    refreshing,
    filter,
    setFilter,
    refresh,
    updateStatus,
    cancelReservation,
    confirmReservation,
    completeReservation,
    getReservationsByDate,
  };
}
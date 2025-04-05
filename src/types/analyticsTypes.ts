/**
 * Tipos y interfaces para el sistema de analíticas de negocios de Localfy
 */

/**
 * Períodos de tiempo para los datos analíticos
 */
export enum TimePeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}

export interface DataPoint {
  /** Etiqueta para mostrar en el eje X */
  label: string;
  /** Valor numérico del punto de datos */
  value: number;
  /** Color opcional para este punto específico (sobreescribe el color por defecto) */
  color?: string;
}

/**
 * Datos analíticos completos para un negocio individual
 */
export interface BusinessAnalyticsData {
  /** Número total de visitas/vistas del perfil */
  visits: number;
  /** Visitas máximas históricas (referencia para comparaciones) */
  maxVisits?: number;
  /** Tendencia de visitas (porcentaje +/-) */
  visitsTrend?: number;
  /** Número total de reservaciones */
  reservations: number;
  /** Tendencia de reservaciones (porcentaje +/-) */
  reservationsTrend?: number;
  /** Ingresos estimados basados en reservaciones */
  revenue: number;
  /** Tendencia de ingresos (porcentaje +/-) */
  revenueTrend?: number;
  /** Calificación promedio (0-5) */
  rating: number;
  /** Datos detallados de visitas para diferentes períodos */
  visitsData?: {
    day: DataPoint[];
    week: DataPoint[];
    month: DataPoint[];
    year: DataPoint[];
  };
  /** Última actualización de los datos */
  lastUpdated?: string;
}

/**
 * Elementos pendientes que requieren atención
 */
export interface PendingActions {
  /** Reservaciones pendientes de confirmación */
  reservations: Array<{ 
    id: string; 
    businessId: string; 
    date: string;
    customerName?: string;
    partySize?: number;
  }>;
  /** Mensajes no leídos */
  messages: Array<{ 
    id: string; 
    businessId: string; 
    from: string;
    preview?: string;
    timestamp?: string;
  }>;
  /** Reseñas sin responder */
  reviews: Array<{ 
    id: string; 
    businessId: string; 
    rating: number;
    preview?: string;
    date?: string;
  }>;
}

/**
 * Analíticas agregadas para todos los negocios de un usuario
 */
export interface BusinessAnalytics {
  /** Número total de visitas a todos los negocios */
  totalVisits: number;
  /** Tendencia general de visitas (porcentaje +/-) */
  visitsTrend: number;
  /** Datos agregados de reservaciones */
  totalReservations: {
    count: number;
    confirmed: number;
    pending: number;
    value: number;
  };
  /** Tendencia general de reservaciones (porcentaje +/-) */
  reservationsTrend: number;
  /** Tendencia general de ingresos (porcentaje +/-) */
  revenueTrend: number;
  /** Calificación promedio global (0-5) */
  averageRating: number;
  /** Datos de visitas agregados por período */
  visitsData: {
    day: DataPoint[];
    week: DataPoint[];
    month: DataPoint[];
    year: DataPoint[];
  };
  /** Analíticas individuales por negocio */
  businessesAnalytics: Record<string, BusinessAnalyticsData>;
  /** Elementos pendientes que requieren atención */
  pendingActions: PendingActions;
  /** Fecha de la última actualización */
  lastUpdated?: string;
}

/**
 * Opciones para filtrar datos analíticos
 */
export interface AnalyticsFilterOptions {
  /** Período de tiempo a mostrar */
  period: TimePeriod;
  /** Categoría para filtrar */
  category?: string;
  /** ID de negocio específico (opcional) */
  businessId?: string;
  /** Fecha de inicio para filtrar */
  startDate?: string;
  /** Fecha de fin para filtrar */
  endDate?: string;
}
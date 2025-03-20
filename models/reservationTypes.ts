import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export interface Reservation {
  id: string;
  businessId: string;
  businessName: string;
  userId: string;
  userName: string;
  userEmail?: string;
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  date: firebase.firestore.Timestamp;
  time: string;
  partySize: number;
  notes?: string;
  status: 'pending' | 'confirmed' | 'canceled' | 'completed';
  createdAt: firebase.firestore.Timestamp;
}

export interface ReservationAvailability {
  businessId: string;
  availableDays: string[]; // 'monday', 'tuesday', etc.
  timeSlots: string[]; // '12:00', '12:30', etc.
  maxPartySizes: number[];
  unavailableDates?: string[]; // ISO format dates that are unavailable
  specialSchedules?: {
    [date: string]: { // ISO format date
      timeSlots: string[];
    }
  };
}

export interface ReservationSettings {
  enabled: boolean;
  maxGuestsPerTable: number;
  timeSlots: string[];
  availableDays: string[];
}

export interface ReservationStats {
  totalCount: number;
  pendingCount: number;
  confirmedCount: number;
  canceledCount: number;
  completedCount: number;
  // Análisis por tiempo
  byDay: {[key: string]: number};
  byHour: {[key: string]: number};
}

export const DEFAULT_TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
  '15:00', '15:30', '19:00', '19:30', '20:00', '20:30'
];

export const DEFAULT_PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];

export const DEFAULT_AVAILABLE_DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];
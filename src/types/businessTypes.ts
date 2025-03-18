// Importar firebase correctamente al inicio del archivo
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';  // Añadir esta importación

// BusinessHours interface definition
export interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}

export interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
  [key: string]: DayHours | undefined;
}

// BusinessLocation interface
export interface BusinessLocation {
  latitude: number;
  longitude: number;
}

// VideoItem interface
export interface VideoItem {
  id?: string;
  url: string;
  thumbnail?: string;
}

// MenuItem interface
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

// BusinessImage interface
export interface BusinessImage {
  id?: string;
  url: string;
  isMain?: boolean;
}

// SocialLinks interface - making it compatible with Record<string, string>
export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  website?: string;
  [key: string]: string | undefined; // Add index signature
}

// Reservation settings interface
export interface ReservationSettings {
  enabled: boolean;
  maxGuestsPerTable: number;
  timeSlots: string[];
  availableDays: string[];
}

// Promotion interface
export interface Promotion {
  id: string;
  businessId: string;
  title: string;
  description: string;
  imageUrl?: string;
  startDate: firebase.firestore.Timestamp;
  endDate: firebase.firestore.Timestamp;
  discountType: 'percentage' | 'fixed' | 'special';
  discountValue?: number;
  termsAndConditions?: string;
  isActive: boolean;
  promoCode?: string;
  createdAt: firebase.firestore.Timestamp;
}

// Reservation interface
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

// Reservation availability interface
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

// Updated Business interface with all properties
export interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  location?: BusinessLocation;
  businessHours?: BusinessHours;
  paymentMethods?: string[];
  socialLinks?: SocialLinks; // Using the interface with index signature
  videos?: VideoItem[];
  menu?: MenuItem[];
  menuUrl?: string;
  images?: BusinessImage[];
  acceptsReservations?: boolean; // Added this property
  reservationSettings?: ReservationSettings; // Added this property
  createdAt?: any;
  updatedAt?: any;
  createdBy: string;
}

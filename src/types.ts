// src/types.ts
import { User } from 'firebase/auth';

// Definición de roles de usuario
export type UserRole = 'customer' | 'business_owner';

// Interfaz de usuario extendida
export interface AuthUser extends User {
  id: string;
  email: string;
  role?: UserRole;
  name?: string;
  phone?: string;
  address?: string;
}

export interface OnboardingParams {
  onboardingContext?: {
    completeOnboarding: () => Promise<boolean>;
  }
}

// Review interface - updated to match the model
export interface Review {
  id: string;
  userId: string;
  businessId: string;
  rating: number;
  text: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  moderationStatus: string;
  // Add other review properties as needed
}

// Stats for the reviews
export interface ReviewsStats {
  averageRating: number;
  totalReviews: number; // Changed from 'count' to match actual implementation
  distribution?: Record<string, number>; // Distribution of ratings
  // Other stats properties
}

// Valid sort methods for reviews
export type ReviewSortMethod = 'recent' | 'rating' | 'relevant';

// Props for BusinessReviewsScreen
export interface BusinessReviewsScreenProps {
  businessId: string;
  currentUserId: string;
  isOwner: boolean;
}

// Definiciones de navegación
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: OnboardingParams;
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Welcome: undefined;
  Home: undefined;
  // Otras pantallas que añadirás después
};
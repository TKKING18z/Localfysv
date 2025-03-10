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

// Definiciones de navegación
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: OnboardingParams;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Home: undefined; // Add this line to include the Home screen
  // Otras pantallas que añadirás después
};
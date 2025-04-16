import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definir la interfaz del contexto
interface OnboardingContextType {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<boolean>;
}

// Crear el contexto con un valor por defecto seguro
const OnboardingContext = createContext<OnboardingContextType>({
  hasCompletedOnboarding: false,
  completeOnboarding: async () => false,
});

// Hook personalizado para usar el contexto
export const useOnboarding = () => useContext(OnboardingContext);

// Proveedor del contexto
export const OnboardingProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  
  // Verificar si el onboarding ya fue completado al inicio
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
        if (onboardingCompleted === 'true') {
          setHasCompletedOnboarding(true);
        }
      } catch (error) {
        console.error('Error al verificar estado de onboarding:', error);
      }
    };
    
    checkOnboardingStatus();
  }, []);
  
  // Función para completar el onboarding
  const completeOnboarding = async () => {
    try {
      // Guardar en AsyncStorage que el onboarding fue completado
      await AsyncStorage.setItem('onboarding_completed', 'true');
      setHasCompletedOnboarding(true);
      console.log('Onboarding completado y guardado');
      return true;
    } catch (error) {
      console.error('Error al completar onboarding:', error);
      return false;
    }
  };
  
  // Valores que proporcionará el contexto
  const value = {
    hasCompletedOnboarding,
    completeOnboarding
  };
  
  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}; 
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { getCurrentLocation, startLocationUpdates, stopLocationUpdates, UserLocation, requestLocationPermission } from '../services/LocationService';

// Define el tipo para el contexto de ubicación
interface LocationContextType {
  userLocation: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  permissionGranted: boolean | null;
  refreshLocation: () => Promise<void>;
}

// Crear el contexto con un valor inicial undefined
const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Hook personalizado para usar el contexto de ubicación
export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext debe ser usado dentro de un LocationProvider');
  }
  return context;
};

// Props para el componente LocationProvider
interface LocationProviderProps {
  children: ReactNode;
}

// Componente proveedor de ubicación
export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  // Estado para la ubicación del usuario
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Inicializar la ubicación al montar el componente
  useEffect(() => {
    let isMounted = true;
    
    const initLocation = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Solicitar permisos de ubicación
        const hasPermission = await requestLocationPermission();
        setPermissionGranted(hasPermission);
        
        if (!hasPermission) {
          setError('Se requieren permisos de ubicación para mostrar negocios cercanos');
          setIsLoading(false);
          
          // En iOS, mostrar un mensaje para que el usuario active los permisos manualmente
          if (Platform.OS === 'ios' && retryCount < 1) {
            Alert.alert(
              'Permisos de Ubicación',
              'Localfy necesita acceso a tu ubicación para mostrarte negocios cercanos. Por favor, activa los permisos en Configuración > Privacidad > Localización.',
              [{ text: 'OK' }]
            );
            setRetryCount(retryCount + 1);
          }
          return;
        }
        
        // Obtener la ubicación actual
        const location = await getCurrentLocation();
        
        if (isMounted) {
          if (location) {
            setUserLocation(location);
          } else {
            setError('No se pudo obtener la ubicación');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error inicializando ubicación:', err);
        if (isMounted) {
          setError('Error al obtener tu ubicación');
          setIsLoading(false);
        }
      }
    };

    initLocation();

    // Iniciar actualizaciones de ubicación
    if (permissionGranted) {
      startLocationUpdates((location) => {
        if (isMounted) {
          setUserLocation(location);
        }
      });
    }

    // Limpiar al desmontar
    return () => {
      isMounted = false;
      stopLocationUpdates();
    };
  }, [permissionGranted, retryCount]);

  // Función para actualizar manualmente la ubicación
  const refreshLocation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Verificar permisos nuevamente
      const hasPermission = await requestLocationPermission();
      setPermissionGranted(hasPermission);
      
      if (!hasPermission) {
        setError('Se requieren permisos de ubicación');
        setIsLoading(false);
        return;
      }
      
      // Obtener ubicación actualizada
      const location = await getCurrentLocation();
      
      if (location) {
        setUserLocation(location);
      } else {
        setError('No se pudo actualizar la ubicación');
      }
    } catch (err) {
      console.error('Error actualizando ubicación:', err);
      setError('Error al actualizar tu ubicación');
    } finally {
      setIsLoading(false);
    }
  };

  // Preparar el valor del contexto
  const contextValue: LocationContextType = {
    userLocation,
    isLoading,
    error,
    permissionGranted,
    refreshLocation
  };

  // Renderizar el proveedor de contexto con su valor
  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

export default LocationContext;
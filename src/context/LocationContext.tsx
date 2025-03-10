import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { getCurrentLocation, startLocationUpdates, stopLocationUpdates, UserLocation } from '../services/LocationService';

interface LocationContextType {
  userLocation: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  permissionGranted: boolean | null;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  // Initialize location on mount
  useEffect(() => {
    const initLocation = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const location = await getCurrentLocation();
        
        if (location) {
          setUserLocation(location);
          setPermissionGranted(true);
        } else {
          setPermissionGranted(false);
        }
      } catch (err) {
        console.error('Error initializing location:', err);
        setError('Error getting your location');
      } finally {
        setIsLoading(false);
      }
    };

    initLocation();

    // Start location updates
    startLocationUpdates((location) => {
      setUserLocation(location);
    });

    // Clean up on unmount
    return () => {
      stopLocationUpdates();
    };
  }, []);

  // Function to manually refresh location
  const refreshLocation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const location = await getCurrentLocation();
      
      if (location) {
        setUserLocation(location);
        setPermissionGranted(true);
      }
    } catch (err) {
      console.error('Error refreshing location:', err);
      setError('Error refreshing your location');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LocationContext.Provider
      value={{
        userLocation,
        isLoading,
        error,
        permissionGranted,
        refreshLocation
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export default LocationContext;
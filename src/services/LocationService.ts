import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LocationError {
  code: string;
  message: string;
}

// Request location permissions
export const requestLocationPermission = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
};

// Get current location
export const getCurrentLocation = async (): Promise<UserLocation | null> => {
  try {
    const hasPermission = await requestLocationPermission();
    
    if (!hasPermission) {
      console.log('Location permission not granted');
      return null;
    }

    const { coords, timestamp } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
    });

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? undefined,  // Convert null to undefined
      timestamp,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};

// Calculate distance between two coordinates in kilometers
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Format distance for display
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance.toFixed(1)} km`;
};

// Helper function to convert degrees to radians
const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

// Location watcher handling
let locationWatcher: Location.LocationSubscription | null = null;

// Start watching location changes
export const startLocationUpdates = async (
  callback: (location: UserLocation) => void
): Promise<void> => {
  try {
    const hasPermission = await requestLocationPermission();
    
    if (!hasPermission) {
      return;
    }

    // Stop any existing watcher
    if (locationWatcher) {
      locationWatcher.remove();
    }

    // Start new watcher
    locationWatcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 100,
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? undefined,  // Convert null to undefined
          timestamp: location.timestamp,
        });
      }
    );
  } catch (error) {
    console.error('Error setting up location updates:', error);
  }
};

// Stop watching location
export const stopLocationUpdates = (): void => {
  if (locationWatcher) {
    locationWatcher.remove();
    locationWatcher = null;
  }
};
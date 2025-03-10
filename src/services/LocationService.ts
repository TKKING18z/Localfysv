import * as Location from 'expo-location';
import { Platform } from 'react-native';

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

// Get current location with improved error handling
export const getCurrentLocation = async (): Promise<UserLocation | null> => {
  try {
    const hasPermission = await requestLocationPermission();
    
    if (!hasPermission) {
      console.log('Location permission not granted');
      return null;
    }

    // Different accuracy options based on platform
    const accuracyOption = Platform.OS === 'ios' 
      ? Location.Accuracy.Balanced 
      : Location.Accuracy.Low;

    const { coords, timestamp } = await Location.getCurrentPositionAsync({
      accuracy: accuracyOption,
      timeInterval: 10000,  // 10 seconds
      mayShowUserSettingsDialog: true
    });

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? undefined,
      timestamp,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    // Provide fallback location (default to San Salvador, El Salvador)
    if (__DEV__) {
      console.warn('Using fallback location for development');
      return {
        latitude: 13.6929,
        longitude: -89.2182,
        timestamp: Date.now()
      };
    }
    return null;
  }
};

// Calculate distance between two coordinates in kilometers with error handling
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  try {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  } catch (error) {
    console.error('Error calculating distance:', error);
    return 0; // Return 0 as fallback
  }
};

// Format distance for display with error handling
export const formatDistance = (distance: number): string => {
  try {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  } catch (error) {
    console.error('Error formatting distance:', error);
    return '-- km'; // Return placeholder on error
  }
};

// Helper function to convert degrees to radians
const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

// Location watcher handling
let locationWatcher: Location.LocationSubscription | null = null;

// Start watching location changes with error handling
export const startLocationUpdates = async (
  callback: (location: UserLocation) => void
): Promise<boolean> => {
  try {
    const hasPermission = await requestLocationPermission();
    
    if (!hasPermission) {
      return false;
    }

    // Stop any existing watcher
    if (locationWatcher) {
      await locationWatcher.remove();
    }

    // Set different options based on platform
    const options = {
      accuracy: Platform.OS === 'ios' ? Location.Accuracy.Balanced : Location.Accuracy.Low,
      timeInterval: 15000, // 15 seconds
      distanceInterval: 100, // 100 meters
    };

    // Start new watcher
    locationWatcher = await Location.watchPositionAsync(
      options,
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? undefined,
          timestamp: location.timestamp,
        });
      }
    );
    
    return true;
  } catch (error) {
    console.error('Error setting up location updates:', error);
    return false;
  }
};

// Stop watching location with error handling
export const stopLocationUpdates = (): void => {
  try {
    if (locationWatcher) {
      locationWatcher.remove();
      locationWatcher = null;
    }
  } catch (error) {
    console.error('Error stopping location updates:', error);
  }
};
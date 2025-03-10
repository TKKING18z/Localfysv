import { useLocationContext } from '../context/LocationContext';
import { calculateDistance, formatDistance } from '../services/LocationService';
import { Business } from '../context/BusinessContext';

// Define location interface
interface Location {
  latitude: number;
  longitude: number;
}

// Hook to handle location-related logic
export const useLocation = () => {
  const { userLocation, isLoading, error, permissionGranted, refreshLocation } = useLocationContext();

  // Calculate distance to a specific business
  const getDistanceToBusiness = (business: Business): number | undefined => {
    if (!userLocation || !business.location) {
      return undefined;
    }
    
    try {
      // Handle location whether it's an object or needs to be parsed
      let businessLocation;
      if (typeof business.location === 'string') {
        try {
          businessLocation = JSON.parse(business.location) as Location;
        } catch (error) {
          console.warn('Error parsing business location:', error);
          return undefined;
        }
      } else {
        businessLocation = business.location as Location;
      }
      
      if (!businessLocation.latitude || !businessLocation.longitude) {
        return undefined;
      }

      return calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        businessLocation.latitude,
        businessLocation.longitude
      );
    } catch (error) {
      console.warn('Error calculating distance:', error);
      return undefined;
    }
  };

  // Get formatted distance string
  const getFormattedDistance = (business: Business): string | undefined => {
    try {
      const distance = getDistanceToBusiness(business);
      if (distance === undefined) return undefined;
      
      return formatDistance(distance);
    } catch (error) {
      console.warn('Error formatting distance:', error);
      return undefined;
    }
  };

  // Sort businesses by distance
  const sortBusinessesByDistance = (businesses: Business[]): Business[] => {
    if (!userLocation) return businesses;

    try {
      return [...businesses].sort((a, b) => {
        const distanceA = getDistanceToBusiness(a);
        const distanceB = getDistanceToBusiness(b);
        
        if (distanceA === undefined) return 1;
        if (distanceB === undefined) return -1;
        
        return distanceA - distanceB;
      });
    } catch (error) {
      console.warn('Error sorting businesses by distance:', error);
      return businesses;
    }
  };

  // Filter businesses by maximum distance
  const filterBusinessesByDistance = (businesses: Business[], maxDistance: number): Business[] => {
    if (!userLocation) return businesses;

    try {
      return businesses.filter(business => {
        const distance = getDistanceToBusiness(business);
        if (distance === undefined) return false;
        
        return distance <= maxDistance;
      });
    } catch (error) {
      console.warn('Error filtering businesses by distance:', error);
      return businesses;
    }
  };

  return {
    userLocation,
    isLoading,
    error,
    permissionGranted,
    refreshLocation,
    getDistanceToBusiness,
    getFormattedDistance,
    sortBusinessesByDistance,
    filterBusinessesByDistance
  };
};
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
    
    // Handle location whether it's an object or needs to be parsed
    const businessLocation = typeof business.location === 'string' 
      ? JSON.parse(business.location) as Location
      : business.location as Location;
      
    if (!businessLocation.latitude || !businessLocation.longitude) {
      return undefined;
    }

    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      businessLocation.latitude,
      businessLocation.longitude
    );
  };

  // Get formatted distance string
  const getFormattedDistance = (business: Business): string | undefined => {
    const distance = getDistanceToBusiness(business);
    if (distance === undefined) return undefined;
    
    return formatDistance(distance);
  };

  // Sort businesses by distance
  const sortBusinessesByDistance = (businesses: Business[]): Business[] => {
    if (!userLocation) return businesses;

    return [...businesses].sort((a, b) => {
      const distanceA = getDistanceToBusiness(a);
      const distanceB = getDistanceToBusiness(b);
      
      if (distanceA === undefined) return 1;
      if (distanceB === undefined) return -1;
      
      return distanceA - distanceB;
    });
  };

  // Filter businesses by maximum distance
  const filterBusinessesByDistance = (businesses: Business[], maxDistance: number): Business[] => {
    if (!userLocation) return businesses;

    return businesses.filter(business => {
      const distance = getDistanceToBusiness(business);
      if (distance === undefined) return false;
      
      return distance <= maxDistance;
    });
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

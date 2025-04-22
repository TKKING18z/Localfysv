import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Easing, 
  TouchableOpacity, 
  Platform 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNetwork } from '../../context/NetworkContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OfflineBannerProps {
  /**
   * Text to display when offline
   */
  offlineText?: string;
  
  /**
   * Text to display when online with slow connection
   */
  slowConnectionText?: string;
  
  /**
   * Text to display for poor connection quality
   */
  poorQualityText?: string;
  
  /**
   * Whether to show a retry button
   */
  showRetryButton?: boolean;
  
  /**
   * Auto hide banner after X seconds when back online
   */
  autoHideDelay?: number;
  
  /**
   * Auto hide delay for poor connection (in seconds)
   */
  poorConnectionDelay?: number;
  
  /**
   * Auto hide delay for offline state (in seconds, 0 to disable auto-hide)
   */
  offlineDelay?: number;

  /**
   * Cooldown period before showing unstable connection banner again (in seconds)
   */
  unstableCooldownPeriod?: number;
  
  /**
   * Whether to show connection quality info for debugging
   */
  showDebugInfo?: boolean;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ 
  offlineText = 'Sin conexión a Internet', 
  slowConnectionText = 'Conexión lenta',
  poorQualityText = 'Conexión inestable',
  showRetryButton = true,
  autoHideDelay = 3,
  poorConnectionDelay = 5,
  offlineDelay = 0, // No auto-hide for offline by default
  unstableCooldownPeriod = 60, // 60 seconds cooldown for unstable connections
  showDebugInfo = false
}) => {
  const { 
    isConnected, 
    isInternetReachable, 
    isSlowConnection, 
    connectionQuality,
    isLowPerformanceDevice,
    connectionType,
    handleConnectionChange 
  } = useNetwork();
  
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(false);
  const [lastConnectionState, setLastConnectionState] = useState<string | null>(null);
  const [lastPoorConnectionTime, setLastPoorConnectionTime] = useState<number>(0);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation values
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  // Determinar si el banner debe mostrarse basado en el estado de la red con debounce
  const { shouldShowBanner, currentState } = useMemo(() => {
    const isOffline = !isConnected || isInternetReachable === false;
    const isPoorConnection = connectionQuality === 'poor';
    const isWarningConnection = connectionQuality === 'fair' && isLowPerformanceDevice;
    
    let state = '';
    if (isOffline) state = 'offline';
    else if (isPoorConnection) state = 'poor';
    else if (isWarningConnection || isSlowConnection) state = 'slow';
    else state = 'good';
    
    // Check if we're in cooldown period for unstable connections
    const inCooldownPeriod = (state === 'poor' || state === 'slow') && 
                             isCoolingDown &&
                             lastConnectionState === state;
    
    return {
      shouldShowBanner: (isOffline || 
                        (isPoorConnection && !inCooldownPeriod) || 
                        (isWarningConnection && !inCooldownPeriod) || 
                        (isSlowConnection && !inCooldownPeriod)),
      currentState: state
    };
  }, [isConnected, isInternetReachable, connectionQuality, isLowPerformanceDevice, isSlowConnection, isCoolingDown, lastConnectionState]);
  
  // Determinar mensaje y color según estado de conexión
  const { message, iconName, bannerColor, bannerStyle } = useMemo(() => {
    const isOffline = !isConnected || isInternetReachable === false;
    
    if (isOffline) {
      return {
        message: offlineText,
        iconName: 'wifi-off' as any,
        bannerColor: '#FF3B30',
        bannerStyle: styles.offlineBanner
      };
    }
    
    if (connectionQuality === 'poor') {
      return {
        message: poorQualityText,
        iconName: 'signal-cellular-0-bar' as any,
        bannerColor: '#FF9500',
        bannerStyle: styles.poorBanner
      };
    }
    
    if (isSlowConnection || connectionQuality === 'fair') {
      return {
        message: slowConnectionText,
        iconName: 'network-cell' as any,
        bannerColor: '#FFCC00',
        bannerStyle: styles.slowBanner
      };
    }
    
    // Default - no debería llegar aquí si shouldShowBanner es correcto
    return {
      message: '',
      iconName: 'wifi' as any,
      bannerColor: '#34C759',
      bannerStyle: styles.normalBanner
    };
  }, [isConnected, isInternetReachable, connectionQuality, isSlowConnection, offlineText, slowConnectionText, poorQualityText]);
  
  // Apply debounce for network state changes
  useEffect(() => {
    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // For unstable connections, debounce to avoid flashing banner for momentary issues
    if (currentState === 'poor' || currentState === 'slow') {
      // If it's the first time or a new type of poor connection, show it immediately
      if (lastConnectionState !== currentState) {
        processNetworkStateChange();
      } else {
        // Otherwise debounce
        debounceTimeoutRef.current = setTimeout(() => {
          processNetworkStateChange();
        }, 2000); // 2 second debounce
      }
    } else {
      // For offline or good states, process immediately
      processNetworkStateChange();
    }
    
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [currentState]);
  
  // Process network state change after debounce
  const processNetworkStateChange = () => {
    // Detect state changes to reset timeout
    const stateChanged = currentState !== lastConnectionState;
    setLastConnectionState(currentState);
    
    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    // Handle cooldown period for unstable connections
    if ((currentState === 'poor' || currentState === 'slow')) {
      const now = Date.now();
      const timeSinceLastShow = now - lastPoorConnectionTime;
      
      // If we've shown this recently and are in cooldown, don't show again
      if (lastPoorConnectionTime > 0 && timeSinceLastShow < unstableCooldownPeriod * 1000) {
        // Skip showing banner during cooldown
        if (!isVisible) return;
      } else if (shouldShowBanner) {
        // Past cooldown period, update the timestamp
        setLastPoorConnectionTime(now);
        setIsCoolingDown(false);
      }
    }
    
    if (shouldShowBanner) {
      showBanner();
      
      // Set auto-hide timeout based on connection state
      let delay = autoHideDelay;
      
      if (currentState === 'offline') {
        delay = offlineDelay;
      } else if (currentState === 'poor' || currentState === 'slow') {
        delay = poorConnectionDelay;
      }
      
      // Only set auto-hide if delay > 0
      if (delay > 0) {
        hideTimeoutRef.current = setTimeout(() => {
          hideBanner();
          
          // Set cooldown period for unstable connections
          if (currentState === 'poor' || currentState === 'slow') {
            setIsCoolingDown(true);
          }
        }, delay * 1000);
      }
    } else if (isVisible && currentState === 'good') {
      // Auto hide when back online
      hideTimeoutRef.current = setTimeout(() => {
        hideBanner();
      }, 1000); // Hide quickly when connection is restored
    }
  };
  
  // Show the banner with animation
  const showBanner = () => {
    setIsVisible(true);
    
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  // Hide the banner with animation
  const hideBanner = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
    });
  };
  
  // Handle retry button press
  const handleRetry = () => {
    handleConnectionChange();
  };
  
  // If never visible, don't render anything
  if (!isVisible) {
    return null;
  }
  
  return (
    <Animated.View 
      style={[
        styles.container,
        bannerStyle,
        { 
          backgroundColor: bannerColor,
          transform: [{ translateY }],
          opacity,
          paddingTop: insets.top > 0 ? insets.top : 4,
        }
      ]}
    >
      <View style={styles.content}>
        <MaterialIcons name={iconName} size={16} color="#FFFFFF" />
        <Text style={styles.text}>{message}</Text>
        
        {showRetryButton && (
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <MaterialIcons name="refresh" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      
      {showDebugInfo && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Tipo: {connectionType} | Calidad: {connectionQuality} | 
            Gama baja: {isLowPerformanceDevice ? 'Sí' : 'No'} |
            Cooldown: {isCoolingDown ? 'Sí' : 'No'}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 4,
    zIndex: 1000,
    elevation: 5,
  },
  offlineBanner: {
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  poorBanner: {
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  slowBanner: {
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  normalBanner: {
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
    textAlign: 'center',
  },
  retryButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  debugContainer: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 2,
    alignItems: 'center',
  },
  debugText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 9,
  }
});

export default OfflineBanner; 
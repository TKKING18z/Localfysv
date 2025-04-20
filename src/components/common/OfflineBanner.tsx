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
   * Auto hide banner after X seconds when back online (0 to disable)
   */
  autoHideDelay?: number;
  
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
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation values
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  // Determinar si el banner debe mostrarse basado en el estado de la red
  const shouldShowBanner = useMemo(() => {
    const isOffline = !isConnected || isInternetReachable === false;
    const isPoorConnection = connectionQuality === 'poor';
    const isWarningConnection = connectionQuality === 'fair' && isLowPerformanceDevice;
    
    return isOffline || isPoorConnection || isWarningConnection || isSlowConnection;
  }, [isConnected, isInternetReachable, connectionQuality, isLowPerformanceDevice, isSlowConnection]);
  
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
  
  // Update banner visibility based on connection state
  useEffect(() => {
    // Limpiar cualquier timeout anterior
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    if (shouldShowBanner) {
      showBanner();
    } else if (isVisible) {
      // Auto hide when back online
      if (autoHideDelay > 0) {
        hideTimeoutRef.current = setTimeout(() => {
          hideBanner();
        }, autoHideDelay * 1000);
      }
    }
    
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [shouldShowBanner, autoHideDelay, isVisible]);
  
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
          paddingTop: insets.top > 0 ? insets.top : 8,
        }
      ]}
    >
      <View style={styles.content}>
        <MaterialIcons name={iconName} size={20} color="#FFFFFF" />
        <Text style={styles.text}>{message}</Text>
        
        {showRetryButton && (
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      
      {showDebugInfo && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Tipo: {connectionType} | Calidad: {connectionQuality} | 
            Gama baja: {isLowPerformanceDevice ? 'Sí' : 'No'}
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
    paddingBottom: 8,
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
    paddingHorizontal: 16,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    textAlign: 'center',
  },
  retryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  debugContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    alignItems: 'center',
  },
  debugText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
  }
});

export default OfflineBanner; 
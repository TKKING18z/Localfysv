import React, { useEffect, useState } from 'react';
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
   * Whether to show a retry button
   */
  showRetryButton?: boolean;
  
  /**
   * Auto hide banner after X seconds when back online (0 to disable)
   */
  autoHideDelay?: number;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ 
  offlineText = 'Sin conexión a Internet', 
  slowConnectionText = 'Conexión lenta',
  showRetryButton = true,
  autoHideDelay = 3
}) => {
  const { isConnected, isInternetReachable, isSlowConnection, handleConnectionChange } = useNetwork();
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Animation values
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  
  // Update banner visibility based on connection state
  useEffect(() => {
    const shouldShow = 
      !isConnected || 
      isInternetReachable === false || 
      isSlowConnection;
    
    if (shouldShow) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        setHideTimeout(null);
      }
      
      showBanner();
    } else if (isVisible) {
      // Auto hide when back online
      if (autoHideDelay > 0) {
        const timeout = setTimeout(() => {
          hideBanner();
          setHideTimeout(null);
        }, autoHideDelay * 1000);
        
        setHideTimeout(timeout);
      }
    }
    
    return () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [isConnected, isInternetReachable, isSlowConnection]);
  
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
  
  // Get appropriate message and icon
  const isOffline = !isConnected || isInternetReachable === false;
  const message = isOffline ? offlineText : slowConnectionText;
  const iconName = isOffline ? 'wifi-off' : 'signal-wifi-0-bar';
  const bannerColor = isOffline ? '#007AFF' : '#007AFF';
  
  return (
    <Animated.View 
      style={[
        styles.container,
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
    shadowColor: '#007AFF',
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
});

export default OfflineBanner; 
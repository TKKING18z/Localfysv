import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Navigation props type
type NavigationProps = StackNavigationProp<RootStackParamList>;

// Props for the InAppNotification component
interface InAppNotificationProps {
  title: string;
  message: string;
  type: 'chat' | 'order_new' | 'order_status' | 'system' | 'promo';
  data?: any;
  onDismiss: () => void;
  autoDismiss?: boolean;
  duration?: number;
}

const InAppNotification: React.FC<InAppNotificationProps> = ({
  title,
  message,
  type,
  data,
  onDismiss,
  autoDismiss = true,
  duration = 5000
}) => {
  const navigation = useNavigation<NavigationProps>();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Get icon based on notification type
  const getIcon = () => {
    switch (type) {
      case 'chat':
        return <MaterialIcons name="chat" size={22} color="#FFF" />;
      case 'order_new':
        return <FontAwesome5 name="shopping-bag" size={18} color="#FFF" />;
      case 'order_status':
        return <MaterialIcons name="delivery-dining" size={22} color="#FFF" />;
      case 'system':
        return <MaterialIcons name="info" size={22} color="#FFF" />;
      case 'promo':
        return <MaterialIcons name="local-offer" size={22} color="#FFF" />;
      default:
        return <MaterialIcons name="notifications" size={22} color="#FFF" />;
    }
  };

  // Get background color based on notification type
  const getBackgroundColor = () => {
    switch (type) {
      case 'chat':
        return '#007AFF';
      case 'order_new':
        return '#FF2D55';
      case 'order_status':
        return '#5856D6';
      case 'system':
        return '#FF9500';
      case 'promo':
        return '#34C759';
      default:
        return '#8E8E93';
    }
  };

  // Handle notification press
  const handlePress = () => {
    dismiss();

    // Navigate based on notification type
    switch (type) {
      case 'chat':
        if (data?.conversationId) {
          navigation.navigate('Chat', { conversationId: data.conversationId });
        }
        break;
      case 'order_new':
      case 'order_status':
        if (data?.orderId) {
          navigation.navigate('OrderDetails', { orderId: data.orderId });
        }
        break;
      case 'promo':
        if (data?.businessId) {
          navigation.navigate('BusinessDetail', { businessId: data.businessId });
        }
        break;
      case 'system':
        if (data?.screen) {
          navigation.navigate(data.screen);
        }
        break;
    }
  };

  // Show notification animation
  const showNotification = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Hide notification animation
  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!dismissed) {
        setDismissed(true);
        onDismiss();
      }
    });
  };

  // Dismiss the notification
  const dismiss = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    hideNotification();
  };

  // Show notification when component mounts
  useEffect(() => {
    showNotification();

    // Auto dismiss after duration
    if (autoDismiss) {
      timeoutRef.current = setTimeout(() => {
        hideNotification();
      }, duration);
    }

    // Clean up timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          transform: [{ translateY }],
          opacity,
          paddingTop: insets.top > 0 ? insets.top : 10,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismiss}
          hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
        >
          <MaterialIcons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InAppNotification; 
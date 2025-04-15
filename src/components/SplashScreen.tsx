// src/components/SplashScreen.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, Platform } from 'react-native';

const SplashScreen: React.FC = () => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  
  // Enhanced animation with smooth transition - both entrance and exit animations
  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
    
    // Set up exit animation after entrance is complete
    const timer = setTimeout(() => {
      // Exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.4,
          duration: 1300,
          useNativeDriver: true,
        })
      ]).start();
    }, 2200);
    
    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.Image
          source={require('../../assets/icon.png')}
          style={[
            styles.logo, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }] 
            }
          ]}
        />
        <Animated.Text 
          style={[
            styles.appName, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })}] 
            }
          ]}
        >
          Localfy
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 24,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
  },
});

export default SplashScreen;
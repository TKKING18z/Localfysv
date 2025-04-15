// src/screens/onboarding/OnboardingItem.tsx
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import LottieView from 'lottie-react-native';

interface OnboardingItemProps {
  item: {
    id: string;
    title: string;
    description: string;
    image: any;
  };
}

const OnboardingItem: React.FC<OnboardingItemProps> = ({ item }) => {
  const { width } = useWindowDimensions();
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    // Auto-play animation when component mounts
    if (animationRef.current) {
      animationRef.current.play();
    }
  }, []);
  
  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.animationContainer}>
        <LottieView
          ref={animationRef}
          source={item.image}
          style={[styles.animation, { width: width * 0.85 }]}
          autoPlay
          loop
          speed={0.8}
          resizeMode="contain"
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  animationContainer: {
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  animation: {
    height: 300,
  },
  content: {
    flex: 0.4,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 28,
    marginBottom: 16,
    color: '#007AFF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 17,
    color: '#62656b',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});

export default OnboardingItem;
// src/screens/onboarding/OnboardingItem.tsx
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Image } from 'react-native';
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
  const [useStaticFallback, setUseStaticFallback] = useState(false);
  
  useEffect(() => {
    // Intentar iniciar la animación
    try {
      if (animationRef.current) {
        setTimeout(() => {
          try {
            animationRef.current?.play();
          } catch (error) {
            console.warn('Error playing Lottie animation:', error);
            setUseStaticFallback(true);
          }
        }, 100);
      }
    } catch (error) {
      console.warn('Error setting up Lottie animation:', error);
      setUseStaticFallback(true);
    }
    
    // Establecer un timeout de seguridad para mostrar el fallback si la animación no carga
    const fallbackTimer = setTimeout(() => {
      if (!animationRef.current) {
        setUseStaticFallback(true);
      }
    }, 1000);
    
    return () => clearTimeout(fallbackTimer);
  }, []);
  
  // Renderizar estático o animación según el estado
  const renderContent = () => {
    // Usar un círculo de color como fallback si las animaciones fallan
    if (useStaticFallback) {
      return (
        <View style={[styles.fallbackContainer, {backgroundColor: getColorById(item.id)}]}>
          <Text style={styles.fallbackText}>{item.title.charAt(0)}</Text>
        </View>
      );
    }
    
    // Usar la animación Lottie 
    return (
      <LottieView 
        ref={animationRef}
        source={item.image} 
        style={styles.animation}
        autoPlay={false}
        loop={true}
        speed={0.7}
        resizeMode="cover"
        cacheComposition={true}
      />
    );
  };
  
  // Función para generar un color basado en el ID
  const getColorById = (id: string): string => {
    const colors = ['#4A55A2', '#7986CB', '#3949AB', '#5C6BC0'];
    const index = parseInt(id) % colors.length;
    return colors[index];
  };
  
  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.animationContainer}>
        {renderContent()}
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
  },
  animation: {
    width: 280,
    height: 280,
  },
  fallbackContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4A55A2',
  },
  fallbackText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 0.4,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 28,
    marginBottom: 10,
    color: '#4A55A2',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#62656b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default OnboardingItem;
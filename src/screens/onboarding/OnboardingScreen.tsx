// src/screens/onboarding/OnboardingScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  Animated, 
  TouchableOpacity, 
  Text,
  StatusBar,
  SafeAreaView,
  Alert 
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import OnboardingItem from './OnboardingItem';
import Paginator from './Paginator';
import NextButton from './NextButton';
import { useOnboarding } from '../../context/OnboardingContext';

type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const slides = [
  {
    id: '1',
    title: 'Descubre Negocios Locales',
    description: 'Encuentra los mejores negocios cerca de ti en El Salvador.',
    image: require('../../../assets/animations/discover.json'),
  },
  {
    id: '2',
    title: 'Compra en Línea',
    description: 'Realiza tus compras de manera fácil y segura desde la app.',
    image: require('../../../assets/animations/shopping.json'),
  },
  {
    id: '3',
    title: 'Seguimiento de Pedidos',
    description: 'Mantente informado del estado de tus pedidos en tiempo real.',
    image: require('../../../assets/animations/business.json'),
  },
  {
    id: '4',
    title: 'Promociona tu Negocio',
    description: '¿Tienes un negocio? Regístralo y llega a más clientes.',
    image: require('../../../assets/animations/delivery.json'),
  },
];

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const { completeOnboarding } = useOnboarding();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);
  // Flag para evitar navegación doble
  const [isNavigating, setIsNavigating] = useState(false);
  // Fade-in animation for smooth entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Start entrance animation on mount
  useEffect(() => {
    // Slight delay before starting animation to ensure smooth transition from splash
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [fadeAnim]);
  
  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    setCurrentIndex(viewableItems[0].index);
  }).current;
  
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  
  // Función que maneja toda la navegación desde el onboarding hacia el login
  const completeAndNavigate = async () => {
    // Evitar navegación doble
    if (isNavigating) return;
    setIsNavigating(true);
    
    try {
      // Usar la función del contexto para completar el onboarding
      await completeOnboarding();
      
      // Primero hacer un fade-out suave
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Usar CommonActions.reset para asegurar una navegación limpia
        // Esto reemplaza toda la pila de navegación con solo Auth
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              { 
                name: 'Auth'
              }
            ]
          })
        );
      });
    } catch (error) {
      console.log('Error completando el onboarding:', error);
      
      // En caso de error, intentar navegar de todos modos
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            { 
              name: 'Auth'
            }
          ]
        })
      );
    }
  };
  
  const scrollTo = async () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      // Última diapositiva, completar onboarding y navegar
      await completeAndNavigate();
    }
  };
  
  const skip = async () => {
    // Omitir, completar onboarding y navegar
    await completeAndNavigate();
  };
  
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={skip}
            style={styles.skipButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            disabled={isNavigating} // Deshabilitar durante la navegación
          >
            <Text style={styles.skipText}>Omitir</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.slidesContainer}>
          <FlatList
            data={slides}
            renderItem={({ item }) => <OnboardingItem item={item} />}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            bounces={false}
            keyExtractor={(item) => item.id}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={32}
            onViewableItemsChanged={viewableItemsChanged}
            viewabilityConfig={viewConfig}
            ref={slidesRef}
            decelerationRate="fast"
          />
        </View>
        
        <View style={styles.bottomContainer}>
          <Paginator data={slides} scrollX={scrollX} />
          <NextButton 
            percentage={(currentIndex + 1) * (100 / slides.length)} 
            onPress={scrollTo}
            disabled={isNavigating} // Deshabilitar durante la navegación 
          />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 10,
  },
  skipButton: {
    padding: 5,
  },
  skipText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  slidesContainer: {
    flex: 3,
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
});

export default OnboardingScreen;
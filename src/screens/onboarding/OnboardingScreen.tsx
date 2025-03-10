// src/screens/onboarding/OnboardingScreen.tsx
import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  Animated, 
  TouchableOpacity, 
  Text 
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import OnboardingItem from './OnboardingItem';
import Paginator from './Paginator';
import NextButton from './NextButton';

type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

type OnboardingScreenRouteProp = RouteProp<RootStackParamList, 'Onboarding'>;

const slides = [
  {
    id: '1',
    title: 'Descubre Negocios Locales',
    description: 'Encuentra los mejores negocios cerca de ti en El Salvador.',
    image: require('../../../assets/animations/discover.json'), // Reemplaza con tus imágenes
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
  const route = useRoute<OnboardingScreenRouteProp>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);
  
  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    setCurrentIndex(viewableItems[0].index);
  }).current;
  
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  
  const scrollTo = async () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      try {
        await route.params?.onboardingContext?.completeOnboarding();
        navigation.navigate('Login');
      } catch (error) {
        console.log('Error completing onboarding:', error);
      }
    }
  };
  
  const skip = async () => {
    try {
      await route.params?.onboardingContext?.completeOnboarding();
      navigation.navigate('Login');
    } catch (error) {
      console.log('Error skipping onboarding:', error);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.skipContainer}>
        <TouchableOpacity onPress={skip}>
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 3 }}>
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
        />
      </View>
      
      <Paginator data={slides} scrollX={scrollX} />
      <NextButton 
        percentage={(currentIndex + 1) * (100 / slides.length)} 
        onPress={scrollTo} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipContainer: {
    width: '90%',
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipText: {
    fontSize: 16,
    color: '#4A55A2',
    fontWeight: '600',
  },
});

export default OnboardingScreen;
import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Image, 
  Animated, 
  Dimensions 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useBusinessOnboarding } from '../../context/BusinessOnboardingContext';

type BusinessOnboardingWelcomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList, 
  'BusinessOnboardingWelcome'
>;

const { width } = Dimensions.get('window');

const BusinessOnboardingWelcomeScreen: React.FC = () => {
  const { recoverProgress, setOnboardingMode } = useBusinessOnboarding();
  const navigation = useNavigation<BusinessOnboardingWelcomeScreenNavigationProp>();
  
  // Animation values
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  
  // Run entrance animations
  useEffect(() => {
    Animated.sequence([
      // First animate the logo
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ]),
      // Then animate the text
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      // Finally, animate the buttons
      Animated.timing(buttonsOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);
  
  // Handle button presses
  const handleStartPress = () => {
    navigation.navigate('BusinessOnboardingModeSelection');
  };
  
  const handleContinuePress = async () => {
    const recovered = await recoverProgress();
    if (recovered) {
      navigation.navigate('BusinessOnboardingSteps');
    } else {
      // If no progress found, start new
      navigation.navigate('BusinessOnboardingModeSelection');
    }
  };
  
  const handleAlreadyHaveBusiness = () => {
    navigation.navigate('MyBusinesses');
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Animated logo */}
      <Animated.View style={[
        styles.logoContainer, 
        { 
          opacity: logoOpacity,
          transform: [{ scale: logoScale }] 
        }
      ]}>
        <Image 
          source={require('../../../assets/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      
      {/* Animated text content */}
      <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
        <Text style={styles.title}>Haz crecer tu negocio con Localfy</Text>
        <Text style={styles.subtitle}>
          Únete a la mayor comunidad de negocios locales de El Salvador.
          Configuremos tu perfil para maximizar tu visibilidad y atraer más clientes.
        </Text>
      </Animated.View>
      
      {/* Animated buttons */}
      <Animated.View style={[styles.buttonContainer, { opacity: buttonsOpacity }]}>
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleStartPress}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Comenzar</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleContinuePress}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Continuar configuración</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.linkButton}
          onPress={handleAlreadyHaveBusiness}
          activeOpacity={0.8}
        >
          <Text style={styles.linkButtonText}>Ya tengo un negocio registrado</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
  },
  logoContainer: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 150,
    height: 150,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0A2463',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#5E6A81',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#5E6A81',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default BusinessOnboardingWelcomeScreen; 
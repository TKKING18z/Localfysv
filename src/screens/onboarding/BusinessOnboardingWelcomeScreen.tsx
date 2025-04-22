import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Image, 
  Animated, 
  Dimensions,
  ActivityIndicator,
  BackHandler
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useBusinessOnboarding } from '../../context/BusinessOnboardingContext';
import { useAuth } from '../../context/AuthContext';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

type BusinessOnboardingWelcomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList, 
  'BusinessOnboardingWelcome'
>;

const { width } = Dimensions.get('window');

const BusinessOnboardingWelcomeScreen: React.FC = () => {
  const { recoverProgress, setOnboardingMode } = useBusinessOnboarding();
  const navigation = useNavigation<BusinessOnboardingWelcomeScreenNavigationProp>();
  const route = useRoute();
  const { user } = useAuth();
  const [hasExistingBusiness, setHasExistingBusiness] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Animation values
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  
  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('MainTabs', { screen: 'Profile' });
      return true;
    });
    
    return () => backHandler.remove();
  }, [navigation]);
  
  // Check if user already has businesses
  useEffect(() => {
    const checkExistingBusinesses = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      // Verificar si viene desde la pantalla de perfil como nuevo propietario
      const params = route.params as { isNewBusinessOwner?: boolean } | undefined;
      if (params?.isNewBusinessOwner) {
        // Si es un nuevo propietario, no redirigir
        console.log("Nuevo propietario detectado, mostrando pantalla de onboarding");
        setHasExistingBusiness(false);
        setIsLoading(false);
        return;
      }
      
      try {
        const snapshot = await firebase.firestore()
          .collection('businesses')
          .where('createdBy', '==', user.uid)
          .limit(1)
          .get();
        
        const hasBusinesses = !snapshot.empty;
        setHasExistingBusiness(hasBusinesses);
        
        // Si tiene negocios y no es redirección especial, enviar a MyBusinesses
        if (hasBusinesses && !params?.isNewBusinessOwner) {
          console.log("Usuario ya tiene negocios, redirigiendo a MyBusinesses");
          setTimeout(() => {
            navigation.replace('MyBusinesses');
          }, 500);
        }
      } catch (error) {
        console.error('Error checking user businesses:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkExistingBusinesses();
  }, [user, navigation, route.params]);
  
  // Run entrance animations
  useEffect(() => {
    if (!isLoading && hasExistingBusiness === false) {
      Animated.sequence([
        // First animate the logo
        Animated.parallel([
          Animated.timing(logoScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          })
        ]),
        // Then animate the text
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // Finally, animate the buttons
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isLoading, hasExistingBusiness]);
  
  // Handle button presses
  const handleStartPress = () => {
    navigation.navigate('BusinessOnboardingModeSelection');
  };
  
  const handleContinuePress = async () => {
    const recovered = await recoverProgress();
    if (recovered) {
      navigation.navigate('BusinessOnboardingSteps', { businessId: undefined, editMode: false });
    } else {
      // If no progress found, start new
      navigation.navigate('BusinessOnboardingModeSelection');
    }
  };
  
  const handleAlreadyHaveBusiness = () => {
    navigation.navigate('MyBusinesses');
  };
  
  // Show loading state while checking for existing businesses
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Verificando información...</Text>
      </SafeAreaView>
    );
  }
  
  // If user already has businesses, this screen will be automatically redirected
  
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
  <Text style={styles.title}>¡Hazlo visible, hazlo real, hazlo crecer!</Text>
  <Text style={styles.subtitle}>
    <Text style={styles.subtitleHighlight}>Cada emprendimiento salvadoreño</Text> tiene 
    una esencia única que merece ser descubierta. Conecta con clientes 
    de todo el país,
    <Text style={styles.subtitleHighlight}> sin invertir ni un centavo.</Text>
  </Text>
</Animated.View>
      
      {/* Animated buttons */}
      <Animated.View style={[styles.buttonContainer, { opacity: buttonsOpacity }]}>
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleStartPress}
          activeOpacity={0.7}
        >
          <Text style={styles.primaryButtonText}>Comenzar</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleContinuePress}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>Continuar configuración</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.linkButton}
          onPress={handleAlreadyHaveBusiness}
          activeOpacity={0.7}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
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
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#5E6A81',
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitleHighlight: {
    fontWeight: 'bold',
    color: '#007AFF',
    fontSize: 18,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 40,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    width: '70%',
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
    paddingHorizontal: 24,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
    width: '80%',
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
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default BusinessOnboardingWelcomeScreen; 
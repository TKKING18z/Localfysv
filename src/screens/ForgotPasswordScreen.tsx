import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  Animated,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { authService } from '../services/authService';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type ForgotPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ForgotPassword'>;

const { width } = Dimensions.get('window');

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const buttonAnim = useRef(new Animated.Value(1)).current;
  const successIconAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Email validation function
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  const animateSuccess = () => {
    Animated.sequence([
      Animated.timing(successIconAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(successIconAnim, {
        toValue: 1.2,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.spring(successIconAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleResetPassword = async () => {
    handleButtonPress();
    
    // Reset error state
    setError('');
    
    // Form validation
    if (email.trim() === '') {
      setError('Por favor ingresa tu correo electrónico');
      return;
    }
    
    if (!isValidEmail(email)) {
      setError('Por favor ingresa un correo electrónico válido');
      return;
    }
    
    try {
      setLoading(true);
      const result = await authService.forgotPassword(email);
      setLoading(false);
      
      if (result.success) {
        setIsSubmitted(true);
        animateSuccess();
        setTimeout(() => {
          Alert.alert(
            'Restablecimiento de Contraseña',
            'Si existe una cuenta con este correo, recibirás instrucciones para restablecer tu contraseña.',
            [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
          );
        }, 1500);
      } else {
        setError(result.error ?? 'Error al restablecer la contraseña');
      }
    } catch (err) {
      setLoading(false);
      setError('Ocurrió un error inesperado. Por favor intenta de nuevo más tarde.');
      console.error('Password reset error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidContainer}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity 
            style={styles.backButtonContainer}
            onPress={() => navigation.navigate('Login')}
          >
            <MaterialIcons name="arrow-back-ios" size={24} color="#007AFF" />
            <Text style={styles.backButtonText}>Regresar</Text>
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.logoContainer,
              { 
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            <View style={styles.iconContainer}>
              <MaterialIcons name="lock-open" size={50} color="#007AFF" />
            </View>
            <Image
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.contentContainer,
              { 
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim }
                ]
              }
            ]}
          >
            <Text style={styles.title}>Recuperar Contraseña</Text>

            <Text style={styles.subtitle}>
              Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña.
            </Text>
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            {!isSubmitted ? (
              <>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="email" size={24} color="#007AFF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Correo electrónico"
                    placeholderTextColor="#9EA5C9"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (error) setError('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
                
                <Animated.View style={{ transform: [{ scale: buttonAnim }], width: '100%' }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleResetPassword}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#007AFF', '#47A9FF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.button}
                    >
                      {loading ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={styles.buttonText}>Enviar Instrucciones</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </>
            ) : (
              <Animated.View 
                style={[
                  styles.successContainer,
                  { transform: [{ scale: successIconAnim }] }
                ]}
              >
                <MaterialIcons name="check-circle" size={100} color="#007AFF" />
                <Text style={styles.successText}>¡Correo enviado!</Text>
              </Animated.View>
            )}
          </Animated.View>

          <View style={styles.securityNote}>
            <MaterialIcons name="security" size={16} color="#007AFF" />
            <Text style={styles.securityNoteText}>
              Mantén tus credenciales seguras y nunca las compartas con terceros.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  keyboardAvoidContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 5,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 15,
  },
  logo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
    position: 'absolute',
    bottom: -10,
    right: -10,
    opacity: 0.7,
  },
  contentContainer: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 25,
    color: '#697386',
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E6E8F0',
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#FDFDFD',
    height: 56,
    width: '100%',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputIcon: {
    padding: 12,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: '#2D3748',
    paddingVertical: 12,
  },
  button: {
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 15,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 14,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    padding: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: 10,
  },
  securityNoteText: {
    fontSize: 12,
    color: '#697386',
    marginLeft: 8,
    flex: 1,
  }
});

export default ForgotPasswordScreen;
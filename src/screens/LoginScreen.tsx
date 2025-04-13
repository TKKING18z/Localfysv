import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    Animated,
    Dimensions,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import googleLogo from '../../assets/google_logo.png'; // Import the Google PNG logo
import { useGoogleAuth, googleAuthService } from '../services/googleAuthService';
import * as Google from 'expo-auth-session/providers/google';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const { width } = Dimensions.get('window');

const LoginScreen: React.FC = () => {
    const navigation = useNavigation<LoginScreenNavigationProp>();
    // Usar el hook de autenticación actualizado
    const { login, isGoogleLoading, loading: authLoading } = useAuth();
    
    // Usar el hook de autenticación de Google
    const { request, response, promptAsync } = useGoogleAuth();
    
    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [hidePassword, setHidePassword] = useState(true);
    const [rememberMe, setRememberMe] = useState(true); // Por defecto activado
    const [loading, setLoading] = useState(false);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const buttonAnim = useRef(new Animated.Value(1)).current;
    
    // Procesar la respuesta de Google cuando cambie
    useEffect(() => {
        if (response?.type) {
            handleGoogleAuthResponse();
        }
    }, [response]);
    
    // Cargar credenciales guardadas
    useEffect(() => {
        const loadSavedCredentials = async () => {
            try {
                const savedEmail = await AsyncStorage.getItem('saved_email');
                const savedPassword = await AsyncStorage.getItem('saved_password');
                
                if (savedEmail) {
                    setEmail(savedEmail);
                }
                
                if (savedPassword) {
                    setPassword(savedPassword);
                }
                
                console.log('Saved credentials loaded successfully');
            } catch (error) {
                console.error('Error loading saved credentials:', error);
            }
        };
        
        loadSavedCredentials();
    }, []);
    
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

    const navigateToRegister = () => {
        navigation.navigate('Register');
    };
    
    const navigateToForgotPassword = () => {
        navigation.navigate('ForgotPassword');
    };

    const handleLogin = async () => {
        handleButtonPress();
        
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }
        
        setLoading(true);
        console.log("Iniciando sesión para:", email);
        
        try {
            // Usar la función de login del contexto
            const success = await login(email, password);
            
            if (success) {
                console.log("Login exitoso");
                
                // Si "Recordarme" está activado, guardar credenciales
                if (rememberMe) {
                    try {
                        await AsyncStorage.setItem('saved_email', email);
                        await AsyncStorage.setItem('saved_password', password);
                        console.log('Credentials saved successfully');
                    } catch (saveError) {
                        console.error('Error saving credentials:', saveError);
                    }
                } else {
                    // Si no está activado, eliminar credenciales guardadas
                    try {
                        await AsyncStorage.removeItem('saved_email');
                        await AsyncStorage.removeItem('saved_password');
                        console.log('Credentials removed successfully');
                    } catch (removeError) {
                        console.error('Error removing credentials:', removeError);
                    }
                }
            }
        } catch (error: any) {
            console.log("Error durante el login:", error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };
    
    // Nueva función para manejar la respuesta de autenticación de Google
    const handleGoogleAuthResponse = async () => {
        try {
            setLoading(true);
            
            if (!response) {
                return;
            }
            
            // Convertir la respuesta a GoogleAuthResponse
            // Para Google.useIdTokenAuthRequest, la respuesta success incluye params con id_token
            const googleResponse = {
                type: response.type,
                params: {
                    id_token: response.type === 'success' ? response.authentication?.idToken || '' : ''
                }
            };
            
            const result = await googleAuthService.handleSignInWithGoogle(googleResponse);
            
            if (!result.success && result.error) {
                if (result.error !== "Inicio de sesión con Google cancelado") {
                    Alert.alert("Error", result.error);
                }
            }
        } catch (error) {
            console.error("Error procesando autenticación de Google:", error);
            Alert.alert("Error", "No se pudo iniciar sesión con Google");
        } finally {
            setLoading(false);
        }
    };
    
    // Nueva función para manejar el login con Google
    const handleGoogleLogin = async () => {
        try {
            console.log("Iniciando proceso de login con Google");
            if (!request) {
                Alert.alert("Error", "No se pudo iniciar el proceso de autenticación con Google");
                return;
            }
            
            await promptAsync();
        } catch (error) {
            console.error("Error al intentar login con Google:", error);
            Alert.alert("Error", "No se pudo iniciar sesión con Google");
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
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
                    <View style={styles.logoWrapper}>
                        <Image
                            source={require('../../assets/icon.png')}
                            style={styles.logo}
                        />
                    </View>
                    <Text style={styles.appName}>Localfy</Text>
                    <Text style={styles.tagline}>Descubre lo local, vive lo auténtico</Text>
                </Animated.View>
                
                <Animated.View 
                    style={[
                        styles.formContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <Text style={styles.title}>Iniciar Sesión</Text>
                    
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="email" size={24} color="#007AFF" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Correo electrónico"
                            placeholderTextColor="#9EA5C9"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>
                    
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="lock" size={24} color="#007AFF" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Contraseña"
                            placeholderTextColor="#9EA5C9"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={hidePassword}
                        />
                        <TouchableOpacity
                            onPress={() => setHidePassword(!hidePassword)}
                            style={styles.eyeIcon}
                        >
                            <MaterialIcons
                                name={hidePassword ? 'visibility-off' : 'visibility'}
                                size={24}
                                color="#007AFF"
                            />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.rememberContainer}>
                        <TouchableOpacity 
                            style={styles.rememberMeOption}
                            onPress={() => setRememberMe(!rememberMe)}
                        >
                            <MaterialIcons 
                                name={rememberMe ? "check-box" : "check-box-outline-blank"} 
                                size={24} 
                                color="#007AFF" 
                            />
                            <Text style={styles.rememberMeText}>Recordarme</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={styles.forgotPassword}
                            onPress={navigateToForgotPassword}
                        >
                            <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <Animated.View style={{ transform: [{ scale: buttonAnim }] }}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleLogin}
                            disabled={loading || authLoading}
                        >
                            <LinearGradient
                                colors={['#007AFF', '#47A9FF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.loginButton}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <Text style={styles.loginButtonText}>
                                        Iniciar Sesión
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                    
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>o</Text>
                        <View style={styles.dividerLine} />
                    </View>
                    
                    {/* Botón de Google actualizado */}
                    <TouchableOpacity 
                        style={styles.googleButton}
                        onPress={handleGoogleLogin}
                        disabled={isGoogleLoading}
                    >
                        {isGoogleLoading ? (
                            <ActivityIndicator color="#007AFF" size="small" />
                        ) : (
                            <>
                                <View style={styles.googleIconContainer}>
                                    <Image 
                                        source={googleLogo}
                                        style={{ width: 32, height: 32, resizeMode: 'contain' }} // Increased size
                                    />
                                </View>
                                <Text style={styles.socialButtonText}>Continuar con Google</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </Animated.View>
                
                <Animated.View
                    style={[
                        styles.footer,
                        { opacity: fadeAnim }
                    ]}
                >
                    <Text style={styles.footerText}>¿No tienes una cuenta?</Text>
                    <TouchableOpacity 
                        onPress={navigateToRegister}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.registerText}>Regístrate</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FF',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    logoWrapper: {
        width: 110,
        height: 110,
        borderRadius: 0,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    logo: {
        width: 80,
        height: 80,
        resizeMode: 'contain',
    },
    appName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#007AFF',
        marginTop: 15,
        letterSpacing: 1,
    },
    tagline: {
        fontSize: 14,
        color: '#333333',
        marginTop: 5,
        letterSpacing: 0.5,
    },
    formContainer: {
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
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#007AFF',
        marginBottom: 25,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E6E8F0',
        borderRadius: 12,
        marginBottom: 16,
        backgroundColor: '#FDFDFD',
        height: 56,
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
    eyeIcon: {
        padding: 12,
    },
    rememberContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 4,
    },
    rememberMeOption: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rememberMeText: {
        marginLeft: 8,
        color: '#666666',
        fontSize: 14,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
    },
    forgotPasswordText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
        borderRadius: 12,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonText: {
        color: 'white',
        fontSize: 17,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E6E8F0',
    },
    dividerText: {
        color: '#9EA5C9',
        paddingHorizontal: 10,
        fontSize: 14,
    },
    // Estilo actualizado para el botón de Google con el logo oficial
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E6E8F0',
        borderRadius: 12,
        height: 56,
        marginVertical: 5,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    googleIconContainer: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    socialButtonText: {
        color: '#333333',
        fontSize: 15,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
        paddingBottom: 20,
    },
    footerText: {
        color: '#697386',
        fontSize: 16,
    },
    registerText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 5,
        textDecorationLine: 'underline',
    },
});

export default LoginScreen;
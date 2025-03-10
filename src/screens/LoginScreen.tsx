// src/screens/LoginScreen.tsx
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { RootStackParamList } from '../types';
import { LinearGradient } from 'expo-linear-gradient';

// Firebase configuration object
const firebaseConfig = {
    apiKey: "AIzaSyC2S36sPSd2XEJmxxkqJ-lQUJc7ySL5Uvw",
    authDomain: "testlocalfysv25.firebaseapp.com",
    projectId: "testlocalfysv25",
    storageBucket: "testlocalfysv25.firebasestorage.app",
    messagingSenderId: "281205862532",
    appId: "1:281205862532:web:aa25ca39606dda5db6d2d1",
    measurementId: "G-Z7V3LK64ZL"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const { width } = Dimensions.get('window');

const LoginScreen: React.FC = () => {
    const navigation = useNavigation<LoginScreenNavigationProp>();
    
    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [hidePassword, setHidePassword] = useState(true);
    const [loading, setLoading] = useState(false);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const buttonAnim = useRef(new Animated.Value(1)).current;
    
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

    const handleLogin = async () => {
        handleButtonPress();
        
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }
        
        console.log("Iniciando sesión para:", email);
        setLoading(true);

        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            console.log("Login exitoso:", userCredential.user);
            navigation.navigate('Home');
        } catch (error: any) {
            console.log("Error durante el login:", error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
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
                            source={require('../../assets/Icon.png')}
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
                    
                    <TouchableOpacity
                        style={styles.forgotPassword}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    >
                        <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>
                    
                    <Animated.View style={{ transform: [{ scale: buttonAnim }] }}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#007AFF', '#47A9FF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.loginButton}
                            >
                                <Text style={styles.loginButtonText}>
                                    {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                    
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>o</Text>
                        <View style={styles.dividerLine} />
                    </View>
                    
                    <TouchableOpacity style={styles.socialButton}>
                        <MaterialIcons name="email" size={20} color="#007AFF" />
                        <Text style={styles.socialButtonText}>Continuar con Google</Text>
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
                        onPress={() => navigation.navigate('Register')}
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
        borderRadius: 55,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
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
        color: '#66A5FF',
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
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 24,
        marginTop: 4,
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
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E6E8F0',
        borderRadius: 12,
        height: 50,
        marginVertical: 5,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    socialButtonText: {
        marginLeft: 10,
        color: '#007AFF',
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
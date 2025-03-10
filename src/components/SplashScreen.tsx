// src/components/SplashScreen.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type SplashScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  
  // Animación de fade in
  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Puedes navegar directamente al onboarding o login
      // Por ahora, esto se manejará desde App.tsx
    });
  }, [fadeAnim]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../assets/Icon-01.jpg')}
        style={[styles.logo, { opacity: fadeAnim }]}
      />
      <Animated.Text style={[styles.appName, { opacity: fadeAnim }]}>
        Localfy
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A55A2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default SplashScreen;
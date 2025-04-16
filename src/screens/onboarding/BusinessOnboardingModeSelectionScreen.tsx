import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useBusinessOnboarding } from '../../context/BusinessOnboardingContext';

type BusinessOnboardingModeSelectionScreenNavigationProp = StackNavigationProp<
  RootStackParamList, 
  'BusinessOnboardingModeSelection'
>;

const BusinessOnboardingModeSelectionScreen: React.FC = () => {
  const navigation = useNavigation<BusinessOnboardingModeSelectionScreenNavigationProp>();
  const { setOnboardingMode } = useBusinessOnboarding();
  
  const handleSelectExpressMode = () => {
    setOnboardingMode('express');
    navigation.navigate('BusinessOnboardingSteps');
  };
  
  const handleSelectDetailedMode = () => {
    setOnboardingMode('detailed');
    navigation.navigate('BusinessOnboardingSteps');
  };
  
  const handleBack = () => {
    navigation.goBack();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBack}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Elige un modo</Text>
        <View style={styles.placeholder} />
      </View>
      
      <Text style={styles.title}>Elige cómo configurar tu negocio</Text>
      
      <TouchableOpacity 
        style={[styles.modeCard, styles.expressCard]}
        onPress={handleSelectExpressMode}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <MaterialIcons name="flash-on" size={36} color="#007AFF" />
        </View>
        <View style={styles.modeInfo}>
          <Text style={styles.modeTitle}>Configuración Express</Text>
          <Text style={styles.modeTime}>5 minutos</Text>
          <Text style={styles.modeDescription}>
            Solo lo esencial para empezar rápidamente con tu negocio en Localfy. Podrás completar el resto después.
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.modeCard, styles.detailedCard]}
        onPress={handleSelectDetailedMode}
        activeOpacity={0.8}
      >
        <View style={[styles.iconContainer, styles.detailedIconContainer]}>
          <MaterialIcons name="stars" size={36} color="#34C759" />
        </View>
        <View style={styles.modeInfo}>
          <Text style={styles.modeTitle}>Configuración Completa</Text>
          <Text style={styles.modeTime}>10-15 minutos</Text>
          <Text style={styles.modeDescription}>
            Todas las opciones para maximizar tu presencia desde el inicio. Configura promociones, reservaciones y más.
          </Text>
        </View>
      </TouchableOpacity>
      
      <Text style={styles.noteText}>
        Puedes cambiar de modo en cualquier momento durante la configuración
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A2463',
  },
  placeholder: {
    width: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0A2463',
    marginBottom: 30,
    textAlign: 'center',
  },
  modeCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  expressCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  detailedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.1)',
    marginRight: 16,
  },
  detailedIconContainer: {
    backgroundColor: 'rgba(52,199,89,0.1)',
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  modeTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 14,
    color: '#2C3E50',
    lineHeight: 20,
  },
  noteText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default BusinessOnboardingModeSelectionScreen; 
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
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
  const { 
    setOnboardingMode, 
    discardOnboarding 
  } = useBusinessOnboarding();
  
  // Limpiar datos de onboarding al cargar esta pantalla
  useEffect(() => {
    const resetOnboarding = async () => {
      try {
        // Descartar cualquier proceso de onboarding previo que esté en progreso
        await discardOnboarding();
        console.log('Datos de onboarding reiniciados correctamente');
      } catch (error) {
        console.error('Error al reiniciar datos de onboarding:', error);
      }
    };
    
    // Ejecutar una sola vez al montar el componente
    resetOnboarding();
  }, []); // Array de dependencias vacío para ejecutar solo al montar
  
  const handleContinue = async () => {
    // Establecer el modo de onboarding
    setOnboardingMode('detailed');
    
    // Navegar a la pantalla de pasos de onboarding
    navigation.navigate('BusinessOnboardingSteps');
  };
  
  const handleBack = () => {
    navigation.goBack();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configuración de Negocio</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Configura tu negocio en Localfy</Text>
          
          <Text style={styles.subtitle}>
            Te guiaremos a través del proceso para crear tu perfil de negocio
          </Text>
          
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="stars" size={40} color="#34C759" />
            </View>
            
            <View style={styles.infoContent}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>Configuración Completa</Text>
                <View style={styles.timeTag}>
                  <MaterialIcons name="access-time" size={14} color="#34C759" />
                  <Text style={styles.timeText}>3 a 5 minutos</Text>
                </View>
              </View>
              
              <Text style={styles.infoDescription}>
                Configura tu perfil de negocio incluyendo:
              </Text>
              
              <View style={styles.benefitsList}>
                {[
                  'Información básica y ubicación',
                  'Horarios de operación',
                  'Catálogo de productos/servicios',
                  'Fotos y galería',
                  'Métodos de pago y contacto'
                ].map((item, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <MaterialIcons name="check-circle" size={18} color="#34C759" />
                    <Text style={styles.benefitText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          
          <View style={styles.noteBox}>
            <MaterialIcons name="info-outline" size={20} color="#007AFF" />
            <Text style={styles.noteText}>
              Puedes guardar tu progreso y completar la configuración más tarde. Todos los cambios se guardarán automáticamente.
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Comenzar Configuración</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
  contentContainer: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0A2463',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#4A5568',
    marginBottom: 30,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(52,199,89,0.1)',
    marginBottom: 20,
    alignSelf: 'center',
  },
  infoContent: {
    width: '100%',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginRight: 8,
    flex: 1,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,199,89,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 90,
  },
  timeText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
    marginLeft: 4,
  },
  infoDescription: {
    fontSize: 16,
    color: '#4A5568',
    marginBottom: 16,
    lineHeight: 22,
  },
  benefitsList: {
    marginTop: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 15,
    color: '#2D3748',
    marginLeft: 10,
    flex: 1,
  },
  noteBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,122,255,0.05)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  noteText: {
    fontSize: 14,
    color: '#4A5568',
    flex: 1,
    marginLeft: 12,
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default BusinessOnboardingModeSelectionScreen; 
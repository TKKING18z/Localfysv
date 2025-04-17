import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBusinessOnboarding } from '../../../context/BusinessOnboardingContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { useStore } from '../../../context/StoreContext';

// Default business hours
const DEFAULT_BUSINESS_HOURS = {
  monday: { open: '08:00', close: '17:00', closed: false },
  tuesday: { open: '08:00', close: '17:00', closed: false },
  wednesday: { open: '08:00', close: '17:00', closed: false },
  thursday: { open: '08:00', close: '17:00', closed: false },
  friday: { open: '08:00', close: '17:00', closed: false },
  saturday: { open: '08:00', close: '12:00', closed: false },
  sunday: { open: '00:00', close: '00:00', closed: true }
};

// Default payment methods
const DEFAULT_PAYMENT_METHODS = ['Efectivo', 'Tarjeta de crédito', 'Tarjeta de débito'];

// Identificadores únicos para callbacks
const BUSINESS_HOURS_CALLBACK = 'business-hours-callback-' + Date.now();
const PAYMENT_METHODS_CALLBACK = 'payment-methods-callback-' + Date.now();

const BusinessOperationsStep: React.FC = () => {
  const { formState, setField, markStepComplete } = useBusinessOnboarding();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const store = useStore();
  const initialized = useRef(false);
  const callbacksRegistered = useRef(false);
  
  // Local state for services
  const [services, setServices] = useState({
    delivery: false,
    pickup: false,
    onlineOrders: false,
    reservations: false,
    wifi: false,
    parking: false
  });
  
  // Referencias inmutables para las funciones de callback
  const hoursCallbackRef = useRef((hours: any) => {
    if (hours && typeof hours === 'object') {
      setField('businessHours', hours);
    }
  });
  
  const paymentCallbackRef = useRef((methods: any) => {
    if (Array.isArray(methods)) {
      setField('paymentMethods', methods);
    }
  });
  
  // Inicialización de datos y registro de callbacks - solo UNA VEZ
  useEffect(() => {
    // Evitar inicialización múltiple
    if (initialized.current) return;
    initialized.current = true;
    
    // Inicializar servicios
    if (formState.services) {
      setServices({
        delivery: !!formState.services.delivery,
        pickup: !!formState.services.pickup,
        onlineOrders: !!formState.services.onlineOrders,
        reservations: !!formState.services.reservations,
        wifi: !!formState.services.wifi,
        parking: !!formState.services.parking
      });
    } else {
      // Ensure services are initialized in form state
      setField('services', services);
    }
    
    // Inicializar horarios de negocio
    if (!formState.businessHours) {
      setField('businessHours', DEFAULT_BUSINESS_HOURS);
    }
    
    // Inicializar métodos de pago
    if (!formState.paymentMethods || formState.paymentMethods.length === 0) {
      setField('paymentMethods', DEFAULT_PAYMENT_METHODS);
    }
    
    // Registrar callbacks solo si no están ya registrados
    if (!callbacksRegistered.current) {
      store.setCallback(BUSINESS_HOURS_CALLBACK, hoursCallbackRef.current);
      store.setCallback(PAYMENT_METHODS_CALLBACK, paymentCallbackRef.current);
      callbacksRegistered.current = true;
      
      // Limpieza al desmontar
      return () => {
        if (callbacksRegistered.current) {
          store.removeCallback(BUSINESS_HOURS_CALLBACK);
          store.removeCallback(PAYMENT_METHODS_CALLBACK);
          callbacksRegistered.current = false;
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Sin dependencias para que solo se ejecute una vez
  
  // Check and mark step as complete
  useEffect(() => {
    const hasAnyService = Object.values(services).some(value => value);
    const hasBusinessHours = !!formState.businessHours;
    const hasPaymentMethods = !!(formState.paymentMethods && formState.paymentMethods.length > 0);
    
    if (hasAnyService || (hasBusinessHours && hasPaymentMethods)) {
      markStepComplete('businessOperations');
    }
  }, [services, formState.businessHours, formState.paymentMethods, markStepComplete]);
  
  // Asegurar que las horas de negocio tengan formato correcto
  const getFormattedBusinessHours = useCallback(() => {
    const businessHours = formState.businessHours || {};
    
    // Crea un nuevo objeto con el formato correcto
    const formattedHours: any = {};
    
    try {
      Object.keys(businessHours).forEach(day => {
        const dayData = businessHours[day];
        
        // Si el valor es nulo o no es un objeto, usar valores predeterminados
        if (!dayData || typeof dayData !== 'object') {
          formattedHours[day] = { 
            open: '08:00', 
            close: '17:00', 
            closed: false 
          };
          return;
        }
        
        // Asegurarse de que tenga propiedades necesarias
        formattedHours[day] = {
          open: dayData.open || '08:00',
          close: dayData.close || '17:00',
          closed: dayData.closed !== undefined ? dayData.closed : 
                 (dayData.open === '00:00' || false)
        };
      });
      
      // Si no hay datos, usar los valores predeterminados
      if (Object.keys(formattedHours).length === 0) {
        return DEFAULT_BUSINESS_HOURS;
      }
      
      return formattedHours;
    } catch (error) {
      console.error('Error formatting business hours:', error);
      return DEFAULT_BUSINESS_HOURS;
    }
  }, [formState.businessHours]);
  
  // Handle toggling services
  const toggleService = useCallback((service: keyof typeof services) => {
    setServices(prevServices => {
      return { ...prevServices, [service]: !prevServices[service] };
    });
  }, []);
  
  // Use effect to update form state when services change
  useEffect(() => {
    // Only update after initialization
    if (initialized.current) {
      // Update form state with the services
      setField('services', services);
      
      // Handle special case for reservations
      if ('reservations' in services) {
        setField('acceptsReservations', services.reservations);
      }
    }
  }, [services, setField]);
  
  // Navigate to business hours screen
  const navigateToBusinessHours = useCallback(() => {
    const formattedHours = getFormattedBusinessHours();
    
    navigation.navigate('BusinessHours', {
      initialHours: formattedHours,
      callbackId: BUSINESS_HOURS_CALLBACK
    });
  }, [navigation, getFormattedBusinessHours]);
  
  // Navigate to payment methods screen
  const navigateToPaymentMethods = useCallback(() => {
    // Asegurarse de que los métodos de pago son un array
    const methods = Array.isArray(formState.paymentMethods) 
      ? formState.paymentMethods 
      : DEFAULT_PAYMENT_METHODS;
    
    navigation.navigate('PaymentMethods', {
      initialMethods: methods,
      callbackId: PAYMENT_METHODS_CALLBACK
    });
  }, [navigation, formState.paymentMethods]);
  
  // Get formatted display of business hours
  const getBusinessHoursDisplay = useCallback(() => {
    if (!formState.businessHours) return 'No configurado';
    
    const daysMap: Record<string, string> = {
      monday: 'Lun',
      tuesday: 'Mar',
      wednesday: 'Mié',
      thursday: 'Jue',
      friday: 'Vie',
      saturday: 'Sáb',
      sunday: 'Dom'
    };
    
    try {
      // Verificación segura para evitar errores
      const businessHours = formState.businessHours || {};
      if (typeof businessHours !== 'object') {
        return 'Horario no válido';
      }
      
      const openDays = Object.keys(businessHours)
        .filter(day => {
          const value = businessHours[day];
          
          // Verificar si el valor es un objeto válido antes de acceder
          if (!value || typeof value !== 'object') return false;
          
          // Verificar formato con closed
          if (Object.prototype.hasOwnProperty.call(value, 'closed')) {
            return !value.closed && value.open && value.open !== '00:00';
          }
          
          // Verificar si está abierto basado en el tiempo de apertura
          return value.open && value.open !== '00:00';
        })
        .map(day => daysMap[day] || day);
      
      if (openDays.length === 0) return 'Cerrado';
      if (openDays.length === 7) return 'Abierto todos los días';
      
      return `Abierto: ${openDays.join(', ')}`;
    } catch (error) {
      console.error('Error displaying business hours:', error);
      return 'Error al mostrar horario';
    }
  }, [formState.businessHours]);
  
  // Get formatted display of payment methods
  const getPaymentMethodsDisplay = useCallback(() => {
    try {
      if (!formState.paymentMethods || !Array.isArray(formState.paymentMethods) || formState.paymentMethods.length === 0) {
        return 'No configurado';
      }
      
      if (formState.paymentMethods.length <= 2) {
        return formState.paymentMethods.join(', ');
      }
      
      return `${formState.paymentMethods.slice(0, 2).join(', ')} +${formState.paymentMethods.length - 2}`;
    } catch (error) {
      console.error('Error displaying payment methods:', error);
      return 'Error al mostrar métodos de pago';
    }
  }, [formState.paymentMethods]);
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>¿Cómo funciona tu negocio?</Text>
          <Text style={styles.sectionSubtitle}>
            Configura los detalles operativos para que tus clientes sepan cómo interactuar con tu negocio.
          </Text>
          
          {/* Business Hours */}
          <TouchableOpacity 
            style={styles.settingCard}
            onPress={navigateToBusinessHours}
          >
            <View style={styles.settingIconContainer}>
              <MaterialIcons name="access-time" size={24} color="#007AFF" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Horarios de atención</Text>
              <Text style={styles.settingValue}>{getBusinessHoursDisplay()}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8E8E93" />
          </TouchableOpacity>
          
          {/* Payment Methods */}
          <TouchableOpacity 
            style={styles.settingCard}
            onPress={navigateToPaymentMethods}
          >
            <View style={styles.settingIconContainer}>
              <MaterialIcons name="payment" size={24} color="#007AFF" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Métodos de pago</Text>
              <Text style={styles.settingValue}>{getPaymentMethodsDisplay()}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8E8E93" />
          </TouchableOpacity>
          
          {/* Services */}
          <View style={styles.servicesSection}>
            <Text style={styles.sectionLabel}>Servicios que ofreces</Text>
            <Text style={styles.servicesHint}>
              Selecciona los servicios disponibles en tu negocio
            </Text>
            
            {/* Delivery */}
            <View style={styles.serviceItem}>
              <View style={styles.serviceInfo}>
                <MaterialIcons name="delivery-dining" size={24} color="#007AFF" />
                <View style={styles.serviceTextContainer}>
                  <Text style={styles.serviceTitle}>Entrega a domicilio</Text>
                  <Text style={styles.serviceDescription}>
                    Ofreces servicio de delivery a tus clientes
                  </Text>
                </View>
              </View>
              <Switch
                value={services.delivery}
                onValueChange={() => toggleService('delivery')}
                trackColor={{ false: '#E1E8F0', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            {/* Pickup */}
            <View style={styles.serviceItem}>
              <View style={styles.serviceInfo}>
                <MaterialIcons name="shopping-bag" size={24} color="#007AFF" />
                <View style={styles.serviceTextContainer}>
                  <Text style={styles.serviceTitle}>Retiro en tienda</Text>
                  <Text style={styles.serviceDescription}>
                    Los clientes pueden recoger sus pedidos
                  </Text>
                </View>
              </View>
              <Switch
                value={services.pickup}
                onValueChange={() => toggleService('pickup')}
                trackColor={{ false: '#E1E8F0', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            {/* Online Orders */}
            <View style={styles.serviceItem}>
              <View style={styles.serviceInfo}>
                <MaterialIcons name="laptop" size={24} color="#007AFF" />
                <View style={styles.serviceTextContainer}>
                  <Text style={styles.serviceTitle}>Pedidos en línea</Text>
                  <Text style={styles.serviceDescription}>
                    Aceptas pedidos a través de la app
                  </Text>
                </View>
              </View>
              <Switch
                value={services.onlineOrders}
                onValueChange={() => toggleService('onlineOrders')}
                trackColor={{ false: '#E1E8F0', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            {/* Reservations */}
            <View style={styles.serviceItem}>
              <View style={styles.serviceInfo}>
                <MaterialIcons name="event-available" size={24} color="#007AFF" />
                <View style={styles.serviceTextContainer}>
                  <Text style={styles.serviceTitle}>Reservaciones</Text>
                  <Text style={styles.serviceDescription}>
                    Aceptas reservas de clientes
                  </Text>
                </View>
              </View>
              <Switch
                value={services.reservations}
                onValueChange={() => toggleService('reservations')}
                trackColor={{ false: '#E1E8F0', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            {/* WiFi */}
            <View style={styles.serviceItem}>
              <View style={styles.serviceInfo}>
                <MaterialIcons name="wifi" size={24} color="#007AFF" />
                <View style={styles.serviceTextContainer}>
                  <Text style={styles.serviceTitle}>Wi-Fi gratuito</Text>
                  <Text style={styles.serviceDescription}>
                    Ofreces Wi-Fi a tus clientes
                  </Text>
                </View>
              </View>
              <Switch
                value={services.wifi}
                onValueChange={() => toggleService('wifi')}
                trackColor={{ false: '#E1E8F0', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            {/* Parking */}
            <View style={styles.serviceItem}>
              <View style={styles.serviceInfo}>
                <MaterialIcons name="local-parking" size={24} color="#007AFF" />
                <View style={styles.serviceTextContainer}>
                  <Text style={styles.serviceTitle}>Estacionamiento</Text>
                  <Text style={styles.serviceDescription}>
                    Dispones de estacionamiento para clientes
                  </Text>
                </View>
              </View>
              <Switch
                value={services.parking}
                onValueChange={() => toggleService('parking')}
                trackColor={{ false: '#E1E8F0', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
          
          {/* Tip Section */}
          <View style={styles.tipContainer}>
            <MaterialIcons name="lightbulb" size={24} color="#007AFF" />
            <Text style={styles.tipText}>
              Pro Tip: Los negocios que ofrecen más servicios reciben 50% más visitas y mejores calificaciones.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 24,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A2463',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#5E6A81',
    marginBottom: 24,
    lineHeight: 22,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,122,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 14,
    color: '#8E8E93',
  },
  servicesSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6,
  },
  servicesHint: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 2,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  tipContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 12,
    lineHeight: 20,
  },
});

export default BusinessOperationsStep; 
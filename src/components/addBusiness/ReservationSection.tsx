import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessFormState } from '../../hooks/business/useAddBusiness';
import { useStore } from '../../context/StoreContext';

interface ReservationSectionProps {
  formState: BusinessFormState;
  setAcceptsReservations: (value: boolean) => void;
  setAllowsPromotions: (value: boolean) => void;
  navigateToReservations: () => void;
  navigateToPromotions: () => void;
  hasPromotions: () => boolean;
  forceRender: number;
}

const ReservationSection: React.FC<ReservationSectionProps> = ({
  formState,
  setAcceptsReservations,
  setAllowsPromotions,
  navigateToReservations,
  navigateToPromotions,
  hasPromotions,
  forceRender
}) => {
  const { getTempData } = useStore();
  
  // Use useMemo to avoid unnecessary recalculations
  const hasPromotionsValue = useMemo(() => {
    return hasPromotions();
  }, [hasPromotions, forceRender]);
  
  const hasReservationSettings = useMemo(() => {
    return !!getTempData('tempReservationSettings');
  }, [getTempData]);

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Opciones de Reservación y Promociones</Text>
      
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Permitir reservaciones</Text>
        <Switch 
          value={formState.acceptsReservations}
          onValueChange={(value) => setAcceptsReservations(value)}
          trackColor={{ false: '#E5E5EA', true: '#4CD964' }}
          thumbColor={Platform.OS === 'android' ? '#f4f3f4' : ''}
        />
      </View>
      
      {!formState.acceptsReservations ? (
        <Text style={styles.warningText}>
          Las reservaciones estarán deshabilitadas. Los clientes no podrán hacer reservas a través de la app.
        </Text>
      ) : (
        <TouchableOpacity 
          style={styles.advancedButton}
          onPress={navigateToReservations}
        >
          <View style={styles.advancedIconContainer}>
            <MaterialIcons name="event-available" size={24} color="#007aff" />
          </View>
          <Text style={styles.advancedButtonText}>Configurar Reservaciones</Text>
          <MaterialIcons 
            name="check-circle" 
            size={24} 
            color={hasReservationSettings ? "#34C759" : "#E5E5EA"} 
          />
        </TouchableOpacity>
      )}

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Permitir promociones</Text>
        <Switch 
          value={formState.allowsPromotions}
          onValueChange={(value) => setAllowsPromotions(value)}
          trackColor={{ false: '#E5E5EA', true: '#4CD964' }}
          thumbColor={Platform.OS === 'android' ? '#f4f3f4' : ''}
        />
      </View>
      
      {!formState.allowsPromotions ? (
        <Text style={styles.warningText}>
          Las promociones estarán deshabilitadas. Los clientes no podrán ver promociones para este negocio.
        </Text>
      ) : (
        <TouchableOpacity 
          style={styles.advancedButton}
          onPress={navigateToPromotions}
        >
          <View style={styles.advancedIconContainer}>
            <MaterialIcons name="local-offer" size={24} color="#007aff" />
          </View>
          <Text style={styles.advancedButtonText}>Gestionar Promociones</Text>
          <MaterialIcons 
            name="check-circle" 
            size={24} 
            color={hasPromotionsValue ? "#34C759" : "#E5E5EA"} 
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007aff',
    marginBottom: 20,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#F6F8FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  warningText: {
    marginBottom: 14,
    color: '#FF9500',
    fontStyle: 'italic',
    backgroundColor: 'rgba(255,149,0,0.08)',
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    shadowColor: '#8395A7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  advancedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  advancedButtonText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 14,
    flex: 1,
    fontWeight: '500',
  },
});

export default ReservationSection; 
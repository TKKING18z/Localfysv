import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface BusinessReservationsTabProps {
  isBusinessOwner: boolean;
  businessName: string;
  navigateToReservations: () => void;
}

const BusinessReservationsTab: React.FC<BusinessReservationsTabProps> = ({
  isBusinessOwner,
  businessName,
  navigateToReservations,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardSectionTitle}>Reservaciones</Text>
        {isBusinessOwner && (
          <TouchableOpacity 
            style={styles.managementButton}
            onPress={navigateToReservations}
          >
            <MaterialIcons name="edit" size={20} color="#007AFF" />
            <Text style={styles.managementButtonText}>Gestionar</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.reservationInfoContainer}>
        <MaterialIcons name="event-available" size={48} color="#007AFF" style={styles.reservationIcon} />
        <Text style={styles.reservationTitle}>
          {isBusinessOwner 
            ? "Gestiona tus reservaciones"
            : "Reserva en " + businessName}
        </Text>
        <Text style={styles.reservationDescription}>
          {isBusinessOwner 
            ? "Administra todas las reservaciones de tu negocio, confirma o rechaza solicitudes y configura tu disponibilidad."
            : "Realiza una reservación en este negocio de manera fácil y rápida. Selecciona la fecha, hora y número de personas."}
        </Text>
        
        <TouchableOpacity 
          style={styles.reservationButton}
          onPress={navigateToReservations}
        >
          <LinearGradient
            colors={isBusinessOwner ? ['#FF9500', '#FF2D55'] : ['#007AFF', '#00C2FF']}
            style={styles.reservationButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <MaterialIcons 
              name={isBusinessOwner ? "event-note" : "event-available"} 
              size={22} 
              color="white" 
            />
            <Text style={styles.reservationButtonText}>
              {isBusinessOwner ? "Gestionar Reservaciones" : "Hacer Reservación"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff',
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007aff',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  managementButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  reservationInfoContainer: {
    alignItems: 'center',
    padding: 16,
  },
  reservationIcon: {
    marginBottom: 16,
  },
  reservationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  reservationDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  reservationButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  reservationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  reservationButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default BusinessReservationsTab; 
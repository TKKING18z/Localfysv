import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Reservation } from '../../types/businessTypes';
import firebase from 'firebase/compat/app';

// Actualiza la interfaz de ReservationCardProps para incluir los métodos
interface ReservationCardProps {
  reservation: Reservation;
  onPress?: (reservation: Reservation) => void;
  onCancelReservation?: (reservationId: string) => void; // Propiedad para cancelar reserva
  isBusinessView?: boolean;
}

const STATUS_COLORS = {
  pending: '#FF9500',     // Naranja
  confirmed: '#34C759',   // Verde
  canceled: '#FF3B30',    // Rojo
  completed: '#8E8E93'    // Gris
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  canceled: 'Cancelada',
  completed: 'Completada'
};

const ReservationCard: React.FC<ReservationCardProps> = ({ 
  reservation, 
  onPress, 
  onCancelReservation,
  isBusinessView = false
}) => {
  // Formatear fecha de manera segura
  const formatDate = (timestamp: firebase.firestore.Timestamp | undefined) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
      return 'Fecha no disponible';
    }
    
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return 'Fecha inválida';
    }
  };
  
  // Verificar si la reserva es en el futuro
  const isFutureReservation = () => {
    if (!reservation.date || typeof reservation.date.toDate !== 'function') {
      return false;
    }
    
    try {
      const reservationDate = reservation.date.toDate();
      reservationDate.setHours(23, 59, 59);
      
      return reservationDate > new Date();
    } catch (error) {
      console.error('Error al verificar fecha futura:', error);
      return false;
    }
  };
  
  // Verificar si la reserva se puede cancelar
  const canCancel = () => {
    return (
      (reservation.status === 'pending' || 
      reservation.status === 'confirmed')
    ) && isFutureReservation();
  };
  
  // Método para cancelar reserva
  const handleCancel = () => {
    if (onCancelReservation) {
      onCancelReservation(reservation.id);
    }
  };

  // Obtener color seguro basado en el estado
  const getStatusColor = () => {
    if (STATUS_COLORS[reservation.status as keyof typeof STATUS_COLORS]) {
      return STATUS_COLORS[reservation.status as keyof typeof STATUS_COLORS];
    }
    return '#8E8E93'; // Color por defecto
  };

  // Obtener etiqueta segura basada en el estado
  const getStatusLabel = () => {
    if (STATUS_LABELS[reservation.status as keyof typeof STATUS_LABELS]) {
      return STATUS_LABELS[reservation.status as keyof typeof STATUS_LABELS];
    }
    return 'Estado desconocido'; // Etiqueta por defecto
  };
  
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(reservation)}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          {isBusinessView ? `Reserva de ${reservation.userName || 'Usuario'}` : (reservation.businessName || 'Negocio')}
        </Text>
        <View style={[
          styles.statusBadge, 
          { backgroundColor: getStatusColor() }
        ]}>
          <Text style={styles.statusText}>{getStatusLabel()}</Text>
        </View>
      </View>
      
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <MaterialIcons name="event" size={16} color="#666666" />
          <Text style={styles.detailText}>{formatDate(reservation.date)}</Text>
        </View>
        
        <View style={styles.detailItem}>
          <MaterialIcons name="access-time" size={16} color="#666666" />
          <Text style={styles.detailText}>{reservation.time || 'Hora no disponible'}</Text>
        </View>
        
        <View style={styles.detailItem}>
          <MaterialIcons name="person" size={16} color="#666666" />
          <Text style={styles.detailText}>{reservation.partySize || '?'} personas</Text>
        </View>
      </View>
      
      {reservation.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Notas:</Text>
          <Text style={styles.notesText}>{reservation.notes}</Text>
        </View>
      )}
      
      {isBusinessView && reservation.contactInfo && (
        <View style={styles.contactContainer}>
          {reservation.contactInfo.phone && (
            <View style={styles.contactItem}>
              <MaterialIcons name="phone" size={16} color="#666666" />
              <Text style={styles.contactText}>{reservation.contactInfo.phone}</Text>
            </View>
          )}
          
          {reservation.contactInfo.email && (
            <View style={styles.contactItem}>
              <MaterialIcons name="email" size={16} color="#666666" />
              <Text style={styles.contactText}>{reservation.contactInfo.email}</Text>
            </View>
          )}
        </View>
      )}
      
      {canCancel() && onCancelReservation && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
        >
          <MaterialIcons name="cancel" size={16} color="#FF3B30" />
          <Text style={styles.cancelButtonText}>Cancelar Reserva</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 4,
  },
  notesContainer: {
    backgroundColor: '#F9F9F9',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 14,
    color: '#666666',
  },
  contactContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 4,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFEBE9',
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: 'bold',
    marginLeft: 4,
  },
});

export default ReservationCard;
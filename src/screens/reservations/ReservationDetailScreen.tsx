import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  Alert 
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Reservation } from '../../../models/reservationTypes';
import notificationService from '../../../services/NotificationService';

// Define screen props
type ReservationDetailScreenRouteProp = RouteProp<RootStackParamList, 'ReservationDetail'>;
type ReservationDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ReservationDetail'>;

interface ReservationDetailScreenProps {
  route: ReservationDetailScreenRouteProp;
  navigation: ReservationDetailScreenNavigationProp;
}

const ReservationDetailScreen: React.FC<ReservationDetailScreenProps> = ({ route, navigation }) => {
  const { reservationId } = route.params;
  const { user } = useAuth();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reservationId) {
      setError('ID de reserva no proporcionado');
      setLoading(false);
      return;
    }

    const fetchReservation = async () => {
      try {
        setLoading(true);
        const db = firebase.firestore();
        const reservationDoc = await db.collection('reservations').doc(reservationId).get();

        if (!reservationDoc.exists) {
          setError('Reserva no encontrada');
          setLoading(false);
          return;
        }

        const reservationData = {
          id: reservationDoc.id,
          ...reservationDoc.data()
        } as Reservation;

        // Verify user has permission to view this reservation
        if (reservationData.userId !== user?.uid) {
          const userDoc = await db.collection('users').doc(user?.uid || '').get();
          const userData = userDoc.data();
          
          // Check if user is business owner or admin
          if (!userData?.ownedBusinesses?.includes(reservationData.businessId)) {
            setError('No tienes permiso para ver esta reserva');
            setLoading(false);
            return;
          }
        }

        setReservation(reservationData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching reservation:', err);
        setError('Error al cargar los detalles de la reserva');
        setLoading(false);
      }
    };

    fetchReservation();
  }, [reservationId, user?.uid]);

  // Format date for display
  const formatDate = (timestamp: firebase.firestore.Timestamp | undefined) => {
    if (!timestamp || !timestamp.toDate) {
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
      console.error('Error formatting date:', error);
      return 'Fecha inválida';
    }
  };

  // Handle cancel reservation
  const handleCancelReservation = async () => {
    if (!reservation) return;

    Alert.alert(
      'Cancelar Reserva',
      '¿Está seguro que desea cancelar esta reserva?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              const db = firebase.firestore();
              await db.collection('reservations').doc(reservationId).update({
                status: 'canceled',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });

              // Show notification
              notificationService.showReservationStatusNotification(
                reservationId,
                reservation.businessName,
                'canceled'
              );

              // Fetch updated reservation
              const updatedReservation = await db.collection('reservations').doc(reservationId).get();
              
              setReservation({
                ...reservation,
                ...updatedReservation.data(),
                status: 'canceled'
              } as Reservation);
              
              setLoading(false);
              Alert.alert('Éxito', 'La reserva ha sido cancelada');
            } catch (err) {
              console.error('Error canceling reservation:', err);
              setLoading(false);
              Alert.alert('Error', 'No se pudo cancelar la reserva');
            }
          }
        }
      ]
    );
  };

  // Get status color
  const getStatusColor = () => {
    if (!reservation) return '#8E8E93';
    
    switch (reservation.status) {
      case 'pending': return '#FF9500';
      case 'confirmed': return '#34C759';
      case 'canceled': return '#FF3B30';
      case 'completed': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  // Get status text
  const getStatusText = () => {
    if (!reservation) return 'Desconocido';
    
    switch (reservation.status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmada';
      case 'canceled': return 'Cancelada';
      case 'completed': return 'Completada';
      default: return 'Desconocido';
    }
  };

  // Check if reservation can be canceled
  const canCancel = () => {
    if (!reservation) return false;
    
    // Can only cancel pending or confirmed reservations
    if (reservation.status !== 'pending' && reservation.status !== 'confirmed') {
      return false;
    }
    
    // Check if reservation is in the future
    try {
      if (!reservation.date || !reservation.date.toDate) return false;
      
      const reservationDate = reservation.date.toDate();
      reservationDate.setHours(23, 59, 59);
      
      return reservationDate > new Date();
    } catch (error) {
      console.error('Error checking future reservation:', error);
      return false;
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando detalles de la reserva...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!reservation) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="event-busy" size={48} color="#8E8E93" />
        <Text style={styles.errorText}>No se encontró la reserva</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      {/* Business information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Negocio</Text>
        <View style={styles.infoRow}>
          <MaterialIcons name="store" size={20} color="#666" />
          <Text style={styles.infoValue}>{reservation.businessName}</Text>
        </View>
      </View>

      {/* Reservation details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalles de la reserva</Text>
        
        <View style={styles.infoRow}>
          <MaterialIcons name="event" size={20} color="#666" />
          <Text style={styles.infoLabel}>Fecha:</Text>
          <Text style={styles.infoValue}>{formatDate(reservation.date)}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <MaterialIcons name="access-time" size={20} color="#666" />
          <Text style={styles.infoLabel}>Hora:</Text>
          <Text style={styles.infoValue}>{reservation.time}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <MaterialIcons name="people" size={20} color="#666" />
          <Text style={styles.infoLabel}>Personas:</Text>
          <Text style={styles.infoValue}>{reservation.partySize}</Text>
        </View>
      </View>

      {/* Contact information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información de contacto</Text>
        
        <View style={styles.infoRow}>
          <MaterialIcons name="person" size={20} color="#666" />
          <Text style={styles.infoLabel}>Nombre:</Text>
          <Text style={styles.infoValue}>{reservation.userName}</Text>
        </View>
        
        {reservation.contactInfo?.phone && (
          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={20} color="#666" />
            <Text style={styles.infoLabel}>Teléfono:</Text>
            <Text style={styles.infoValue}>{reservation.contactInfo.phone}</Text>
          </View>
        )}
        
        {(reservation.contactInfo?.email || reservation.userEmail) && (
          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={20} color="#666" />
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{reservation.contactInfo?.email || reservation.userEmail}</Text>
          </View>
        )}
      </View>

      {/* Notes */}
      {reservation.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notas adicionales</Text>
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>{reservation.notes}</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      {canCancel() && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionButton} onPress={handleCancelReservation}>
            <MaterialIcons name="cancel" size={18} color="#FF3B30" />
            <Text style={styles.cancelButtonText}> Cancelar reserva</Text>
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: '#666666',
    marginLeft: 8,
    width: 80,
  },
  infoValue: {
    fontSize: 15,
    color: '#333333',
    marginLeft: 8,
    flex: 1,
  },
  notesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  notesText: {
    fontSize: 15,
    color: '#333333',
  },
  actionsContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFEBEB',
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ReservationDetailScreen; 
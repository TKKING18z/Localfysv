import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Reservation } from '../../../models/reservationTypes';
import firebase from 'firebase/compat/app';
import notificationService from '../../../services/NotificationService';

interface ReservationDetailModalProps {
  reservation: Reservation | null;
  visible: boolean;
  onClose: () => void;
  onCancelReservation?: (reservationId: string) => Promise<boolean>;
  onConfirmReservation?: (reservationId: string) => Promise<boolean>;
  onCompleteReservation?: (reservationId: string) => Promise<boolean>;
  isBusinessView?: boolean;
  onStatusChange?: (status: string) => void;
}

const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservation,
  visible,
  onClose,
  onCancelReservation,
  onConfirmReservation,
  onCompleteReservation,
  isBusinessView = false,
  onStatusChange
}) => {
  const [loading, setLoading] = useState(false);

  if (!reservation) {
    return null;
  }

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
      (reservation.status === 'pending' || reservation.status === 'confirmed')
    ) && isFutureReservation() && !!onCancelReservation;
  };

  // Verificar si la reserva se puede confirmar
  const canConfirm = () => {
    return reservation.status === 'pending' && isFutureReservation() && !!onConfirmReservation && isBusinessView;
  };

  // Verificar si la reserva se puede marcar como completada
  const canComplete = () => {
    return reservation.status === 'confirmed' && !!onCompleteReservation && isBusinessView;
  };

  // Obtener color según el estado
  const getStatusColor = () => {
    switch (reservation.status) {
      case 'pending': return '#FF9500';
      case 'confirmed': return '#34C759';
      case 'canceled': return '#FF3B30';
      case 'completed': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  // Obtener texto según el estado
  const getStatusText = () => {
    switch (reservation.status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmada';
      case 'canceled': return 'Cancelada';
      case 'completed': return 'Completada';
      default: return 'Desconocido';
    }
  };

  // Manejar cancelación
  const handleCancel = async () => {
    if (!canCancel() || !onCancelReservation) return;

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
              const success = await onCancelReservation(reservation.id);
              
              if (success) {
                // Show cancellation notification to business
                notificationService.showReservationStatusNotification(
                  reservation.id,
                  reservation.businessName,
                  'canceled'
                );
                onStatusChange && onStatusChange('canceled');
                onClose();
              } else {
                throw new Error('No se pudo cancelar la reserva');
              }
            } catch (error) {
              console.error('Error al cancelar reserva:', error);
              Alert.alert('Error', 'No se pudo cancelar la reserva');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Manejar confirmación
  const handleConfirm = async () => {
    if (!canConfirm() || !onConfirmReservation) return;

    Alert.alert(
      'Confirmar Reserva',
      '¿Desea confirmar esta reserva?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, confirmar',
          onPress: async () => {
            try {
              setLoading(true);
              const success = await onConfirmReservation(reservation.id);
              
              if (success) {
                // Show confirmation notification to business
                notificationService.showReservationStatusNotification(
                  reservation.id,
                  reservation.businessName,
                  'confirmed'
                );
                onStatusChange && onStatusChange('confirmed');
                onClose();
              } else {
                throw new Error('No se pudo confirmar la reserva');
              }
            } catch (error) {
              console.error('Error al confirmar reserva:', error);
              Alert.alert('Error', 'No se pudo confirmar la reserva');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Manejar completar
  const handleComplete = async () => {
    if (!canComplete() || !onCompleteReservation) return;

    Alert.alert(
      'Completar Reserva',
      '¿Desea marcar esta reserva como completada?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, completar',
          onPress: async () => {
            try {
              setLoading(true);
              const success = await onCompleteReservation(reservation.id);
              
              if (success) {
                // Show completion notification to business
                notificationService.showReservationStatusNotification(
                  reservation.id,
                  reservation.businessName,
                  'completed'
                );
                onStatusChange && onStatusChange('completed');
                onClose();
              } else {
                throw new Error('No se pudo completar la reserva');
              }
            } catch (error) {
              console.error('Error al completar reserva:', error);
              Alert.alert('Error', 'No se pudo actualizar la reserva');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Detalles de Reserva
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Estado */}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>

            {/* Información básica */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                {isBusinessView ? 'Información del Cliente' : 'Información de la Reserva'}
              </Text>

              {isBusinessView ? (
                <>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="person" size={18} color="#666" />
                    <Text style={styles.infoLabel}>Cliente:</Text>
                    <Text style={styles.infoValue}>{reservation.userName}</Text>
                  </View>

                  {reservation.contactInfo?.phone && (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="phone" size={18} color="#666" />
                      <Text style={styles.infoLabel}>Teléfono:</Text>
                      <Text style={styles.infoValue}>{reservation.contactInfo.phone}</Text>
                    </View>
                  )}

                  {(reservation.contactInfo?.email || reservation.userEmail) && (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="email" size={18} color="#666" />
                      <Text style={styles.infoLabel}>Email:</Text>
                      <Text style={styles.infoValue}>
                        {reservation.contactInfo?.email || reservation.userEmail}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.infoRow}>
                  <MaterialIcons name="store" size={18} color="#666" />
                  <Text style={styles.infoLabel}>Negocio:</Text>
                  <Text style={styles.infoValue}>{reservation.businessName}</Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <MaterialIcons name="event" size={18} color="#666" />
                <Text style={styles.infoLabel}>Fecha:</Text>
                <Text style={styles.infoValue}>{formatDate(reservation.date)}</Text>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="access-time" size={18} color="#666" />
                <Text style={styles.infoLabel}>Hora:</Text>
                <Text style={styles.infoValue}>{reservation.time}</Text>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="people" size={18} color="#666" />
                <Text style={styles.infoLabel}>Personas:</Text>
                <Text style={styles.infoValue}>{reservation.partySize}</Text>
              </View>
            </View>

            {/* Notas */}
            {reservation.notes && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Notas</Text>
                <Text style={styles.notesText}>{reservation.notes}</Text>
              </View>
            )}

            {/* Acciones */}
            <View style={styles.actionsContainer}>
              {loading ? (
                <ActivityIndicator size="large" color="#007AFF" />
              ) : (
                <>
                  {canCancel() && (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={handleCancel}
                    >
                      <MaterialIcons name="cancel" size={18} color="white" />
                      <Text style={styles.actionButtonText}>Cancelar Reserva</Text>
                    </TouchableOpacity>
                  )}

                  {canConfirm() && (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={handleConfirm}
                    >
                      <MaterialIcons name="check-circle" size={18} color="white" />
                      <Text style={styles.actionButtonText}>Confirmar Reserva</Text>
                    </TouchableOpacity>
                  )}

                  {canComplete() && (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={handleComplete}
                    >
                      <MaterialIcons name="done-all" size={18} color="white" />
                      <Text style={styles.actionButtonText}>Marcar Completada</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 16,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    width: 70,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  notesText: {
    fontSize: 15,
    color: '#333',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  actionsContainer: {
    marginVertical: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  completeButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
});

export default ReservationDetailModal;
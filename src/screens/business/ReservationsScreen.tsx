import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Platform,
  ScrollView,
  Switch,
  TextInput
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { firebaseService } from '../../services/firebaseService';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Reservation, Business, ReservationSettings } from '../../types/businessTypes';
import ReservationCard from '../../components/reservations/ReservationCard';
import ReservationForm from '../../components/reservations/ReservationForm';
import { useAuth } from '../../context/AuthContext';

// Definir explícitamente los parámetros que espera esta pantalla
type ReservationsScreenParams = {
  businessId: string;
  businessName: string;
};

// Corregir el tipo para la ruta
type ReservationsRouteProp = RouteProp<{ params: ReservationsScreenParams }, 'params'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'canceled' | 'completed';

const ReservationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ReservationsRouteProp>();
  const { businessId, businessName } = route.params;
  const { user } = useAuth();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showModal, setShowModal] = useState(false);
  const [isBusinessOwner, setIsBusinessOwner] = useState(false);
  const [_, setBusiness] = useState<Business | null>(null);
  const [reservationSettings, setReservationSettings] = useState<ReservationSettings>({
    enabled: true,
    maxGuestsPerTable: 10,
    timeSlots: ['12:00', '13:00', '14:00', '19:00', '20:00'],
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState('');
  
  // Comprobar si el usuario es el propietario del negocio
  useEffect(() => {
    const checkOwnership = async () => {
      if (!user) return;
      
      try {
        const businessData = await firebaseService.businesses.getById(businessId);
        
        if (businessData.success && businessData.data) {
          const businessDetails: Business = businessData.data as unknown as Business;
          setBusiness(businessDetails);
          setIsBusinessOwner(businessDetails.createdBy === user.uid);
          
          // Cargar configuración de reservaciones si existe
          if (businessDetails.reservationSettings) {
            setReservationSettings(businessDetails.reservationSettings);
          }
        }
      } catch (error) {
        console.error("Error al verificar propietario:", error);
      }
    };
    
    checkOwnership();
  }, [businessId, user]);
  
  // Cargar reservaciones apropiadas según el rol del usuario
  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!user) {
        setLoading(false);
        return;
      }
      
      let result;
      
      if (isBusinessOwner) {
        // Si es propietario, obtiene todas las reservas del negocio
        result = await firebaseService.reservations.getByBusinessId(businessId);
      } else {
        // Si es cliente, solo obtiene sus propias reservas para este negocio
        result = await firebaseService.reservations.getByUserAndBusinessId(
          user.uid,
          businessId
        );
      }
      
      if (result.success && result.data) {
        setReservations(result.data);
      } else {
        console.error('Error cargando reservaciones:', result.error);
      }
    } catch (error) {
      console.error('Error en loadReservations:', error);
      Alert.alert('Error', 'Error inesperado al cargar reservaciones');
    } finally {
      setLoading(false);
    }
  }, [businessId, user, isBusinessOwner]);
  
  // Cargar al montar el componente o cuando cambie isBusinessOwner
  useEffect(() => {
    if (user) {
      loadReservations();
    }
  }, [loadReservations, user, isBusinessOwner]);
  
  // Función de actualización (pull to refresh)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReservations();
    setRefreshing(false);
  }, [loadReservations]);
  
  // Cancelar reserva
  const handleCancelReservation = useCallback((reservationId: string) => {
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
              const result = await firebaseService.reservations.updateStatus(
                reservationId,
                'canceled'
              );
              
              if (result.success) {
                // Actualizar lista localmente para reflejar cambio
                setReservations(prev => 
                  prev.map(res => 
                    res.id === reservationId 
                      ? { ...res, status: 'canceled' }
                      : res
                  )
                );
                
                Alert.alert('Éxito', 'Reserva cancelada correctamente');
              } else {
                throw new Error(result.error?.message);
              }
            } catch (error) {
              console.error('Error al cancelar reserva:', error);
              Alert.alert('Error', 'No se pudo cancelar la reserva');
            }
          }
        }
      ]
    );
  }, []);
  
  // Confirmar reserva
  const handleConfirmReservation = useCallback((reservationId: string) => {
    Alert.alert(
      'Confirmar Reserva',
      '¿Desea confirmar esta reserva?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, confirmar',
          onPress: async () => {
            try {
              const result = await firebaseService.reservations.updateStatus(
                reservationId,
                'confirmed'
              );
              
              if (result.success) {
                // Actualizar lista localmente
                setReservations(prev => 
                  prev.map(res => 
                    res.id === reservationId 
                      ? { ...res, status: 'confirmed' }
                      : res
                  )
                );
                
                Alert.alert('Éxito', 'Reserva confirmada correctamente');
              } else {
                throw new Error(result.error?.message);
              }
            } catch (error) {
              console.error('Error al confirmar reserva:', error);
              Alert.alert('Error', 'No se pudo confirmar la reserva');
            }
          }
        }
      ]
    );
  }, []);

  // Marcar como completada
  const handleCompleteReservation = useCallback((reservationId: string) => {
    Alert.alert(
      'Completar Reserva',
      '¿Desea marcar esta reserva como completada?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, completar',
          onPress: async () => {
            try {
              const result = await firebaseService.reservations.updateStatus(
                reservationId,
                'completed'
              );
              
              if (result.success) {
                // Actualizar lista localmente
                setReservations(prev => 
                  prev.map(res => 
                    res.id === reservationId 
                      ? { ...res, status: 'completed' }
                      : res
                  )
                );
                
                Alert.alert('Éxito', 'Reserva marcada como completada');
              } else {
                throw new Error(result.error?.message);
              }
            } catch (error) {
              console.error('Error al completar reserva:', error);
              Alert.alert('Error', 'No se pudo actualizar la reserva');
            }
          }
        }
      ]
    );
  }, []);
  
  // Añadir un nuevo horario disponible
  const addTimeSlot = () => {
    if (!newTimeSlot.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      Alert.alert('Formato inválido', 'Por favor ingrese un horario en formato HH:MM (24h)');
      return;
    }
    
    // Verificar si ya existe
    if (reservationSettings.timeSlots.includes(newTimeSlot)) {
      Alert.alert('Horario duplicado', 'Este horario ya está en la lista');
      return;
    }
    
    // Añadir nuevo horario y ordenarlo
    const updatedSlots = [...reservationSettings.timeSlots, newTimeSlot];
    updatedSlots.sort();
    
    setReservationSettings({
      ...reservationSettings,
      timeSlots: updatedSlots
    });
    
    setNewTimeSlot('');
  };
  
  // Eliminar un horario
  const removeTimeSlot = (slot: string) => {
    setReservationSettings({
      ...reservationSettings,
      timeSlots: reservationSettings.timeSlots.filter((s: string) => s !== slot)
    });
  };
  
  // Manejar disponibilidad por día de semana
  const toggleDayAvailability = (day: string) => {
    const updatedDays = reservationSettings.availableDays.includes(day)
      ? reservationSettings.availableDays.filter((d: string) => d !== day)
      : [...reservationSettings.availableDays, day];
    
    setReservationSettings({
      ...reservationSettings,
      availableDays: updatedDays
    });
  };

  // Guardar configuración de reservaciones
  const saveReservationSettings = async () => {
    if (!businessId) return;
    
    try {
      // Create an object that matches what Firestore expects
      const updateData = {
        acceptsReservations: true,
        reservationSettings: reservationSettings
      } as unknown as Partial<Business>;
      
      const result = await firebaseService.businesses.update(businessId, updateData);
      
      if (result.success) {
        Alert.alert('Éxito', 'Configuración de reservaciones actualizada');
        setShowSettingsModal(false);
      } else {
        Alert.alert('Error', 'No se pudo guardar la configuración');
      }
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      Alert.alert('Error', 'No se pudo actualizar la configuración');
    }
  };
  
  // Deshabilitar reservaciones
  const disableReservations = async () => {
    Alert.alert(
      'Deshabilitar Reservaciones',
      '¿Está seguro que desea deshabilitar las reservaciones para su negocio?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, deshabilitar',
          style: 'destructive',
          onPress: async () => {
            try {
              const updateData = {
                acceptsReservations: false
              } as unknown as Partial<Business>;
              
              const result = await firebaseService.businesses.update(businessId, updateData);
              
              if (result.success) {
                Alert.alert(
                  'Reservaciones deshabilitadas',
                  'Las reservaciones han sido deshabilitadas para tu negocio',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              } else {
                Alert.alert('Error', 'No se pudo actualizar la configuración');
              }
            } catch (error) {
              console.error('Error al deshabilitar reservaciones:', error);
              Alert.alert('Error', 'No se pudo actualizar la configuración');
            }
          }
        }
      ]
    );
  };
  
  // Filtrar reservaciones
  const filteredReservations = reservations.filter(reservation => {
    if (filterStatus === 'all') return true;
    return reservation.status === filterStatus;
  });
  
  // Renderizar reservación - adaptado según el rol
  const renderReservation = ({ item }: { item: Reservation }) => (
    <ReservationCard
      reservation={item}
      onCancelReservation={
        (item.status === 'pending' || item.status === 'confirmed') ? 
          handleCancelReservation : undefined
      }
      onPress={() => {
        // Si es propietario, mostrar opciones adicionales
        if (isBusinessOwner && item.status === 'pending') {
          Alert.alert(
            'Gestionar Reserva',
            '¿Qué acción desea realizar?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Confirmar reserva', onPress: () => handleConfirmReservation(item.id) },
              { text: 'Rechazar reserva', onPress: () => handleCancelReservation(item.id) }
            ]
          );
        } else if (isBusinessOwner && item.status === 'confirmed') {
          Alert.alert(
            'Gestionar Reserva',
            '¿Qué acción desea realizar?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Marcar como completada', onPress: () => handleCompleteReservation(item.id) },
              { text: 'Cancelar reserva', onPress: () => handleCancelReservation(item.id) }
            ]
          );
        }
      }}
      isBusinessView={isBusinessOwner}
    />
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isBusinessOwner ? `Reservaciones - ${businessName}` : `Mis Reservas en ${businessName}`}
        </Text>
        {isBusinessOwner ? (
          <TouchableOpacity onPress={() => setShowSettingsModal(true)}>
            <MaterialIcons name="settings" size={24} color="black" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setShowModal(true)}>
            <MaterialIcons name="add" size={24} color="black" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          {['all', 'pending', 'confirmed', 'canceled', 'completed'].map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filterStatus === status && styles.filterButtonActive
              ]}
              onPress={() => setFilterStatus(status as FilterStatus)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterStatus === status && styles.filterButtonTextActive
                ]}
              >
                {status === 'all' ? 'Todas' :
                 status === 'pending' ? 'Pendientes' :
                 status === 'confirmed' ? 'Confirmadas' :
                 status === 'canceled' ? 'Canceladas' : 'Completadas'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Cargando reservaciones...</Text>
        </View>
      ) : filteredReservations.length > 0 ? (
        <FlatList
          data={filteredReservations}
          renderItem={renderReservation}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="event-busy" size={64} color="#E1E1E1" />
          <Text style={styles.emptyText}>
            {isBusinessOwner 
              ? "No hay reservaciones con este filtro" 
              : "No tienes reservaciones en este negocio"}
          </Text>
          {!isBusinessOwner && (
            <TouchableOpacity 
              style={styles.makeReservationButton}
              onPress={() => setShowModal(true)}
            >
              <LinearGradient
                colors={['#007AFF', '#00C2FF']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialIcons name="add" size={24} color="white" />
                <Text style={styles.buttonText}>Hacer Reserva</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Modal para hacer una reserva (vista de cliente) */}
      <Modal visible={showModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reservar en {businessName}</Text>
            <View style={{width: 24}} />
          </View>
          
          <ReservationForm
            businessId={businessId}
            businessName={businessName}
            onSuccess={(_reservationId: string) => {
              setShowModal(false);
              loadReservations();
              Alert.alert(
                'Reserva Exitosa',
                'Tu reserva ha sido creada con éxito. Recibirás una confirmación pronto.'
              );
            }}
            onCancel={() => setShowModal(false)}
          />
        </SafeAreaView>
      </Modal>
      
      {/* Modal de configuración de reservas (vista de propietario) */}
      <Modal visible={showSettingsModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Configuración de Reservas</Text>
            <View style={{width: 24}} />
          </View>
          
          <ScrollView style={styles.settingsContainer}>
            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>Estado de Reservaciones</Text>
              <View style={styles.switchContainer}>
                <Text style={styles.settingLabel}>Habilitar reservaciones</Text>
                <Switch 
                  value={reservationSettings.enabled}
                  onValueChange={(value) => 
                    setReservationSettings({...reservationSettings, enabled: value})
                  }
                  trackColor={{ false: '#E5E5EA', true: '#4CD964' }}
                  thumbColor={Platform.OS === 'android' ? '#f4f3f4' : ''}
                />
              </View>
              
              {!reservationSettings.enabled && (
                <Text style={styles.warningText}>
                  Las reservaciones están deshabilitadas. Los clientes no podrán hacer reservas.
                </Text>
              )}
            </View>
            
            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>Cantidad de Invitados</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.settingLabel}>Máximo de personas por reserva:</Text>
                <TextInput
                  style={styles.numberInput}
                  value={reservationSettings.maxGuestsPerTable.toString()}
                  onChangeText={(value) => {
                    const number = parseInt(value);
                    if (isNaN(number)) return;
                    
                    setReservationSettings({
                      ...reservationSettings, 
                      maxGuestsPerTable: number
                    });
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
            
            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>Horarios Disponibles</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Ej: 14:30"
                  value={newTimeSlot}
                  onChangeText={setNewTimeSlot}
                />
                <TouchableOpacity 
                  style={[styles.addButton, !newTimeSlot && styles.disabledButton]}
                  onPress={addTimeSlot}
                  disabled={!newTimeSlot}
                >
                  <Text style={styles.addButtonText}>Añadir</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.timeSlotList}>
                {reservationSettings.timeSlots.map((slot: string) => (
                  <View key={slot} style={styles.timeSlotItem}>
                    <Text style={styles.timeSlotText}>{slot}</Text>
                    <TouchableOpacity onPress={() => removeTimeSlot(slot)}>
                      <MaterialIcons name="close" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
                {reservationSettings.timeSlots.length === 0 && (
                  <Text style={styles.emptyText}>No hay horarios configurados</Text>
                )}
              </View>
            </View>
            
            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>Días Disponibles</Text>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                <TouchableOpacity
                  key={day}
                  style={styles.dayItem}
                  onPress={() => toggleDayAvailability(day)}
                >
                  <Text style={styles.dayName}>
                    {day === 'monday' ? 'Lunes' :
                     day === 'tuesday' ? 'Martes' :
                     day === 'wednesday' ? 'Miércoles' :
                     day === 'thursday' ? 'Jueves' :
                     day === 'friday' ? 'Viernes' :
                     day === 'saturday' ? 'Sábado' : 'Domingo'}
                  </Text>
                  <View style={[
                    styles.checkbox,
                    reservationSettings.availableDays.includes(day) && styles.checkboxActive
                  ]}>
                    {reservationSettings.availableDays.includes(day) && (
                      <MaterialIcons name="check" size={16} color="white" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={saveReservationSettings}
              >
                <Text style={styles.saveButtonText}>Guardar Configuración</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.disableReservationsButton}
                onPress={disableReservations}
              >
                <Text style={styles.disableReservationsText}>Deshabilitar Reservaciones</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  filterContainer: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterScrollContent: {
    paddingHorizontal: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0'
  },
  filterButtonActive: {
    backgroundColor: '#007AFF'
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333'
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: 'bold'
  },
  listContent: {
    padding: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20
  },
  makeReservationButton: {
    borderRadius: 8,
    overflow: 'hidden',
    width: '80%',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  settingsContainer: {
    flex: 1,
    padding: 16,
  },
  settingSection: {
    marginBottom: 24,
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
  },
  settingSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  warningText: {
    marginTop: 8,
    color: '#FF3B30',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  numberInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#A2D1FF',
  },
  timeSlotList: {
    marginTop: 8,
  },
  timeSlotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  timeSlotText: {
    fontSize: 16,
  },
  dayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 4,
  },
  dayName: {
    fontSize: 16,
    color: '#333',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  buttonContainer: {
    marginVertical: 24,
    paddingBottom: 40, // Extra padding for scrolling past bottom tabs
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disableReservationsButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disableReservationsText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ReservationsScreen;

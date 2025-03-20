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
  TextInput,
  SectionList
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { reservationService } from '../../../services/reservationService';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Reservation, ReservationSettings, DEFAULT_TIME_SLOTS, DEFAULT_AVAILABLE_DAYS } from '../../../models/reservationTypes';
import ReservationCard from '../../components/reservations/ReservationCard';
import ReservationForm from '../../components/reservations/ReservationForm';
import ReservationDetailModal from '../../components/reservations/ReservationDetailModal';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useReservations, ReservationFilter } from '../../../hooks/useReservations';
import firebase from 'firebase/compat/app';

// Definir explícitamente los parámetros que espera esta pantalla
type ReservationsScreenParams = {
  businessId: string;
  businessName: string;
  isNewBusiness?: boolean;
};

// Corregir el tipo para la ruta
type ReservationsRouteProp = RouteProp<{ params: ReservationsScreenParams }, 'params'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const ReservationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ReservationsRouteProp>();
  const { businessId, businessName, isNewBusiness } = route.params;
  const { user } = useAuth();
  const store = useStore();
  
  // Estados de UI
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isBusinessOwner, setIsBusinessOwner] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState('');

  // Configuración de reservaciones
  const [reservationSettings, setReservationSettings] = useState<ReservationSettings>({
    enabled: true,
    maxGuestsPerTable: 10,
    timeSlots: DEFAULT_TIME_SLOTS,
    availableDays: DEFAULT_AVAILABLE_DAYS
  });

  // Check if this is a temporary business for setup
  const isTempBusiness = businessId === 'new_business' || (businessId && businessId.toString().startsWith('temp_'));
  
  // Usar hook personalizado para gestionar reservaciones
  const {
    reservations,
    loading,
    error,
    refreshing,
    filter,
    setFilter,
    refresh,
    cancelReservation,
    confirmReservation,
    completeReservation,
    getReservationsByDate
  } = useReservations({
    userId: isBusinessOwner ? undefined : user?.uid,
    businessId: isBusinessOwner ? businessId : businessId,
    initialFilter: ReservationFilter.ACTIVE
  });

  // Initialize reservation settings from store if this is a new business
  useEffect(() => {
    if (isTempBusiness) {
      const tempSettings = store.getTempData('tempReservationSettings');
      if (tempSettings) {
        setReservationSettings(tempSettings);
      }
    }
  }, [isTempBusiness, store]);

  // Comprobar si el usuario es el propietario del negocio
  useEffect(() => {
    const checkOwnership = async () => {
      if (!user) return;
      
      // For temporary businesses, the current user is always the owner
      if (isTempBusiness) {
        setIsBusinessOwner(true);
        return;
      }
      
      try {
        const businessData = await firebase.firestore()
          .collection('businesses')
          .doc(businessId)
          .get();
        
        if (businessData.exists) {
          const businessDoc = businessData.data();
          setIsBusinessOwner(businessDoc?.createdBy === user.uid);
          
          // Cargar configuración de reservaciones si existe
          if (businessDoc?.reservationSettings) {
            setReservationSettings(businessDoc.reservationSettings);
          }
        }
      } catch (error) {
        console.error("Error al verificar propietario:", error);
      }
    };
    
    checkOwnership();
  }, [businessId, user, isTempBusiness]);

  // Preparar datos para la lista seccionada
  const prepareDataForSectionList = useCallback(() => {
    const reservationsByDate = getReservationsByDate();
    const sections = Object.keys(reservationsByDate).map(date => {
      // Convertir fecha de "YYYY-MM-DD" a un formato más legible
      let displayDate;
      try {
        const dateObj = new Date(date);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        
        // Verificar si es hoy, mañana o una fecha específica
        if (dateObj.toDateString() === today.toDateString()) {
          displayDate = "Hoy";
        } else if (dateObj.toDateString() === tomorrow.toDateString()) {
          displayDate = "Mañana";
        } else {
          displayDate = dateObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          // Capitalizar primera letra
          displayDate = displayDate.charAt(0).toUpperCase() + displayDate.slice(1);
        }
      } catch (error) {
        console.error('Error formateando fecha:', error);
        displayDate = date; // Fallback al formato original
      }
      
      return {
        title: displayDate,
        data: reservationsByDate[date]
      };
    });
    
    // Ordenar secciones por fecha (más recientes primero)
    sections.sort((a, b) => {
      const dateA = a.data[0]?.date.toDate() || new Date();
      const dateB = b.data[0]?.date.toDate() || new Date();
      return dateA.getTime() - dateB.getTime(); // Orden ascendente
    });
    
    return sections;
  }, [getReservationsByDate]);

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
    if (isTempBusiness) {
      // Store settings in context for later use during business creation
      store.setTempData('tempReservationSettings', reservationSettings);
      Alert.alert('Éxito', 'Configuración guardada', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      return;
    }
    
    if (!businessId) return;
    
    try {
      // Create an object that matches what Firestore expects
      const updateData = {
        acceptsReservations: true,
        reservationSettings: reservationSettings
      };
      
      // Use transaction for atomicity
      await firebase.firestore().runTransaction(async (transaction) => {
        const businessRef = firebase.firestore().collection('businesses').doc(businessId);
        transaction.update(businessRef, updateData);
      });
      
      Alert.alert('Éxito', 'Configuración de reservaciones actualizada');
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      Alert.alert('Error', 'No se pudo actualizar la configuración');
    }
  };

  // Manejar creación de reserva exitosa
  const handleReservationSuccess = (reservationId: string) => {
    setShowReservationForm(false);
    refresh();
    Alert.alert(
      'Reserva Exitosa',
      'Tu reserva ha sido creada con éxito. Recibirás una confirmación pronto.'
    );
  };

  // Renderizar cada reservación
  const renderReservation = ({ item }: { item: Reservation }) => (
    <ReservationCard
      reservation={item}
      onCancelReservation={
        (item.status === 'pending' || item.status === 'confirmed') ? 
          cancelReservation : undefined
      }
      onPress={() => {
        setSelectedReservation(item);
        setShowDetailModal(true);
      }}
      isBusinessView={isBusinessOwner}
    />
  );

  // Renderizar cabecera de sección
  const renderSectionHeader = ({ section }: { section: { title: string, data: Reservation[] } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  // Estados de UI vacíos
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="event-busy" size={64} color="#E1E1E1" />
      <Text style={styles.emptyText}>
        {isBusinessOwner 
          ? "No hay reservaciones para mostrar" 
          : "No tienes reservaciones en este negocio"}
      </Text>
      {!isBusinessOwner && (
        <TouchableOpacity 
          style={styles.makeReservationButton}
          onPress={() => setShowReservationForm(true)}
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
  );

  // Renderizar filtros
  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.filterScrollContent}
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === ReservationFilter.ACTIVE && styles.filterButtonActive
          ]}
          onPress={() => setFilter(ReservationFilter.ACTIVE)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === ReservationFilter.ACTIVE && styles.filterButtonTextActive
            ]}
          >
            Activas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === ReservationFilter.PENDING && styles.filterButtonActive
          ]}
          onPress={() => setFilter(ReservationFilter.PENDING)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === ReservationFilter.PENDING && styles.filterButtonTextActive
            ]}
          >
            Pendientes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === ReservationFilter.CONFIRMED && styles.filterButtonActive
          ]}
          onPress={() => setFilter(ReservationFilter.CONFIRMED)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === ReservationFilter.CONFIRMED && styles.filterButtonTextActive
            ]}
          >
            Confirmadas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === ReservationFilter.INACTIVE && styles.filterButtonActive
          ]}
          onPress={() => setFilter(ReservationFilter.INACTIVE)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === ReservationFilter.INACTIVE && styles.filterButtonTextActive
            ]}
          >
            Historial
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === ReservationFilter.ALL && styles.filterButtonActive
          ]}
          onPress={() => setFilter(ReservationFilter.ALL)}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === ReservationFilter.ALL && styles.filterButtonTextActive
            ]}
          >
            Todas
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // Renderización principal
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isBusinessOwner ? `Reservaciones - ${businessName}` : `Mis Reservas en ${businessName}`}
        </Text>
        {isBusinessOwner ? (
          <TouchableOpacity onPress={() => setShowSettingsModal(true)}>
            <MaterialIcons name="settings" size={24} color="#333" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setShowReservationForm(true)}>
            <MaterialIcons name="add" size={24} color="#333" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Filtros */}
      {renderFilters()}
      
      {/* Add info banner for new businesses */}
      {isTempBusiness && (
        <View style={styles.infoBanner}>
          <MaterialIcons name="info" size={20} color="#007AFF" />
          <Text style={styles.infoBannerText}>
            Configure las opciones de reservación para su nuevo negocio. Esta configuración se aplicará cuando se cree el negocio.
          </Text>
        </View>
      )}
      
      {/* Lista de reservaciones */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando reservaciones...</Text>
        </View>
      ) : (
        <SectionList
          sections={prepareDataForSectionList()}
          keyExtractor={(item) => item.id}
          renderItem={renderReservation}
          renderSectionHeader={renderSectionHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={reservations.length === 0 ? { flex: 1 } : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          stickySectionHeadersEnabled={true}
        />
      )}
      
      {/* Modal para hacer una reserva (vista de cliente) */}
      <Modal 
        visible={showReservationForm} 
        animationType="slide" 
        transparent={false}
        onRequestClose={() => setShowReservationForm(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReservationForm(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reservar en {businessName}</Text>
            <View style={{width: 24}} />
          </View>
          
          <ReservationForm
            businessId={businessId}
            businessName={businessName}
            onSuccess={handleReservationSuccess}
            onCancel={() => setShowReservationForm(false)}
          />
        </SafeAreaView>
      </Modal>
      
      {/* Modal de detalle de reservación */}
      <ReservationDetailModal
        reservation={selectedReservation}
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedReservation(null);
        }}
        onCancelReservation={cancelReservation}
        onConfirmReservation={isBusinessOwner ? confirmReservation : undefined}
        onCompleteReservation={isBusinessOwner ? completeReservation : undefined}
        isBusinessView={isBusinessOwner}
      />
      
      {/* Modal de configuración de reservas (vista de propietario) */}
      <Modal 
        visible={showSettingsModal} 
        animationType="slide" 
        transparent={false}
        onRequestClose={() => setShowSettingsModal(false)}
      >
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
    backgroundColor: '#F5F7FF'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterScrollContent: {
    paddingHorizontal: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: '#F0F0F5',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  makeReservationButton: {
    borderRadius: 12,
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
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  sectionHeader: {
    backgroundColor: '#F5F7FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    margin: 16,
    alignItems: 'center',
  },
  infoBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
  },
  settingsContainer: {
    padding: 16,
  },
  settingSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333333',
  },
  warningText: {
    marginTop: 8,
    color: '#FF3B30',
    fontStyle: 'italic',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  numberInput: {
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 10,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: '#A2D1FF',
  },
  timeSlotList: {
    marginBottom: 8,
  },
  timeSlotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F0F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  timeSlotText: {
    fontSize: 16,
    color: '#333333',
  },
  dayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  dayName: {
    fontSize: 16,
    color: '#333333',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  buttonContainer: {
    marginBottom: 40,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ReservationsScreen;
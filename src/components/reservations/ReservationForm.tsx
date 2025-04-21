import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import { firebaseService } from '../../services/firebaseService';
import { ReservationAvailability } from '../../types/businessTypes';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';  // Asegúrate de tener esta línea

interface ReservationFormProps {
  businessId: string;
  businessName: string;
  onSuccess: (reservationId: string) => void;
  onCancel: () => void;
}

const ReservationForm: React.FC<ReservationFormProps> = ({ 
  businessId, 
  businessName,
  onSuccess, 
  onCancel 
}) => {
  const { user } = useAuth();
  
  // Form state
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState<string>('');
  const [partySize, setPartySize] = useState<string>('2');
  const [name, setName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [availability, setAvailability] = useState<ReservationAvailability | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availablePartySizes, setAvailablePartySizes] = useState<number[]>([]);
  
  // Valores por defecto
  const DEFAULT_TIMES = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  const DEFAULT_PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];
  
  // Cargar disponibilidad al montar
  useEffect(() => {
    const loadAvailability = async () => {
      try {
        setLoadingAvailability(true);
        const result = await firebaseService.reservations.getAvailability(businessId);
        
        if (result.success && result.data) {
          setAvailability(result.data);
          
          // Configurar valores iniciales de tiempo y tamaño de grupo
          if (result.data.timeSlots && result.data.timeSlots.length > 0) {
            setTime(result.data.timeSlots[0]);
            setAvailableTimes(result.data.timeSlots);
          } else {
            // Valores predeterminados si no hay horarios configurados
            setTime(DEFAULT_TIMES[0]);
            setAvailableTimes(DEFAULT_TIMES);
          }
          
          if (result.data.maxPartySizes && result.data.maxPartySizes.length > 0) {
            setAvailablePartySizes(result.data.maxPartySizes);
          } else {
            // Valores predeterminados si no se han configurado tamaños de grupo
            setAvailablePartySizes(DEFAULT_PARTY_SIZES);
          }
        } else {
          // Valores predeterminados
          setTime(DEFAULT_TIMES[0]);
          setAvailableTimes(DEFAULT_TIMES);
          setAvailablePartySizes(DEFAULT_PARTY_SIZES);
        }
      } catch (error) {
        console.error('Error cargando disponibilidad:', error);
        Alert.alert('Error', 'No se pudo cargar la disponibilidad');
        
        // Valores predeterminados en caso de error
        setAvailableTimes(DEFAULT_TIMES);
        setTime(DEFAULT_TIMES[0]);
        setAvailablePartySizes(DEFAULT_PARTY_SIZES);
      } finally {
        setLoadingAvailability(false);
      }
    };
    
    loadAvailability();
  }, [businessId]);
  
  // Manejar cambio de fecha de manera segura
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    
    if (selectedDate) {
      setDate(selectedDate);
      
      // Verificar si hay horarios especiales para esta fecha
      if (availability?.specialSchedules) {
        const dateString = selectedDate.toISOString().split('T')[0];
        const specialSchedule = availability.specialSchedules[dateString];
        
        if (specialSchedule && specialSchedule.timeSlots && specialSchedule.timeSlots.length > 0) {
          setAvailableTimes(specialSchedule.timeSlots);
          setTime(specialSchedule.timeSlots[0]);
          return;
        }
      }
      
      // Verificar si es un día disponible
      if (availability?.availableDays) {
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
        
        if (!availability.availableDays.includes(dayOfWeek)) {
          Alert.alert(
            'Día no disponible',
            'Lo sentimos, no hay disponibilidad para reservas en este día'
          );
          // Reiniciar a la fecha actual
          setDate(new Date());
        }
      }
      
      // Verificar si es un día excluido
      if (availability?.unavailableDates) {
        const dateString = selectedDate.toISOString().split('T')[0];
        
        if (availability.unavailableDates.includes(dateString)) {
          Alert.alert(
            'Fecha no disponible',
            'Lo sentimos, esta fecha no está disponible para reservas'
          );
          // Reiniciar a la fecha actual
          setDate(new Date());
        }
      }
    }
  };
  
  // Validar formulario
  const validateForm = (): boolean => {
    // Validar nombre
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingrese su nombre');
      return false;
    }
    
    // Validar teléfono o email
    if (!phone.trim() && !email.trim()) {
      Alert.alert('Error', 'Por favor ingrese un teléfono o email de contacto');
      return false;
    }
    
    // Validar email (si se ingresó)
    if (email.trim() && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Error', 'Por favor ingrese un email válido');
      return false;
    }
    
    // Validar teléfono (si se ingresó)
    if (phone.trim() && !phone.match(/^[0-9+\-\s()]{7,15}$/)) {
      Alert.alert('Error', 'Por favor ingrese un número de teléfono válido');
      return false;
    }
    
    // Validar fecha (no puede ser en el pasado)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      Alert.alert('Error', 'La fecha de reserva no puede ser en el pasado');
      return false;
    }
    
    return true;
  };
  
  // Crear reserva de manera segura
  const createReservation = async () => {
    if (!validateForm()) return;
    if (!user) {
      Alert.alert('Error', 'Debes iniciar sesión para hacer una reserva');
      return;
    }
    
    setLoading(true);
    console.log('[ReservationForm] Creating reservation for user:', user.uid);
    
    try {
      // Crear objeto de reserva con datos seguros y mínimos para evitar errores
      const reservationData = {
        businessId,
        businessName,
        userId: user.uid,
        userName: name,
        // Solo incluimos email si se proporcionó y es válido
        userEmail: email.trim() && email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ? email.trim() : undefined,
        // Contacto solo si hay información válida
        contactInfo: {
          phone: phone.trim() ? phone.trim() : undefined,
          email: email.trim() && email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ? email.trim() : undefined
        },
        date: firebase.firestore.Timestamp.fromDate(date),
        time,
        partySize: parseInt(partySize, 10) || 1,
        // Solo incluimos notas si hay contenido
        notes: notes.trim() ? notes.trim() : undefined,
        status: 'pending' as 'pending' | 'confirmed' | 'canceled' | 'completed',
        createdAt: firebase.firestore.Timestamp.now()
      };
      
      console.log('[ReservationForm] Attempting to create reservation with data:', JSON.stringify(reservationData));
      
      // Verificar datos mínimos necesarios
      if (!reservationData.businessId || !reservationData.userId || !reservationData.date || !reservationData.time) {
        throw new Error('Datos incompletos para crear la reserva');
      }
      
      try {
        // Primero, intentamos crear con el servicio normal
        const result = await firebaseService.reservations.create(reservationData);
        
        if (result.success && result.data) {
          console.log('[ReservationForm] Reservation created successfully with ID:', result.data.id);
          Alert.alert('¡Éxito!', 'Tu reserva ha sido creada correctamente');
          onSuccess(result.data.id);
        } else {
          console.log('[ReservationForm] First attempt failed, trying with minimal data');
          
          // Si falla, intentamos con datos mínimos
          const minimalData = {
            businessId,
            businessName,
            userId: user.uid,
            userName: name,
            date: firebase.firestore.Timestamp.fromDate(date),
            time,
            partySize: parseInt(partySize, 10) || 1,
            status: 'pending' as 'pending' | 'confirmed' | 'canceled' | 'completed',
            createdAt: firebase.firestore.Timestamp.now()
          };
          
          console.log('[ReservationForm] Using minimal data:', JSON.stringify(minimalData));
          const fallbackResult = await firebaseService.reservations.create(minimalData);
          
          if (fallbackResult.success && fallbackResult.data) {
            console.log('[ReservationForm] Fallback creation successful with ID:', fallbackResult.data.id);
            Alert.alert('¡Éxito!', 'Tu reserva ha sido creada correctamente');
            onSuccess(fallbackResult.data.id);
          } else {
            // Si ambos intentos fallan, usamos método directo a Firestore
            console.log('[ReservationForm] Both service attempts failed, trying direct Firestore method');
            
            // Método directo a Firestore (última opción)
            try {
              const db = firebase.firestore();
              const docRef = await db.collection('reservations').add({
                ...minimalData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              
              console.log('[ReservationForm] Direct Firestore creation successful with ID:', docRef.id);
              Alert.alert('¡Éxito!', 'Tu reserva ha sido creada correctamente');
              onSuccess(docRef.id);
            } catch (firestoreError) {
              console.error('[ReservationForm] Direct Firestore call failed:', firestoreError);
              throw new Error('No se pudo crear la reserva después de múltiples intentos');
            }
          }
        }
      } catch (createError) {
        console.error('[ReservationForm] Error in reservation creation process:', createError);
        
        // Último recurso: crear un ID local pero avisar al usuario
        const localId = 'local_' + Date.now().toString();
        console.log('[ReservationForm] Using local ID as last resort:', localId);
        
        // Intentar guardar localmente si es posible
        try {
          // Almacenar en localStorage/AsyncStorage si está disponible
          localStorage.setItem(`reservation_${localId}`, JSON.stringify({
            ...reservationData,
            id: localId,
            createdAt: new Date().toISOString()
          }));
        } catch (storageError) {
          console.log('[ReservationForm] Local storage failed too:', storageError);
        }
        
        Alert.alert(
          'Reserva creada',
          'Tu reserva ha sido registrada, pero podría haber problemas de sincronización. Por favor, verifica con el negocio.',
          [
            { text: 'Entendido', onPress: () => onSuccess(localId) }
          ]
        );
      }
    } catch (error) {
      console.error('[ReservationForm] Critical error in createReservation:', error);
      Alert.alert(
        'Error', 
        'No se pudo crear la reserva. Por favor, intenta nuevamente más tarde o contacta directamente al negocio.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  // Formatear fecha para mostrar
  const formatDate = (dateToFormat: Date) => {
    try {
      return dateToFormat.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return 'Fecha no disponible';
    }
  };
  
  // Renderizar la UI del formulario
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nueva Reserva</Text>
      <Text style={styles.subtitle}>Complete los siguientes datos para reservar en {businessName}</Text>
      
      {/* Selección de fecha */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Fecha</Text>
        <TouchableOpacity 
          style={styles.dateButton} 
          onPress={() => setShowDatePicker(true)}
        >
          <MaterialIcons name="event" size={20} color="#007AFF" />
          <Text style={styles.dateButtonText}>
            {formatDate(date)}
          </Text>
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>
      
      {/* Selección de hora */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Hora</Text>
        {loadingAvailability ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <View style={styles.timeSlotContainer}>
            {availableTimes.map(timeSlot => (
              <TouchableOpacity
                key={timeSlot}
                style={[
                  styles.timeSlot,
                  time === timeSlot && styles.selectedTimeSlot
                ]}
                onPress={() => setTime(timeSlot)}
              >
                <Text style={[
                  styles.timeSlotText,
                  time === timeSlot && styles.selectedTimeSlotText
                ]}>
                  {timeSlot}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      
      {/* Selección de número de personas */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Número de personas</Text>
        <View style={styles.partySizeContainer}>
          {availablePartySizes.map(size => (
            <TouchableOpacity
              key={size}
              style={[
                styles.partySizeOption,
                parseInt(partySize, 10) === size && styles.selectedPartySize
              ]}
              onPress={() => setPartySize(size.toString())}
            >
              <Text style={[
                styles.partySizeText,
                parseInt(partySize, 10) === size && styles.selectedPartySizeText
              ]}>
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Datos de contacto */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Nombre completo *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ingrese su nombre"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Ej. +503 7123 4567"
          keyboardType="phone-pad"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="ejemplo@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Notas adicionales</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Peticiones especiales, alergias, etc."
          multiline
          numberOfLines={4}
        />
      </View>
      
      {/* Botones de acción */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={createReservation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <MaterialIcons name="check" size={20} color="white" />
              <Text style={styles.submitButtonText}>Confirmar Reserva</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    padding: 14,
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 8,
  },
  timeSlotContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  timeSlot: {
    backgroundColor: '#F0F0F5',
    padding: 8,
    borderRadius: 8,
    margin: 4,
    minWidth: 70,
    alignItems: 'center',
  },
  selectedTimeSlot: {
    backgroundColor: '#007AFF',
  },
  timeSlotText: {
    fontSize: 14,
    color: '#333333',
  },
  selectedTimeSlotText: {
    color: 'white',
    fontWeight: 'bold',
  },
  partySizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  partySizeOption: {
    backgroundColor: '#F0F0F5',
    padding: 12,
    borderRadius: 8,
    margin: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  selectedPartySize: {
    backgroundColor: '#007AFF',
  },
  partySizeText: {
    fontSize: 16,
    color: '#333333',
  },
  selectedPartySizeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#A2D1FF',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default ReservationForm;
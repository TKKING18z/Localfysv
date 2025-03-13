import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessHours, DayHours } from '../context/BusinessContext';
import CustomTimePicker from '../components/CustomTimePicker';
import { useStore } from '../context/StoreContext';

// Definir la interfaz para los parámetros de ruta de manera más estricta
interface BusinessHoursParams {
  initialHours?: BusinessHours;
  callbackId: string;
}

// Tipo para la ruta
type BusinessHoursRouteProp = RouteProp<{ BusinessHours: BusinessHoursParams }, 'BusinessHours'>;

// Tipo para la navegación
type BusinessHoursNavigationProp = StackNavigationProp<{ BusinessHours: BusinessHoursParams }, 'BusinessHours'>;

const defaultHours: DayHours = {
  open: '09:00',
  close: '18:00',
  closed: false
};

const daysOfWeek = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

// Interface para el configurador de horas
interface TimePickerConfig {
  day: string;
  type: 'open' | 'close';
  currentTime: string;
}

const BusinessHoursScreen: React.FC = () => {
  const navigation = useNavigation<BusinessHoursNavigationProp>();
  const route = useRoute<BusinessHoursRouteProp>();
  const store = useStore();
  
  // Extraer parámetros de manera segura
  const getParams = (): BusinessHoursParams => {
    try {
      if (!route.params) {
        console.warn('No route params found, using defaults');
        return { callbackId: '' };
      }
      return route.params;
    } catch (error) {
      console.error('Error accessing route params:', error);
      return { callbackId: '' };
    }
  };
  
  const { initialHours, callbackId } = getParams();
  
  // Estado para almacenar los horarios
  const [hours, setHours] = useState<BusinessHours>(() => {
    // Inicializar con valores por defecto o los proporcionados
    const defaultBusinessHours: BusinessHours = {};
    
    daysOfWeek.forEach(day => {
      defaultBusinessHours[day.key] = { ...defaultHours };
    });
    
    if (initialHours && Object.keys(initialHours).length > 0) {
      console.log('Inicializando con horarios existentes:', initialHours);
      return initialHours;
    }
    
    console.log('Inicializando con horarios por defecto');
    return defaultBusinessHours;
  });
  
  // Estado para el picker de tiempo personalizado
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerConfig, setTimePickerConfig] = useState<TimePickerConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Log inicial para depuración
  useEffect(() => {
    console.log('BusinessHoursScreen mounted with params:', {
      initialHours: initialHours ? 'provided' : 'not provided',
      callbackId
    });
    
    // Comprobar si el callback existe
    const callback = store.getCallback(callbackId);
    console.log(`Callback exists: ${!!callback}`);
    
    // Limpiar al desmontar
    return () => {
      console.log(`BusinessHoursScreen unmounting, callbackId: ${callbackId}`);
    };
  }, []);
  
  // Efecto para detectar cambios
  useEffect(() => {
    setHasChanges(true);
  }, [hours]);
  
  // Cambiar estado de abierto/cerrado para un día
  const toggleClosed = (day: string) => {
    setHours(prevHours => {
      const newHours = { ...prevHours };
      const dayHours = { ...(newHours[day] || defaultHours) };
      
      dayHours.closed = !dayHours.closed;
      newHours[day] = dayHours;
      
      return newHours;
    });
  };
  
  // Mostrar selector de hora
  const openTimePicker = (day: string, type: 'open' | 'close') => {
    const dayHours = hours[day] || defaultHours;
    const timeString = dayHours[type];
    
    setTimePickerConfig({
      day,
      type,
      currentTime: timeString
    });
    
    setShowTimePicker(true);
  };
  
  // Manejar selección de tiempo
  const handleTimeSelected = (hoursStr: string, minutesStr: string) => {
    if (!timePickerConfig) {
      console.warn('Time picker config is null, cannot update time');
      return;
    }
    
    const { day, type } = timePickerConfig;
    const timeString = `${hoursStr}:${minutesStr}`;
    
    setHours(prevHours => {
      const newHours = { ...prevHours };
      const dayHours = { ...(newHours[day] || defaultHours) };
      
      dayHours[type] = timeString;
      newHours[day] = dayHours;
      
      return newHours;
    });
    
    // Ocultar el selector
    setShowTimePicker(false);
  };
  
  // Copiar horario a todos los días
  const copyToAllDays = (sourceDay: string) => {
    const sourceDayHours = hours[sourceDay];
    if (!sourceDayHours) return;
    
    Alert.alert(
      'Copiar horario',
      `¿Estás seguro de que quieres copiar el horario de ${getDayLabel(sourceDay)} a todos los días?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Copiar', 
          onPress: () => {
            setHours(prevHours => {
              const newHours = { ...prevHours };
              
              daysOfWeek.forEach(day => {
                if (day.key !== sourceDay) {
                  newHours[day.key] = { ...sourceDayHours };
                }
              });
              
              return newHours;
            });
          }
        }
      ]
    );
  };
  
  // Obtener etiqueta del día
  const getDayLabel = (day: string): string => {
    const foundDay = daysOfWeek.find(d => d.key === day);
    return foundDay ? foundDay.label : day;
  };
  
  // Guardar cambios
  const handleSave = () => {
    if (!callbackId) {
      console.error("No callback ID provided, cannot save");
      Alert.alert(
        "Error",
        "No se puede guardar. ID de callback no válido.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
      return;
    }
    
    try {
      // Obtener el callback del store
      const saveCallback = store.getCallback(callbackId);
      
      if (typeof saveCallback === 'function') {
        console.log(`Executing callback with ID: ${callbackId}`);
        console.log('Saving hours:', hours);
        
        // Llamar al callback con los datos actualizados
        saveCallback(hours);
        
        // Mostrar confirmación
        Alert.alert(
          "Éxito",
          "Horarios guardados correctamente.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error("Callback not found or not a function");
      }
    } catch (error) {
      console.error("Error saving business hours:", error);
      Alert.alert(
        "Error",
        "No se pudieron guardar los horarios. Intentelo nuevamente.",
        [{ text: "OK" }]
      );
    }
  };
  
  // Confirmar antes de salir si hay cambios sin guardar
  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        "Cambios sin guardar",
        "Tienes cambios sin guardar. ¿Deseas descartarlos?",
        [
          { text: "No", style: "cancel" },
          { text: "Sí", onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Horarios de Atención</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Guardar</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollContent}>
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Configura los horarios de atención de tu negocio. Si está cerrado un día, activa el interruptor "Cerrado".
          </Text>
        </View>
        
        {daysOfWeek.map(day => {
          const dayKey = day.key;
          const dayHours = hours[dayKey] || defaultHours;
          const isClosed = !!dayHours.closed;
          
          return (
            <View key={day.key} style={styles.dayContainer}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <View style={styles.closedContainer}>
                  <Text style={styles.closedLabel}>Cerrado</Text>
                  <Switch
                    value={isClosed}
                    onValueChange={() => toggleClosed(dayKey)}
                    trackColor={{ false: '#D1D1D6', true: '#007AFF' }}
                    thumbColor={'#FFFFFF'}
                  />
                </View>
              </View>
              
              {!isClosed && (
                <View style={styles.hoursContainer}>
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => openTimePicker(dayKey, 'open')}
                  >
                    <Text style={styles.timeLabel}>Abrir:</Text>
                    <Text style={styles.timeValue}>{dayHours.open}</Text>
                    <MaterialIcons name="access-time" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => openTimePicker(dayKey, 'close')}
                  >
                    <Text style={styles.timeLabel}>Cerrar:</Text>
                    <Text style={styles.timeValue}>{dayHours.close}</Text>
                    <MaterialIcons name="access-time" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.copyButton}
                    onPress={() => copyToAllDays(dayKey)}
                  >
                    <MaterialIcons name="content-copy" size={20} color="#007AFF" />
                    <Text style={styles.copyButtonText}>Copiar a todos</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      
      {/* Time Picker personalizado */}
      {timePickerConfig && (
        <CustomTimePicker
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onTimeSelected={handleTimeSelected}
          initialHours={timePickerConfig.currentTime.split(':')[0]}
          initialMinutes={timePickerConfig.currentTime.split(':')[1]}
          title={`Seleccionar hora de ${timePickerConfig.type === 'open' ? 'apertura' : 'cierre'}`}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E1F5FE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0277BD',
  },
  dayContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  closedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closedLabel: {
    fontSize: 14,
    color: '#666666',
    marginRight: 8,
  },
  hoursContainer: {
    marginTop: 8,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  timeLabel: {
    fontSize: 16,
    color: '#333333',
    width: 60,
  },
  timeValue: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    fontWeight: 'bold',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
});

export default BusinessHoursScreen;
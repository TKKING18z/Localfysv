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
import { useStore } from '../context/StoreContext';
import CustomTimePicker from '../components/CustomTimePicker';
import { RootStackParamList } from '../navigation/AppNavigator';

// Define DayOfWeek as a specific union type
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Define the DayHours interface
interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}

// Define BusinessHours with a proper index signature
interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
  [key: string]: DayHours | undefined; // This allows string indexing
}

// Extend RootStackParamList for this specific screen
type ExtendedRootStackParamList = RootStackParamList & {
  BusinessHours: {
    initialHours?: BusinessHours;
    callbackId: string;
    onSave?: (hours: BusinessHours) => void;
  }
};

type BusinessHoursScreenRouteProp = RouteProp<ExtendedRootStackParamList, 'BusinessHours'>;
type BusinessHoursScreenNavigationProp = StackNavigationProp<ExtendedRootStackParamList, 'BusinessHours'>;

// Type for time picker configuration
interface TimePickerConfig {
  day: DayOfWeek;
  type: 'open' | 'close';
  currentTime: string;
}

const defaultHours: DayHours = {
  open: '09:00',
  close: '18:00',
  closed: false
};

const daysOfWeek = [
  { key: 'monday' as DayOfWeek, label: 'Lunes' },
  { key: 'tuesday' as DayOfWeek, label: 'Martes' },
  { key: 'wednesday' as DayOfWeek, label: 'Miércoles' },
  { key: 'thursday' as DayOfWeek, label: 'Jueves' },
  { key: 'friday' as DayOfWeek, label: 'Viernes' },
  { key: 'saturday' as DayOfWeek, label: 'Sábado' },
  { key: 'sunday' as DayOfWeek, label: 'Domingo' },
];

const BusinessHoursScreen: React.FC = () => {
  const navigation = useNavigation<BusinessHoursScreenNavigationProp>();
  const route = useRoute<BusinessHoursScreenRouteProp>();
  const store = useStore();
  
  // Extract params with proper typing
  const { initialHours, callbackId } = route.params || { initialHours: undefined, callbackId: '' };
  
  // Initialize hours state with proper typing
  const [hours, setHours] = useState<BusinessHours>(() => {
    // Create default business hours
    const defaultBusinessHours: BusinessHours = {};
    
    daysOfWeek.forEach(day => {
      defaultBusinessHours[day.key] = { ...defaultHours };
    });
    
    return initialHours && Object.keys(initialHours).length > 0 
      ? initialHours 
      : defaultBusinessHours;
  });
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerConfig, setTimePickerConfig] = useState<TimePickerConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Track changes to hours
  useEffect(() => {
    setHasChanges(true);
  }, [hours]);
  
  // Toggle closed status for a day
  const toggleClosed = (day: DayOfWeek) => {
    setHours(prevHours => {
      const newHours = { ...prevHours };
      const dayHours = { ...(newHours[day] || defaultHours) };
      
      dayHours.closed = !dayHours.closed;
      newHours[day] = dayHours;
      
      return newHours;
    });
  };
  
  // Open time picker with proper configuration
  const openTimePicker = (day: DayOfWeek, type: 'open' | 'close') => {
    const dayHours = hours[day] || defaultHours;
    const timeString = dayHours[type];
    
    setTimePickerConfig({
      day,
      type,
      currentTime: timeString
    });
    
    setShowTimePicker(true);
  };
  
  // Handle time selection
  const handleTimeSelected = (hoursStr: string, minutesStr: string) => {
    if (!timePickerConfig) return;
    
    const { day, type } = timePickerConfig;
    const timeString = `${hoursStr}:${minutesStr}`;
    
    setHours(prevHours => {
      const newHours = { ...prevHours };
      const dayHours = { ...(newHours[day] || defaultHours) };
      
      dayHours[type] = timeString;
      newHours[day] = dayHours;
      
      return newHours;
    });
    
    setShowTimePicker(false);
  };
  
  // Copy hours from one day to all days
  const copyToAllDays = (sourceDay: DayOfWeek) => {
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
  
  // Get day label from day key
  const getDayLabel = (day: DayOfWeek): string => {
    const foundDay = daysOfWeek.find(d => d.key === day);
    return foundDay ? foundDay.label : day;
  };
  
  // Save business hours
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
      // Type the callback correctly
      const saveCallback = store.getCallback(callbackId) as ((hours: BusinessHours) => void) | undefined;
      
      if (typeof saveCallback === 'function') {
        saveCallback(hours);
        
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
        "No se pudieron guardar los horarios. Inténtelo nuevamente.",
        [{ text: "OK" }]
      );
    }
  };
  
  // Handle back button press
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
          accessibilityLabel="Volver atrás"
          accessibilityRole="button"
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Horarios de Atención</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          accessibilityLabel="Guardar horarios"
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>Guardar</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollContent}>
        <View style={styles.infoBox}>
          <MaterialIcons name="schedule" size={20} color="#007aff" />
          <Text style={styles.infoText}>
            Configura los horarios de atención de tu negocio. Si está cerrado en algún día específico, activa el interruptor "Cerrado".
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
                    accessibilityLabel={`Hora de apertura: ${dayHours.open}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.timeIconContainer}>
                      <MaterialIcons name="wb-sunny" size={18} color="#007aff" />
                    </View>
                    <Text style={styles.timeLabel}>Abrir:</Text>
                    <Text style={styles.timeValue}>{dayHours.open}</Text>
                    <MaterialIcons name="access-time" size={20} color="#007aff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => openTimePicker(dayKey, 'close')}
                    accessibilityLabel={`Hora de cierre: ${dayHours.close}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.timeIconContainer}>
                      <MaterialIcons name="nights-stay" size={18} color="#007aff" />
                    </View>
                    <Text style={styles.timeLabel}>Cerrar:</Text>
                    <Text style={styles.timeValue}>{dayHours.close}</Text>
                    <MaterialIcons name="access-time" size={20} color="#007aff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.copyButton}
                    onPress={() => copyToAllDays(dayKey)}
                    accessibilityLabel="Copiar este horario a todos los días"
                    accessibilityRole="button"
                  >
                    <MaterialIcons name="content-copy" size={18} color="#007aff" />
                    <Text style={styles.copyButtonText}>Aplicar a todos los días</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      
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

// Define the styles with proper type annotations
interface StylesType {
  container: ViewStyle;
  header: ViewStyle;
  backButton: ViewStyle;
  headerTitle: TextStyle;
  saveButton: ViewStyle;
  saveButtonText: TextStyle;
  scrollContent: ViewStyle;
  infoBox: ViewStyle;
  infoText: TextStyle;
  dayContainer: ViewStyle;
  dayHeader: ViewStyle;
  dayLabel: TextStyle;
  closedContainer: ViewStyle;
  closedLabel: TextStyle;
  hoursContainer: ViewStyle;
  timeButton: ViewStyle;
  timeLabel: TextStyle;
  timeValue: TextStyle;
  copyButton: ViewStyle;
  copyButtonText: TextStyle;
}

// Ampliamos la interfaz para incluir más estilos
interface ExtendedStylesType extends StylesType {
  timeIconContainer: ViewStyle;
}

const styles = StyleSheet.create<ExtendedStylesType>({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF', // Color de fondo más suave
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#007aff', // Color azul para el header
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF', // Texto blanco para mejor contraste
  },
  saveButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,122,255,0.08)', // Color azul suave que coincide con el tema
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#007aff',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#2C3E50', // Color más legible
    lineHeight: 20,
  },
  dayContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff', // Borde azul a la izquierda
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.08)', // Línea divisoria sutil
  },
  dayLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#007aff', // Día en azul para destacar
  },
  closedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  closedLabel: {
    fontSize: 14,
    color: '#5A6877',
    marginRight: 8,
    fontWeight: '500',
  },
  hoursContainer: {
    marginTop: 12,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  timeIconContainer: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  timeLabel: {
    fontSize: 15,
    color: '#5A6877',
    width: 60,
    fontWeight: '500',
  },
  timeValue: {
    flex: 1,
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: 'bold',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,122,255,0.08)',
    borderRadius: 20,
    marginTop: 4,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#007aff',
    marginLeft: 6,
    fontWeight: '500',
  },
});

export default BusinessHoursScreen;
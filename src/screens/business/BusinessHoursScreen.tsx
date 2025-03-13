import React, { useState } from 'react';
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
import { BusinessHours, DayHours } from '../../context/BusinessContext';
import CustomTimePicker from '../../components/CustomTimePicker';
import { useStore } from '../../context/StoreContext';

interface RouteParams {
  initialHours?: BusinessHours;
  callbackId: string;
}

type BusinessHoursRouteProp = RouteProp<{ params: RouteParams }, 'params'>;
type NavigationProp = StackNavigationProp<any>;

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

// Definición de la interfaz para los estilos usando los tipos específicos de React Native
interface BusinessHoursStyles {
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

// Estado para el TimePicker
interface TimePickerConfig {
  day: keyof BusinessHours;
  type: 'open' | 'close';
  currentTime: string;
}

const BusinessHoursScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<BusinessHoursRouteProp>();
  const { initialHours, callbackId } = route.params;
  const store = useStore();

  const [hours, setHours] = useState<BusinessHours>(() => {
    // Inicializar con valores por defecto o los proporcionados
    const defaultBusinessHours: BusinessHours = {};
    
    daysOfWeek.forEach(day => {
      defaultBusinessHours[day.key as keyof BusinessHours] = { ...defaultHours };
    });
    
    return initialHours || defaultBusinessHours;
  });
  
  // Estado para el picker de tiempo personalizado
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerConfig, setTimePickerConfig] = useState<TimePickerConfig | null>(null);
  
  // Cambiar estado de abierto/cerrado para un día
  const toggleClosed = (day: keyof BusinessHours) => {
    setHours(prevHours => {
      const newHours = { ...prevHours };
      const dayHours = { ...(newHours[day] || defaultHours) };
      
      dayHours.closed = !dayHours.closed;
      newHours[day] = dayHours;
      
      return newHours;
    });
  };
  
  // Mostrar selector de hora customizado
  const openTimePicker = (day: keyof BusinessHours, type: 'open' | 'close') => {
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
  };
  
  // Copiar horario a todos los días
  const copyToAllDays = (sourceDay: keyof BusinessHours) => {
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
                  newHours[day.key as keyof BusinessHours] = { ...sourceDayHours };
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
  const getDayLabel = (day: keyof BusinessHours): string => {
    const foundDay = daysOfWeek.find(d => d.key === day);
    return foundDay ? foundDay.label : day;
  };
  
  // Guardar cambios
  const handleSave = () => {
    // Obtener el callback del store usando el ID
    const saveCallback = store.getCallback(callbackId);
    
    if (typeof saveCallback === 'function') {
      saveCallback(hours);
    }
    
    navigation.goBack();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
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
          const dayKey = day.key as keyof BusinessHours;
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

const styles = StyleSheet.create<BusinessHoursStyles>({
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
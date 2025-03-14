import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  ViewStyle,
  TextStyle
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Props interface for the CustomTimePicker component
 */
interface CustomTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onTimeSelected: (hours: string, minutes: string) => void;
  initialHours: string;
  initialMinutes: string;
  title?: string;
}

/**
 * A custom component for selecting time values
 */
const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  visible,
  onClose,
  onTimeSelected,
  initialHours,
  initialMinutes,
  title = 'Seleccionar hora'
}) => {
  // State for the hours and minutes selected
  const [selectedHours, setSelectedHours] = useState(initialHours);
  const [selectedMinutes, setSelectedMinutes] = useState(initialMinutes);

  // Generate available hours (00-23)
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  
  // Generate available minutes (00, 15, 30, 45)
  const minutes = ['00', '15', '30', '45'];

  // Handle the confirmation
  const handleConfirm = () => {
    onTimeSelected(selectedHours, selectedMinutes);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity 
              style={styles.doneButton}
              onPress={handleConfirm}
            >
              <Text style={styles.doneButtonText}>Listo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.timeSelectionContainer}>
            {/* Hours Selector */}
            <View style={styles.columnContainer}>
              <Text style={styles.columnTitle}>Horas</Text>
              <ScrollView 
                style={styles.scrollColumn} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {hours.map(hour => (
                  <TouchableOpacity
                    key={`hour-${hour}`}
                    style={[
                      styles.timeOption,
                      selectedHours === hour && styles.selectedOption
                    ]}
                    onPress={() => setSelectedHours(hour)}
                  >
                    <Text style={[
                      styles.timeText,
                      selectedHours === hour && styles.selectedText
                    ]}>
                      {hour}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.timeSeparator}>:</Text>

            {/* Minutes Selector */}
            <View style={styles.columnContainer}>
              <Text style={styles.columnTitle}>Minutos</Text>
              <ScrollView 
                style={styles.scrollColumn} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {minutes.map(minute => (
                  <TouchableOpacity
                    key={`minute-${minute}`}
                    style={[
                      styles.timeOption,
                      selectedMinutes === minute && styles.selectedOption
                    ]}
                    onPress={() => setSelectedMinutes(minute)}
                  >
                    <Text style={[
                      styles.timeText,
                      selectedMinutes === minute && styles.selectedText
                    ]}>
                      {minute}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.timePreview}>
            <Text style={styles.previewText}>{selectedHours}:{selectedMinutes}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Style type definitions for the CustomTimePicker
 */
interface TimePickerStyles {
  modalOverlay: ViewStyle;
  pickerContainer: ViewStyle;
  pickerHeader: ViewStyle;
  pickerTitle: TextStyle;
  doneButton: ViewStyle;
  doneButtonText: TextStyle;
  timeSelectionContainer: ViewStyle;
  columnContainer: ViewStyle;
  columnTitle: TextStyle;
  scrollColumn: ViewStyle;
  scrollContent: ViewStyle;
  timeOption: ViewStyle;
  selectedOption: ViewStyle;
  timeText: TextStyle;
  selectedText: TextStyle;
  timeSeparator: TextStyle;
  timePreview: ViewStyle;
  previewText: TextStyle;
}

const styles = StyleSheet.create<TimePickerStyles>({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
    minHeight: 400, // Minimum height to ensure sufficient space
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingBottom: 15,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  doneButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  timeSelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 250,
    marginBottom: 20,
  },
  columnContainer: {
    flex: 1,
    alignItems: 'center',
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 10,
  },
  scrollColumn: {
    width: '100%',
    maxHeight: 200,
  },
  scrollContent: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  timeOption: {
    width: '80%',
    backgroundColor: '#F5F7FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginVertical: 5,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#007AFF',
  },
  timeText: {
    fontSize: 18,
    color: '#333333',
    fontWeight: '500',
  },
  selectedText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timeSeparator: {
    fontSize: 30,
    fontWeight: 'bold',
    marginHorizontal: 10,
    color: '#333333',
  },
  timePreview: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 15,
  },
  previewText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  }
});

export default CustomTimePicker;
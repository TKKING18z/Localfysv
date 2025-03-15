import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessHours } from '../context/BusinessContext';

interface BusinessHoursViewProps {
  hours: BusinessHours;
}

const BusinessHoursView: React.FC<BusinessHoursViewProps> = ({ hours }) => {
  // Days of week configuration
  const daysOfWeek = [
    { key: 'monday' as keyof BusinessHours, label: 'Lunes' },
    { key: 'tuesday' as keyof BusinessHours, label: 'Martes' },
    { key: 'wednesday' as keyof BusinessHours, label: 'Miércoles' },
    { key: 'thursday' as keyof BusinessHours, label: 'Jueves' },
    { key: 'friday' as keyof BusinessHours, label: 'Viernes' },
    { key: 'saturday' as keyof BusinessHours, label: 'Sábado' },
    { key: 'sunday' as keyof BusinessHours, label: 'Domingo' },
  ];

  // Check if there are any hours set with proper type checking
  const hasAnyHours = daysOfWeek.some(day => Boolean(hours[day.key]));
  if (!hasAnyHours) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <MaterialIcons name="access-time" size={20} color="#007AFF" />
          <Text style={styles.headerText}>Horarios</Text>
        </View>
        <Text style={styles.noDataText}>Horarios no disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialIcons name="access-time" size={20} color="#007AFF" />
        <Text style={styles.headerText}>Horarios</Text>
      </View>
      
      <View style={styles.hoursContainer}>
        {daysOfWeek.map((day) => {
          const dayHours = hours[day.key];
          
          // If day hours don't exist or day is marked closed
          if (!dayHours || dayHours.closed) {
            return (
              <View key={String(day.key)} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{day.label}:</Text>
                <Text style={styles.closedText}>Cerrado</Text>
              </View>
            );
          }
          
          return (
            <View key={String(day.key)} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{day.label}:</Text>
              <Text style={styles.hoursText}>
                {dayHours.open} - {dayHours.close}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333333',
  },
  hoursContainer: {
    backgroundColor: '#F5F7FF',
    borderRadius: 8,
    padding: 12,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333333',
  },
  hoursText: {
    fontSize: 15,
    color: '#007AFF',
  },
  closedText: {
    fontSize: 15,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  }
});

export default BusinessHoursView;
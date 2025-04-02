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
          <View style={styles.headerIcon}>
            <MaterialIcons name="schedule" size={22} color="#007aff" />
          </View>
          <Text style={styles.headerText}>Horarios de Atención</Text>
        </View>
        <Text style={styles.noDataText}>Horarios no disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="schedule" size={22} color="#007aff" />
        </View>
        <Text style={styles.headerText}>Horarios de Atención</Text>
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
  headerIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
    color: '#007aff',
  },
  hoursContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.08)',
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
  },
  hoursText: {
    fontSize: 15,
    color: '#007aff',
    fontWeight: '500',
    backgroundColor: 'rgba(0,122,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  closedText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    fontStyle: 'italic',
    backgroundColor: 'rgba(142,142,147,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    padding: 12,
    backgroundColor: 'rgba(142,142,147,0.05)',
    borderRadius: 8,
    textAlign: 'center',
  }
});

export default BusinessHoursView;
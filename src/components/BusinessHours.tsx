import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessHours as BusinessHoursType } from '../context/BusinessContext';

interface BusinessHoursProps {
  hours: BusinessHoursType;
  compact?: boolean;
}

const daysMap: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo'
};

const BusinessHours: React.FC<BusinessHoursProps> = ({ hours, compact = false }) => {
  const [expanded, setExpanded] = useState(!compact);
  
  if (!hours || Object.keys(hours).length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>Horario no disponible</Text>
      </View>
    );
  }
  
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
  const todayKey = Object.keys(daysMap).find(key => 
    daysMap[key].toLowerCase() === today
  ) as keyof BusinessHoursType;
  
  const todayHours = hours[todayKey];
  
  const formatHours = (hourString: string) => {
    return hourString;
  };
  
  const renderTodayHours = () => {
    if (!todayHours) return <Text style={styles.hourText}>No disponible</Text>;
    if (todayHours.closed) return <Text style={styles.closedText}>Cerrado hoy</Text>;
    return (
      <Text style={styles.hourText}>
        Hoy: {formatHours(todayHours.open)} - {formatHours(todayHours.close)}
      </Text>
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialIcons name="access-time" size={20} color="#007AFF" />
        <Text style={styles.headerText}>Horario</Text>
        
        {compact && (
          <TouchableOpacity 
            style={styles.expandButton}
            onPress={() => setExpanded(!expanded)}
          >
            <MaterialIcons 
              name={expanded ? "expand-less" : "expand-more"} 
              size={24} 
              color="#007AFF" 
            />
          </TouchableOpacity>
        )}
      </View>
      
      {compact && !expanded ? (
        renderTodayHours()
      ) : (
        <View style={styles.hoursContainer}>
          {Object.entries(daysMap).map(([key, day]) => {
            const dayHours = hours[key as keyof BusinessHoursType];
            if (!dayHours) return null;
            
            return (
              <View key={key} style={styles.dayRow}>
                <Text style={[
                  styles.dayText,
                  key === todayKey ? styles.todayText : {}
                ]}>
                  {day}:
                </Text>
                
                {dayHours.closed ? (
                  <Text style={styles.closedText}>Cerrado</Text>
                ) : (
                  <Text style={styles.hourText}>
                    {formatHours(dayHours.open)} - {formatHours(dayHours.close)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
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
  expandButton: {
    marginLeft: 'auto',
  },
  hoursContainer: {
    backgroundColor: '#F5F7FF',
    borderRadius: 8,
    padding: 12,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dayText: {
    fontSize: 14,
    color: '#666666',
    width: 80,
  },
  todayText: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  hourText: {
    fontSize: 14,
    color: '#333333',
  },
  closedText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  }
});

export default BusinessHours;
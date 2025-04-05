import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Animated,
  Easing 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from '../../context/BusinessContext';
import { BusinessAnalyticsData } from '../../types/analyticsTypes';

interface PerformanceIndicatorProps {
  business: Business;
  analytics?: BusinessAnalyticsData;
  onPress: () => void;
}

const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  business,
  analytics,
  onPress
}) => {
  // Animación para la barra de progreso
  const progressAnimation = useState(new Animated.Value(0))[0];
  
  // Valores por defecto si no hay datos analíticos
  const visits = analytics?.visits || 0;
  const maxVisits = analytics?.maxVisits || 100; // Valor para comparación
  const progress = Math.min(visits / maxVisits, 1); // Asegurar que no exceda 1
  
  // Efecto para animar la barra de progreso
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad)
    }).start();
  }, [progress, progressAnimation]);
  
  // Determinar el color de la barra basado en el progreso
  const getProgressColor = () => {
    if (progress < 0.3) return '#FF3B30';
    if (progress < 0.7) return '#FFCC00';
    return '#34C759';
  };
  
  // Formatear el número de visitas para mejor visualización
  const formatVisits = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };
  
  // Obtener la calificación formateada
  const getRating = () => {
    if (!analytics?.rating) return '-';
    return analytics.rating.toFixed(1);
  };
  
  // Determinar si el indicador es interactivo
  const isInteractive = typeof onPress === 'function';

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        isInteractive && styles.interactiveContainer
      ]} 
      onPress={onPress}
      activeOpacity={isInteractive ? 0.7 : 1}
      disabled={!isInteractive}
    >
      {/* Updated placeholder instead of photo */}
      <View style={styles.imageContainer}>
        <MaterialIcons name="store" size={32} color="#007AFF" />
      </View>
      
      {/* Información del negocio */}
      <View style={styles.infoContainer}>
        <Text style={styles.businessName} numberOfLines={1}>{business.name}</Text>
        
        {/* Subtítulo con categoría */}
        <Text style={styles.categoryText} numberOfLines={1}>{business.category}</Text>
        
        {/* Barra de progreso */}
        <View style={styles.progressBarContainer}>
          <Animated.View 
            style={[
              styles.progressBar, 
              { 
                width: progressAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                }),
                backgroundColor: getProgressColor()
              }
            ]} 
          />
        </View>
        
        {/* Métricas */}
        <View style={styles.metricsContainer}>
          <View style={styles.metric}>
            <MaterialIcons name="visibility" size={14} color="#8E8E93" />
            <Text style={styles.metricValue}>{formatVisits(visits)}</Text>
          </View>
          
          <View style={styles.metric}>
            <MaterialIcons name="star" size={14} color="#FFCC00" />
            <Text style={styles.metricValue}>{getRating()}</Text>
          </View>
          
          <View style={styles.metric}>
            <MaterialIcons name="event-available" size={14} color="#007AFF" />
            <Text style={styles.metricValue}>{analytics?.reservations || 0}</Text>
          </View>
        </View>
      </View>
      
      <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
    </TouchableOpacity>
  );
};

// Función para generar un color basado en la primera letra
const getLetterColor = (name: string) => {
  const colors = [
    '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6', 
    '#FF2D55', '#AF52DE', '#5AC8FA', '#FFCC00', '#4CD964'
  ];
  
  const charCode = name.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  interactiveContainer: {
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  imageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    marginRight: 8,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  categoryText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: '85%',
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metricValue: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default PerformanceIndicator;
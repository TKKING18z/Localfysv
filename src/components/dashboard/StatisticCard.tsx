import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Usar el tipo correcto para los nombres de iconos
interface StatisticCardProps {
  icon: React.ComponentProps<typeof MaterialIcons>['name']; // Tipo correcto para nombre de ícono
  title: string;
  value: string | number;
  trend?: number;
  isCurrency?: boolean;
  showTrend?: boolean;
  iconColor?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  onPress?: () => void;
}

/**
 * Componente para mostrar una estadística simple con ícono, título, valor y tendencia.
 */
const StatisticCard: React.FC<StatisticCardProps> = ({
  icon,
  title,
  value,
  trend = 0,
  isCurrency = false,
  showTrend = true,
  iconColor = "#007AFF",
  valuePrefix = "",
  valueSuffix = "",
  onPress
}) => {
  // Determina el color y el ícono para la tendencia
  const trendColor = trend > 0 ? '#34C759' : trend < 0 ? '#FF3B30' : '#8E8E93';
  const trendIcon = trend > 0 ? 'arrow-upward' : trend < 0 ? 'arrow-downward' : 'remove';
  
  // Formatea el valor si es moneda
  let formattedValue = value;
  
  if (isCurrency) {
    if (typeof value === 'number') {
      formattedValue = value.toLocaleString('es-ES', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } else {
      // Si es string y no comienza con $, añadir el símbolo
      formattedValue = value.toString().startsWith('$') ? value : `$${value}`;
    }
  } else if (typeof value === 'number') {
    // Formatear números para legibilidad
    formattedValue = value.toLocaleString();
  }

  // Componente base para el contenido de la tarjeta
  const CardContent = () => (
    <>
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
        <MaterialIcons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.value}>
        {valuePrefix}{formattedValue}{valueSuffix}
      </Text>
      {showTrend && (
        <View style={styles.trendContainer}>
          <MaterialIcons name={trendIcon} size={14} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>
            {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </>
  );

  // Si hay onPress, envolver con TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity 
        style={styles.container} 
        onPress={onPress}
        activeOpacity={0.8}
      >
        <CardContent />
      </TouchableOpacity>
    );
  }

  // Versión sin interacción
  return (
    <View style={styles.container}>
      <CardContent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    width: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
    textAlign: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
    textAlign: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  trendText: {
    fontSize: 12,
    marginLeft: 2,
    fontWeight: '500',
  },
});

export default StatisticCard;
import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  Platform
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { DataPoint, TimePeriod } from '../../types/analyticsTypes';
import { MaterialIcons } from '@expo/vector-icons';

interface TrendsChartProps {
  data: DataPoint[];
  period: TimePeriod;
  title?: string;
  color?: string;
  showControls?: boolean;
  height?: number;
  isLoading?: boolean;
  onPeriodChange?: (period: TimePeriod) => void;
  yAxisSuffix?: string;
}

const TrendsChart: React.FC<TrendsChartProps> = ({ 
  data, 
  period, 
  title = 'Tendencias de Visitas', 
  color = '#007AFF',
  showControls = true,
  height = 220,
  isLoading = false,
  onPeriodChange,
  yAxisSuffix = ''
}) => {
  const screenWidth = Dimensions.get('window').width;
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(period);
  const [chartWidth, setChartWidth] = useState(screenWidth - 64);
  const [showFullChart, setShowFullChart] = useState(false);

  // Actualizar período local cuando cambia desde props
  useEffect(() => {
    setSelectedPeriod(period);
  }, [period]);

  // Manejar cambio de período
  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setSelectedPeriod(newPeriod);
    if (onPeriodChange) {
      onPeriodChange(newPeriod);
    }
  };

  // Verificar si hay datos válidos
  const hasValidData = useMemo(() => {
    if (!data || data.length === 0) return false;
    // Verificar si hay al menos un punto con valor mayor que 0
    return data.some(point => point.value > 0);
  }, [data]);

  // Función para formatear etiquetas según el tipo de período
  // Es importante definir esta función ANTES de usarla en cualquier useMemo
  const formatLabel = (label: string) => {
    if (!label) return '';
    
    switch(selectedPeriod) {
      case TimePeriod.DAY:
        // Formato simplificado para horas: "9h" en lugar de "09:00"
        if (label.includes(':')) {
          return label.split(':')[0] + 'h';
        } else if (label.endsWith('h')) {
          return label;
        } else {
          // Eliminar ceros iniciales para las horas
          return label.replace(/^0+/, '') + 'h';
        }
      case TimePeriod.WEEK:
        // Abreviaturas de días: "Lu", "Ma", "Mi", etc.
        return label.substring(0, 2);
      case TimePeriod.MONTH:
        // Solo los días numéricos sin ceros iniciales
        return label.replace(/^0+/, '').trim().substring(0, 2);
      case TimePeriod.YEAR:
        // Abreviaturas de meses de 3 letras: "Ene", "Feb", etc.
        return label.substring(0, 3);
      default:
        return label;
    }
  };

  // Optimizar datos para visualización según el período
  const optimizedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    let optimized = [...data];
    
    // Para períodos más largos, reducir la cantidad de puntos mostrados
    if (selectedPeriod === TimePeriod.DAY && data.length > 12) {
      // Para la vista de día, mostrar cada 2 horas
      optimized = data.filter((_, index) => index % 2 === 0);
    } else if (selectedPeriod === TimePeriod.WEEK && data.length > 7) {
      // Para la vista de semana, asegurar que mostramos solo puntos clave
      optimized = data.slice(0); // Clonar array
    } else if (selectedPeriod === TimePeriod.MONTH && data.length > 15) {
      // Para la vista de mes, mostrar cada 3 días
      optimized = data.filter((_, index) => index % 3 === 0);
    } else if (selectedPeriod === TimePeriod.YEAR && data.length > 6) {
      // Para la vista de año, mostrar bimestralmente
      optimized = data.filter((_, index) => index % 2 === 0);
    }
    
    return optimized;
  }, [data, selectedPeriod]);

  // Obtener etiquetas optimizadas para el eje X
  const optimizedLabels = useMemo(() => {
    // Si no hay datos optimizados, devolver un array vacío
    if (!optimizedData || optimizedData.length === 0) return [];
    
    // Número máximo de etiquetas según ancho de pantalla
    const maxLabels = Math.floor(chartWidth / 50); // Aproximadamente 50px por etiqueta
    
    // Calcular cuántas etiquetas mostrar
    const interval = Math.ceil(optimizedData.length / maxLabels);
    
    return optimizedData.map((point, index) => {
      if (index % interval === 0) {
        return formatLabel(point.label);
      }
      return ''; // Etiqueta vacía para puntos intermedios
    });
  }, [optimizedData, chartWidth, formatLabel, selectedPeriod]);

  // Calcular valores para el eje Y de los datos optimizados
  const yValues = useMemo(() => {
    if (!optimizedData || optimizedData.length === 0) return [0];
    return optimizedData.map(point => Math.max(0, point.value || 0)); // Asegurar valores no negativos
  }, [optimizedData]);

  // Generar datos del gráfico
  const chartData = useMemo(() => ({
    labels: optimizedLabels,
    datasets: [{
      data: hasValidData ? yValues : [0, 0, 1], // Datos de respaldo si no hay datos válidos
      color: (opacity = 1) => `rgba(${hexToRgb(color)}, ${opacity})`,
      strokeWidth: 2
    }],
    legend: [title]
  }), [optimizedLabels, yValues, color, title, hasValidData]);

  // Convertir color hexadecimal a RGB
  function hexToRgb(hex: string): string {
    // Remover el # si existe
    hex = hex.replace('#', '');
    
    // Si es formato corto (3 dígitos), expandirlo
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Convertir a RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r}, ${g}, ${b}`;
  }

  // Configuración del gráfico
  const chartConfig = useMemo(() => ({
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${hexToRgb(color)}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(142, 142, 147, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: color
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#E0E0E0'
    },
    formatYLabel: (value: string) => `${value}${yAxisSuffix}`,
    propsForLabels: {
      fontSize: 10,
      fontWeight: '500',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto'
    },
    // Incrementar el espacio para etiquetas
    horizontalLabelRotation: 0,
    xLabelsOffset: 0,
    // Corregido: formatTopBarValue ahora espera un número como parámetro en lugar de string
    formatTopBarValue: (value: number) => `${value}${yAxisSuffix}`
  }), [color, yAxisSuffix]);

  // Si está cargando, mostrar indicador
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.noDataContainer}>
          <ActivityIndicator size="large" color={color} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </View>
    );
  }

  // Si no hay datos válidos, mostrar un mensaje
  if (!hasValidData) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.noDataContainer}>
          <MaterialIcons name="analytics" size={32} color="#C7C7CC" />
          <Text style={styles.noDataText}>No hay datos suficientes para mostrar el gráfico.</Text>
        </View>
      </View>
    );
  }

  // Determinar el ancho del gráfico según el período y si está expandido
  const getChartWidth = () => {
    if (showFullChart) {
      return Math.max(chartWidth * 1.5, optimizedData.length * 40);
    }
    
    // Ajustar ancho según el período
    switch(selectedPeriod) {
      case TimePeriod.DAY:
        return chartWidth;
      case TimePeriod.WEEK:
        return chartWidth;
      case TimePeriod.MONTH:
        return chartWidth;
      case TimePeriod.YEAR:
        return chartWidth;
      default:
        return chartWidth;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        
        {/* Toggle para expandir/contraer gráfico */}
        <TouchableOpacity 
          onPress={() => setShowFullChart(!showFullChart)}
          style={styles.expandButton}
        >
          <MaterialIcons 
            name={showFullChart ? "fullscreen-exit" : "fullscreen"} 
            size={20} 
            color="#007AFF" 
          />
        </TouchableOpacity>
      </View>
      
      {/* Controles de período */}
      {showControls && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.periodControlsContainer}
        >
          <TouchableOpacity 
            style={[
              styles.periodButton, 
              selectedPeriod === TimePeriod.DAY && styles.activePeriodButton
            ]}
            onPress={() => handlePeriodChange(TimePeriod.DAY)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === TimePeriod.DAY && styles.activePeriodButtonText
            ]}>Día</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.periodButton, 
              selectedPeriod === TimePeriod.WEEK && styles.activePeriodButton
            ]}
            onPress={() => handlePeriodChange(TimePeriod.WEEK)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === TimePeriod.WEEK && styles.activePeriodButtonText
            ]}>Semana</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.periodButton, 
              selectedPeriod === TimePeriod.MONTH && styles.activePeriodButton
            ]}
            onPress={() => handlePeriodChange(TimePeriod.MONTH)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === TimePeriod.MONTH && styles.activePeriodButtonText
            ]}>Mes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.periodButton, 
              selectedPeriod === TimePeriod.YEAR && styles.activePeriodButton
            ]}
            onPress={() => handlePeriodChange(TimePeriod.YEAR)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === TimePeriod.YEAR && styles.activePeriodButtonText
            ]}>Año</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      
      <View style={styles.chartContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          <LineChart
            data={chartData}
            width={getChartWidth()}
            height={height}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withDots={optimizedData.length <= 15} // Mostrar puntos solo si hay pocos datos
            withShadow
            withInnerLines
            withOuterLines
            withVerticalLines={optimizedData.length <= 20} // Líneas verticales solo si hay pocos datos
            withHorizontalLines
            fromZero
            yAxisSuffix={yAxisSuffix}
            segments={5}
            // Configuración para prevenir sobresaturación
            withHorizontalLabels={true}
            horizontalLabelRotation={0}
            verticalLabelRotation={0}
          />
        </ScrollView>
      </View>
      
      {/* Leyenda para distinguir comportamientos */}
      {optimizedData.length > 0 && (
        <View style={styles.chartLegend}>
          <Text style={styles.legendText}>
            {selectedPeriod === TimePeriod.DAY 
              ? 'Visitas por hora del día' 
              : selectedPeriod === TimePeriod.WEEK 
                ? 'Visitas por día de la semana' 
                : selectedPeriod === TimePeriod.MONTH 
                  ? 'Visitas por día del mes' 
                  : 'Visitas por mes del año'
            }
          </Text>
          {showFullChart && (
            <Text style={styles.hintText}>Desliza para ver más datos</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    borderRadius: 16,
    backgroundColor: 'white',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  expandButton: {
    padding: 8,
  },
  periodControlsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F0F0F5',
    marginRight: 8,
  },
  activePeriodButton: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  activePeriodButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  chartContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  scrollContainer: {
    alignItems: 'center',
    paddingBottom: 10, // Dar más espacio para las etiquetas inferiores
  },
  chart: {
    borderRadius: 12,
    paddingRight: 0,
    paddingLeft: 0,
    paddingTop: 8,
    paddingBottom: 8,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F5F7FF',
    padding: 16,
  },
  noDataText: {
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
  },
  loadingText: {
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
  },
  chartLegend: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  hintText: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
  }
});

export default TrendsChart;
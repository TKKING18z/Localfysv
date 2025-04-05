import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView 
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
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(period);
  const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 64);
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

  // Formatear las etiquetas según el tipo de período
  const formatLabels = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map(point => {
      switch(selectedPeriod) {
        case TimePeriod.DAY:
          return point.label.substring(0, 2); // HH
        case TimePeriod.WEEK:
          return point.label.substring(0, 3); // Day abbreviation
        case TimePeriod.MONTH:
          return point.label.substring(0, 2); // Day number
        case TimePeriod.YEAR:
          return point.label.substring(0, 3); // Month abbreviation
        default:
          return point.label;
      }
    });
  }, [data, selectedPeriod]);

  // Calcular valores para el eje Y
  const yValues = useMemo(() => {
    if (!data || data.length === 0) return [0];
    return data.map(point => point.value);
  }, [data]);

  // Generar datos del gráfico
  const chartData = useMemo(() => ({
    labels: formatLabels,
    datasets: [{
      data: yValues.length > 0 ? yValues : [0],
      color: (opacity = 1) => `rgba(${hexToRgb(color)}, ${opacity})`,
      strokeWidth: 2
    }],
    legend: [title]
  }), [formatLabels, yValues, color, title]);

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
  }), [color, yAxisSuffix]);

  // Convertir color hexadecimal a RGB
  function hexToRgb(hex: string): string {
    // Remover el # si existe
    hex = hex.replace('#', '');
    
    // Convertir a RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r}, ${g}, ${b}`;
  }

  // Si no hay datos, mostrar un mensaje
  if (!data || data.length === 0) {
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
          contentContainerStyle={[
            styles.scrollContainer,
            { width: showFullChart ? Math.max(chartWidth * 1.5, data.length * 30) : 'auto' }
          ]}
        >
          <LineChart
            data={chartData}
            width={showFullChart ? Math.max(chartWidth * 1.5, data.length * 30) : chartWidth}
            height={height}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withDots={true}
            withShadow
            withInnerLines
            withOuterLines
            withVerticalLines
            withHorizontalLines
            fromZero
            yAxisSuffix={yAxisSuffix}
            segments={5}
          />
        </ScrollView>
      </View>
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
    paddingVertical: 6,
    paddingHorizontal: 12,
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
  },
  scrollContainer: {
    alignItems: 'center',
  },
  chart: {
    borderRadius: 12,
    paddingRight: 16,
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
});

export default TrendsChart;
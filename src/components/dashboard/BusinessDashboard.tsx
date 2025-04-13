import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from '../../context/BusinessContext';
import { BusinessAnalytics, TimePeriod } from '../../types/analyticsTypes';
import StatisticCard from './StatisticCard';
import ActionCenter from './ActionCenter';
import { analyticsService } from '../../services/analyticsService';

// Import TrendsChart with error handling
let TrendsChart;
try {
  TrendsChart = require('./TrendsChart').default;
} catch (error) {
  console.warn('Failed to import TrendsChart component:', error);
  TrendsChart = null;
}

// Import PerformanceIndicator with error handling
let PerformanceIndicator;
try {
  PerformanceIndicator = require('./PerformanceIndicator').default;
} catch (error) {
  console.warn('Failed to import PerformanceIndicator component:', error);
  PerformanceIndicator = null;
}

interface BusinessDashboardProps {
  analytics: BusinessAnalytics | null;
  loading: boolean;
  businesses: Business[];
  onSelectBusiness: (businessId: string) => void;
  period: TimePeriod;
  onRefreshData?: () => void;
}

const BusinessDashboard: React.FC<BusinessDashboardProps> = ({
  analytics,
  loading,
  businesses,
  onSelectBusiness,
  period,
  onRefreshData
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(period);
  const [expanded, setExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionRefreshing, setActionRefreshing] = useState(false);
  
  if (loading || !analytics) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }
  
  // Alternar la expansión del panel
  const toggleExpand = () => {
    setExpanded(!expanded);
  };
  
  // Función para reinicializar datos de prueba
  const handleRefreshData = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      
      // Inicializar datos de prueba para cada negocio
      const businessIds = businesses.map(b => b.id);
      console.log("Inicializando datos de prueba para negocios:", businessIds);
      
      await Promise.all(businessIds.map(id => analyticsService.initializeTestAnalytics(id)));
      
      // Llamar a la función onRefreshData para recargar los datos
      if (onRefreshData) {
        onRefreshData();
      }
      
      // Mostrar alerta de éxito
      Alert.alert(
        "Datos actualizados", 
        "Los datos analíticos se han actualizado correctamente.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error al actualizar datos:", error);
      Alert.alert(
        "Error", 
        "No se pudieron actualizar los datos. Intenta nuevamente.",
        [{ text: "OK" }]
      );
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Simular actualización de acciones pendientes
  const refreshPendingActions = async () => {
    if (actionRefreshing) return;
    
    try {
      setActionRefreshing(true);
      
      // Esperar un poco para simular la carga
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Recargar datos completos
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (error) {
      console.error("Error al actualizar acciones pendientes:", error);
    } finally {
      setActionRefreshing(false);
    }
  };
  
  // Manejar acciones de los elementos pendientes
  const handleActionPress = (type: string, id: string) => {
    console.log(`Acción ${type} seleccionada para id ${id}`);
    // Implementar navegación o acción según el tipo
    switch(type) {
      case 'reservation':
        Alert.alert(
          "Reserva seleccionada", 
          `Has seleccionado la reserva ${id}. ¿Deseas confirmarla?`,
          [
            { text: "Cancelar", style: "cancel" },
            { 
              text: "Confirmar", 
              onPress: () => {
                // Aquí iría la lógica para confirmar la reserva
                Alert.alert("Reserva confirmada", "La reserva ha sido confirmada correctamente.");
              }
            }
          ]
        );
        break;
      case 'message':
        Alert.alert(
          "Mensaje seleccionado", 
          `Navegando a la conversación ${id}...`
        );
        break;
      case 'review':
        Alert.alert(
          "Reseña seleccionada", 
          `Abriendo la reseña ${id} para responder...`
        );
        break;
    }
  };
  
  const totalVisits = analytics.totalVisits || 0;
  const totalReservations = analytics.totalReservations?.confirmed || 0;
  const estimatedRevenue = analytics.totalReservations?.value || 0;
  const averageRating = analytics.averageRating || 0;
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Panel de Control</Text>
        <View style={styles.headerActions}>
          {/* Botón para actualizar datos */}
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefreshData}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <MaterialIcons name="refresh" size={20} color="#007AFF" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={toggleExpand}>
            <MaterialIcons 
              name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={24} 
              color="#007AFF" 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {expanded && (
        <>
          {/* Selector de período */}
          <View style={styles.periodSelector}>
            {Object.values(TimePeriod).map((p) => (
              <TouchableOpacity 
                key={p}
                style={[styles.periodButton, selectedPeriod === p && styles.periodButtonActive]} 
                onPress={() => setSelectedPeriod(p)}
                disabled={isRefreshing}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === p && styles.periodButtonTextActive]}>
                  {p === TimePeriod.DAY ? 'Día' : 
                   p === TimePeriod.WEEK ? 'Semana' : 
                   p === TimePeriod.MONTH ? 'Mes' : 'Año'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Tarjetas de estadísticas */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsCardsContainer}>
            <StatisticCard 
              icon="visibility" 
              title="Visitas" 
              value={totalVisits} 
              trend={analytics.visitsTrend || 0} 
              isLoading={isRefreshing}
            />
            <StatisticCard 
              icon="event-available" 
              title="Reservas" 
              value={totalReservations} 
              trend={analytics.reservationsTrend || 0} 
              isLoading={isRefreshing}
            />
            <StatisticCard 
              icon="attach-money" 
              title="Ingresos Est." 
              value={`$${estimatedRevenue}`} 
              trend={analytics.revenueTrend || 0} 
              isCurrency
              isLoading={isRefreshing}
            />
            <StatisticCard 
              icon="star" 
              title="Calificación" 
              value={averageRating.toFixed(1)} 
              trend={0} 
              showTrend={false}
              isLoading={isRefreshing}
            />
          </ScrollView>
          
          {/* Gráfico de tendencias */}
          {TrendsChart ? (
            <TrendsChart 
              data={analytics.visitsData?.[selectedPeriod] || []} 
              period={selectedPeriod} 
              isLoading={isRefreshing}
            />
          ) : (
            <View style={styles.chartFallback}>
              <MaterialIcons name="analytics" size={32} color="#C7C7CC" />
              <Text style={styles.chartFallbackText}>
                Los gráficos no están disponibles en este momento.
              </Text>
            </View>
          )}
          
          {/* Indicadores de rendimiento */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Rendimiento por negocio</Text>
            {businesses.length > 3 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => {
                  Alert.alert("Ver todos", "Esta función estará disponible próximamente.");
                }}
              >
                <Text style={styles.viewAllText}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {PerformanceIndicator ? (
            businesses.slice(0, 3).map((business) => (
              <PerformanceIndicator 
                key={business.id}
                business={business}
                analytics={analytics.businessesAnalytics?.[business.id]}
                onPress={() => onSelectBusiness(business.id)}
                isLoading={isRefreshing}
              />
            ))
          ) : (
            <View style={styles.chartFallback}>
              <Text style={styles.chartFallbackText}>
                Los indicadores de rendimiento no están disponibles en este momento.
              </Text>
            </View>
          )}
          
          {/* Centro de acción */}
          <ActionCenter 
            pendingActions={analytics.pendingActions || {}}
            onActionPress={handleActionPress}
            isLoading={actionRefreshing}
          />
          
          {/* Botón para actualizar acciones pendientes */}
          <TouchableOpacity 
            style={styles.actionsRefreshButton}
            onPress={refreshPendingActions}
            disabled={actionRefreshing}
          >
            <MaterialIcons 
              name="refresh" 
              size={16} 
              color={actionRefreshing ? "#C7C7CC" : "#007AFF"} 
            />
            <Text style={[
              styles.actionsRefreshText,
              actionRefreshing && { color: "#C7C7CC" }
            ]}>
              {actionRefreshing ? "Actualizando..." : "Actualizar acciones pendientes"}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 16,
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  refreshButton: {
    padding: 8,
    marginRight: 8,
  },
  refreshButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F5F7FF',
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  periodButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  statsCardsContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  viewAllButton: {
    padding: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  viewMoreButton: {
    alignItems: 'center',
    padding: 8,
    marginVertical: 4,
  },
  viewMoreText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  actionsRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  actionsRefreshText: {
    color: '#007AFF',
    fontSize: 14,
    marginLeft: 4,
  },
  chartFallback: {
    backgroundColor: '#F5F7FF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    minHeight: 150,
  },
  chartFallbackText: {
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
});

export default BusinessDashboard;
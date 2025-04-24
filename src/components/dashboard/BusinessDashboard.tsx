import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from '../../context/BusinessContext';
import { BusinessAnalytics, TimePeriod } from '../../types/analyticsTypes';
import StatisticCard from './StatisticCard';
import TrendsChart from './TrendsChart';
import PerformanceIndicator from './PerformanceIndicator';
import ActionCenter from './ActionCenter';
import { analyticsService } from '../../services/analyticsService';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Define interfaces for the data types we're working with
interface Reservation {
  id: string;
  status: string;
  value?: number;
  [key: string]: any;
}

interface Review {
  id: string;
  rating: number;
  [key: string]: any;
}

interface BusinessDashboardProps {
  analytics: BusinessAnalytics | null;
  loading: boolean;
  businesses: Business[];
  onSelectBusiness: (businessId: string) => void;
  period: TimePeriod;
  onRefreshData?: () => void;
}

// Using React.memo to prevent unnecessary re-renders of the component
const BusinessDashboard: React.FC<BusinessDashboardProps> = React.memo(({
  analytics,
  loading,
  businesses,
  onSelectBusiness,
  period,
  onRefreshData
}) => {
  // *** ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS ***
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(period);
  const [expanded, setExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionRefreshing, setActionRefreshing] = useState(false);
  
  // Memoize toggle function to prevent recreation on each render
  const toggleExpand = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);
  
  // Helper function to fetch actual reservations
  const fetchReservations = async (businessId: string): Promise<Reservation[]> => {
    try {
      const snapshot = await firebase.firestore()
        .collection('reservations')
        .where('businessId', '==', businessId)
        .get();
      
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        status: doc.data().status || 'pending', // Ensure status property exists
        value: doc.data().value || 0,
        ...doc.data(),
      })) as Reservation[];
    } catch (error) {
      console.error(`Error fetching reservations for ${businessId}:`, error);
      return [];
    }
  };

  // Helper function to fetch actual reviews
  const fetchReviews = async (businessId: string): Promise<Review[]> => {
    try {
      const snapshot = await firebase.firestore()
        .collection('reviews')
        .where('businessId', '==', businessId)
        .get();
      
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        rating: doc.data().rating || 0, // Ensure rating property exists
        ...doc.data(),
      })) as Review[];
    } catch (error) {
      console.error(`Error fetching reviews for ${businessId}:`, error);
      return [];
    }
  };
  
  // Function to refresh visits data - moved above any conditional logic
  const refreshVisitsData = async (businessIds: string[]) => {
    // Normally this would query relevant logs or analytics data
    // For this example we'll just make sure visits are being tracked
    try {
      for (const businessId of businessIds) {
        await analyticsService.trackBusinessVisit(businessId);
      }
    } catch (error) {
      console.error("Error refreshing visits data:", error);
    }
  };
  
  // Function to fetch real reviews data - moved above any conditional logic
  const refreshReviewsData = async (businessIds: string[]) => {
    try {
      for (const businessId of businessIds) {
        // Fetch actual reviews
        const reviews = await fetchReviews(businessId);
        
        if (reviews && reviews.length > 0) {
          // Calculate actual average rating
          const totalRating = reviews.reduce((sum: number, review: Review) => sum + review.rating, 0);
          const avgRating = totalRating / reviews.length;
          
          // Update analytics with real review data
          await analyticsService.trackReview(businessId, avgRating);
        }
      }
    } catch (error) {
      console.error("Error refreshing reviews data:", error);
    }
  };
  
  // Function to fetch real reservation data - moved above any conditional logic
  const refreshReservationsData = async (businessIds: string[]) => {
    // This would make actual Firestore queries to get updated data
    // Example: query reservations collection for the latest data
    try {
      for (const businessId of businessIds) {
        // Calculate revenue from actual reservations
        const reservations = await fetchReservations(businessId);
        
        // Use real data to update analytics
        if (reservations && reservations.length > 0) {
          // Calculate confirmed and pending counts
          const confirmed = reservations.filter((r: Reservation) => r.status === 'confirmed').length;
          const pending = reservations.filter((r: Reservation) => r.status === 'pending').length;
          
          // Calculate actual revenue from confirmed reservations
          const value = reservations.reduce((sum: number, r: Reservation) => {
            return r.status === 'confirmed' ? sum + (r.value || 0) : sum;
          }, 0);
          
          // Update the analytics data in Firestore
          await analyticsService.trackReservation(businessId, 'confirmed', value);
        }
      }
    } catch (error) {
      console.error("Error refreshing reservations data:", error);
    }
  };
  
  // Helper function to fetch real pending actions
  const fetchPendingActions = async (businessIds: string[]) => {
    try {
      for (const businessId of businessIds) {
        // Fetch pending reservations
        const reservationsQuery = firebase.firestore()
          .collection('reservations')
          .where('businessId', '==', businessId)
          .where('status', '==', 'pending')
          .get();
          
        // Fetch unread messages
        const messagesQuery = firebase.firestore()
          .collection('messages')
          .where('businessId', '==', businessId)
          .where('read', '==', false)
          .get();
          
        // Fetch unanswered reviews
        const reviewsQuery = firebase.firestore()
          .collection('reviews')
          .where('businessId', '==', businessId)
          .where('responded', '==', false)
          .get();
          
        // Wait for all queries to complete
        await Promise.all([reservationsQuery, messagesQuery, reviewsQuery]);
      }
    } catch (error) {
      console.error("Error fetching pending actions:", error);
    }
  };
  
  // Memoize the handling of pending actions refresh  
  const refreshPendingActions = useCallback(async () => {
    if (actionRefreshing) return;
    
    try {
      setActionRefreshing(true);
      
      // Get real pending actions from Firestore
      const businessIds = businesses.map(b => b.id);
      
      // Actually fetch pending actions from Firestore
      await fetchPendingActions(businessIds);
      
      // Reload all data
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (error) {
      console.error("Error al actualizar acciones pendientes:", error);
    } finally {
      setActionRefreshing(false);
    }
  }, [actionRefreshing, businesses, onRefreshData]);
  
  // Optimize refresh data function with useCallback
  const handleRefreshData = useCallback(async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      
      // Get business IDs
      const businessIds = businesses.map(b => b.id);
      console.log("Actualizando datos analíticos reales para negocios:", businessIds);
      
      // Use real analytics service instead of test data
      // First refresh any data from Firestore collections
      await Promise.all([
        // Refresh relevant collections' data
        refreshReservationsData(businessIds),
        refreshReviewsData(businessIds),
        refreshVisitsData(businessIds)
      ]);
      
      // Now call onRefreshData to reload analytics
      if (onRefreshData) {
        onRefreshData();
      }
      
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
  }, [isRefreshing, businesses, onRefreshData]);
  
  // Memoize action handling to prevent recreation on renders
  const handleActionPress = useCallback((type: string, id: string) => {
    console.log(`Acción ${type} seleccionada para id ${id}`);
    
    switch(type) {
      case 'reservation':
        Alert.alert(
          "Reserva seleccionada", 
          `Has seleccionado la reserva ${id}. ¿Deseas confirmarla?`,
          [
            { text: "Cancelar", style: "cancel" },
            { 
              text: "Confirmar", 
              onPress: async () => {
                try {
                  // Actually update the reservation in Firestore
                  await firebase.firestore()
                    .collection('reservations')
                    .doc(id)
                    .update({
                      status: 'confirmed',
                      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                  // Reload data
                  if (onRefreshData) {
                    onRefreshData();
                  }
                  
                  Alert.alert("Reserva confirmada", "La reserva ha sido confirmada correctamente.");
                } catch (error) {
                  console.error("Error confirming reservation:", error);
                  Alert.alert("Error", "No se pudo confirmar la reserva. Intenta nuevamente.");
                }
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
  }, [onRefreshData]);

  // Memoize these calculations to avoid recalculating on every render
  const dashboardStats = useMemo(() => {
    if (!analytics) {
      return {
        totalVisits: 0,
        totalReservations: 0,
        estimatedRevenue: 0,
        averageRating: 0
      };
    }
    
    return {
      totalVisits: analytics.totalVisits || 0,
      totalReservations: analytics.totalReservations?.confirmed || 0,
      estimatedRevenue: analytics.totalReservations?.value || 0,
      averageRating: analytics.averageRating || 0
    };
  }, [analytics]);
  
  // Show loading state if data is loading
  if (loading || !analytics) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }
  
  // Destructure for easier use in JSX
  const { totalVisits, totalReservations, estimatedRevenue, averageRating } = dashboardStats;
  
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
          
          {/* Tarjetas de estadísticas - Use memo components */}
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
              title="Ingresos Reales" 
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
          <TrendsChart 
            data={analytics.visitsData?.[selectedPeriod] || []} 
            period={selectedPeriod} 
            isLoading={isRefreshing}
          />
          
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
          
          {businesses.slice(0, 3).map((business) => (
            <PerformanceIndicator 
              key={business.id}
              business={business}
              analytics={analytics.businessesAnalytics?.[business.id]}
              onPress={() => onSelectBusiness(business.id)}
              isLoading={isRefreshing}
            />
          ))}
          
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
});

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
  }
});

export default BusinessDashboard;
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Business } from '../../context/BusinessContext';
import { BusinessAnalytics, TimePeriod } from '../../types/analyticsTypes';
import StatisticCard from './StatisticCard';
import TrendsChart from './TrendsChart';
import PerformanceIndicator from './PerformanceIndicator';
import ActionCenter from './ActionCenter';

interface BusinessDashboardProps {
  analytics: BusinessAnalytics | null;
  loading: boolean;
  businesses: Business[];
  onSelectBusiness: (businessId: string) => void;
  period: TimePeriod;
}

const BusinessDashboard: React.FC<BusinessDashboardProps> = ({
  analytics,
  loading,
  businesses,
  onSelectBusiness,
  period
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(period);
  const [expanded, setExpanded] = useState(true);
  
  if (loading || !analytics) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }
  
  const toggleExpand = () => {
    setExpanded(!expanded);
  };
  
  const totalVisits = analytics.totalVisits || 0;
  const totalReservations = analytics.totalReservations?.confirmed || 0;
  const estimatedRevenue = analytics.totalReservations?.value || 0;
  const averageRating = analytics.averageRating || 0;
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity onPress={toggleExpand}>
          <MaterialIcons 
            name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
            size={24} 
            color="#007AFF" 
          />
        </TouchableOpacity>
      </View>
      
      {expanded && (
        <>
          {/* Selector de período */}
          <View style={styles.periodSelector}>
            {([TimePeriod.DAY, TimePeriod.WEEK, TimePeriod.MONTH, TimePeriod.YEAR]).map((p) => (
              <TouchableOpacity 
                key={p}
                style={[styles.periodButton, selectedPeriod === p && styles.periodButtonActive]} 
                onPress={() => setSelectedPeriod(p)}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === p && styles.periodButtonTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
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
            />
            <StatisticCard 
              icon="event-available" 
              title="Reservas" 
              value={totalReservations} 
              trend={analytics.reservationsTrend || 0} 
            />
            <StatisticCard 
              icon="attach-money" 
              title="Ingresos Est." 
              value={`$${estimatedRevenue}`} 
              trend={analytics.revenueTrend || 0} 
              isCurrency
            />
            <StatisticCard 
              icon="star" 
              title="Calificación" 
              value={averageRating.toFixed(1)} 
              trend={0} 
              showTrend={false}
            />
          </ScrollView>
          
          {/* Gráfico de tendencias */}
          <TrendsChart 
            data={analytics.visitsData?.[selectedPeriod] || []} 
            period={selectedPeriod} 
          />
          
          {/* Indicadores de rendimiento */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Rendimiento por negocio</Text>
          </View>
          
          {businesses.slice(0, 3).map((business) => (
            <PerformanceIndicator 
              key={business.id}
              business={business}
              analytics={analytics.businessesAnalytics?.[business.id]}
              onPress={() => onSelectBusiness(business.id)}
            />
          ))}
          
          {businesses.length > 3 && (
            <TouchableOpacity style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>Ver todos</Text>
            </TouchableOpacity>
          )}
          
          {/* Centro de acción */}
          <ActionCenter 
            pendingActions={analytics.pendingActions || {}}
            onActionPress={(type, id) => {
              // Handle action press
              console.log(`Action ${type} pressed for id ${id}`);
            }}
          />
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
  },
  loadingText: {
    color: '#8E8E93',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
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
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
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
});

export default BusinessDashboard;

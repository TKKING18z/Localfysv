import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

interface BusinessStatsProps {
  businessId: string;
}

interface BusinessStats {
  views: number;
  favorites: number;
  clicks: number;
  lastWeekViews: number;
  lastWeekFavorites: number;
}

const BusinessStatsPanel: React.FC<BusinessStatsProps> = ({ businessId }) => {
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewsChange, setViewsChange] = useState<number>(0);
  const [favoritesChange, setFavoritesChange] = useState<number>(0);
  
  // Cargar estadísticas del negocio
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // En una implementación real, estas estadísticas vendrían de Firestore
        // Por ahora, generamos datos de ejemplo
        
        // Simulamos la obtención de datos de Firestore
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Datos simulados
        const viewsCount = Math.floor(Math.random() * 500) + 50;
        const favoritesCount = Math.floor(Math.random() * 50) + 5;
        const clicksCount = Math.floor(Math.random() * 200) + 20;
        const lastWeekViewsCount = Math.floor(viewsCount * 0.7);
        const lastWeekFavoritesCount = Math.floor(favoritesCount * 0.8);
        
        // Calcular cambios porcentuales
        const viewsChangePercent = Math.round(((viewsCount - lastWeekViewsCount) / lastWeekViewsCount) * 100);
        const favoritesChangePercent = Math.round(((favoritesCount - lastWeekFavoritesCount) / lastWeekFavoritesCount) * 100);
        
        setStats({
          views: viewsCount,
          favorites: favoritesCount,
          clicks: clicksCount,
          lastWeekViews: lastWeekViewsCount,
          lastWeekFavorites: lastWeekFavoritesCount
        });
        
        setViewsChange(viewsChangePercent);
        setFavoritesChange(favoritesChangePercent);
      } catch (err) {
        console.error('Error fetching business stats:', err);
        setError('No se pudieron cargar las estadísticas');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [businessId]);
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={24} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rendimiento del Negocio</Text>
        <TouchableOpacity style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <MaterialIcons name="visibility" size={24} color="#007AFF" />
          <Text style={styles.statValue}>{stats?.views}</Text>
          <Text style={styles.statLabel}>Visitas</Text>
          <View style={[
            styles.changeIndicator,
            viewsChange >= 0 ? styles.positiveChange : styles.negativeChange
          ]}>
            <MaterialIcons 
              name={viewsChange >= 0 ? "arrow-upward" : "arrow-downward"} 
              size={12} 
              color="white" 
            />
            <Text style={styles.changeText}>{Math.abs(viewsChange)}%</Text>
          </View>
        </View>
        
        <View style={styles.statCard}>
          <MaterialIcons name="favorite" size={24} color="#FF2D55" />
          <Text style={styles.statValue}>{stats?.favorites}</Text>
          <Text style={styles.statLabel}>Favoritos</Text>
          <View style={[
            styles.changeIndicator,
            favoritesChange >= 0 ? styles.positiveChange : styles.negativeChange
          ]}>
            <MaterialIcons 
              name={favoritesChange >= 0 ? "arrow-upward" : "arrow-downward"} 
              size={12} 
              color="white" 
            />
            <Text style={styles.changeText}>{Math.abs(favoritesChange)}%</Text>
          </View>
        </View>
        
        <View style={styles.statCard}>
          <MaterialIcons name="touch-app" size={24} color="#FF9500" />
          <Text style={styles.statValue}>{stats?.clicks}</Text>
          <Text style={styles.statLabel}>Interacciones</Text>
        </View>
      </View>
      
      <View style={styles.infoRow}>
        <MaterialIcons name="info-outline" size={16} color="#8E8E93" />
        <Text style={styles.infoText}>
          Los cambios porcentuales se calculan respecto a la semana anterior
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  refreshButton: {
    padding: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F7FF',
    borderRadius: 12,
    marginHorizontal: 4,
    position: 'relative',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  changeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  positiveChange: {
    backgroundColor: '#34C759',
  },
  negativeChange: {
    backgroundColor: '#FF3B30',
  },
  changeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  errorContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#FF3B30',
  },
});

export default BusinessStatsPanel;
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  useWindowDimensions,
  Share
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePoints, PointsTransaction, PointsReward } from '../context/PointsContext';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Definir el tipo de navegación
type NavigationProps = StackNavigationProp<RootStackParamList>;

const PointsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const { width } = useWindowDimensions();
  const {
    totalPoints,
    transactions,
    rewards,
    loading,
    error,
    refreshPoints,
    getAvailableRewards,
    redeemPoints,
    awardPointsForShare
  } = usePoints();
  const { user } = useAuth();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'rewards'>('history');
  const [selectedReward, setSelectedReward] = useState<PointsReward | null>(null);
  
  // Cargar datos cuando la pantalla obtiene el foco
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [])
  );
  
  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshPoints(),
        getAvailableRewards()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
    setRefreshing(false);
  };
  
  // Handle refresh
  const handleRefresh = () => {
    refreshData();
  };
  
  // Format date relative to now (e.g. "2 hours ago")
  const formatDate = (timestamp: any) => {
    try {
      const date = timestamp?.toDate() || new Date();
      return formatDistanceToNow(date, { addSuffix: true, locale: es });
    } catch (error) {
      return 'Fecha desconocida';
    }
  };
  
  // Handle redemption
  const handleRedeem = (reward: PointsReward) => {
    setSelectedReward(reward);
    
    // Check if user has enough points
    if (totalPoints < reward.pointsCost) {
      Alert.alert(
        'Puntos insuficientes',
        `Necesitas ${reward.pointsCost} puntos para canjear este premio. Te faltan ${reward.pointsCost - totalPoints} puntos.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Confirm redemption
    Alert.alert(
      'Confirmar canje',
      `¿Estás seguro de que deseas canjear ${reward.pointsCost} puntos por ${reward.name}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => setSelectedReward(null)
        },
        {
          text: 'Canjear',
          onPress: async () => {
            setRefreshing(true);
            try {
              const success = await redeemPoints(reward.id, reward.pointsCost, reward.name);
              if (success) {
                Alert.alert(
                  '¡Canje exitoso!',
                  `Has canjeado ${reward.pointsCost} puntos por ${reward.name}. Te contactaremos pronto para entregarte tu premio.`,
                  [{ text: 'OK' }]
                );
                refreshPoints();
              }
            } catch (error) {
              console.error('Error redeeming points:', error);
              Alert.alert('Error', 'No se pudo completar el canje. Inténtalo nuevamente.');
            } finally {
              setRefreshing(false);
              setSelectedReward(null);
            }
          }
        }
      ]
    );
  };
  
  // Get correct icon for transaction type
  const getTransactionIcon = (transaction: PointsTransaction) => {
    switch (transaction.type) {
      case 'purchase':
        return <MaterialIcons name="shopping-cart" size={24} color="#007AFF" />;
      case 'review':
        return <MaterialIcons name="rate-review" size={24} color="#FF9500" />;
      case 'share':
        return <MaterialIcons name="share" size={24} color="#34C759" />;
      case 'visit':
        return <MaterialIcons name="place" size={24} color="#5856D6" />;
      case 'redeem':
        return <MaterialIcons name="redeem" size={24} color="#FF3B30" />;
      default:
        return <MaterialIcons name="loyalty" size={24} color="#8E8E93" />;
    }
  };
  
  // Share the app to earn points
  const handleShareApp = async () => {
    try {
      const result = await Share.share({
        message: '¡Descubre Localfy! La mejor app para encontrar negocios locales y obtener recompensas. Descárgala ahora: [URL de tu app]',
        title: 'Localfy - Descubre lo mejor de tu ciudad'
      });
      
      if (result.action === Share.sharedAction) {
        // Award points for sharing
        try {
          await awardPointsForShare('app', 'Localfy App', result.activityType || 'other');
          Alert.alert(
            '¡Gracias por compartir!',
            'Has ganado 2 puntos por compartir Localfy',
            [{ text: 'OK', onPress: refreshPoints }]
          );
        } catch (error) {
          console.error('Error awarding points for sharing:', error);
        }
      }
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };
  
  // Sample rewards for testing until we have actual rewards in Firestore
  const sampleRewards: PointsReward[] = [
    {
      id: 'sample-reward-1',
      name: 'Descuento de $5',
      description: 'Obtén un descuento de $5 en tu próxima compra',
      pointsCost: 50,
      isActive: true
    },
    {
      id: 'sample-reward-2',
      name: 'Envío gratis',
      description: 'Envío gratis en tu próximo pedido',
      pointsCost: 100,
      isActive: true
    },
    {
      id: 'sample-reward-3',
      name: 'Producto gratis',
      description: 'Recibe un producto gratis en tu próxima visita (hasta $10)',
      pointsCost: 200,
      isActive: true
    },
    {
      id: 'sample-reward-4',
      name: 'Descuento VIP del 20%',
      description: 'Obtén un descuento del 20% en tu próxima compra',
      pointsCost: 300,
      isActive: true
    },
    {
      id: 'sample-reward-5',
      name: 'Tarjeta de regalo de $50',
      description: 'Recibe una tarjeta de regalo de $50 para usar en cualquier establecimiento',
      pointsCost: 500,
      isActive: true,
      imageUrl: 'https://via.placeholder.com/100'
    }
  ];
  
  // Use sample rewards if no rewards from context
  const displayRewards = rewards.length > 0 ? rewards : sampleRewards;
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.title}>Puntos Localfy</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Points Card */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsIconContainer}>
            <MaterialIcons name="loyalty" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.pointsTitle}>Tus puntos</Text>
          <Text style={styles.pointsValue}>{totalPoints}</Text>
          <Text style={styles.pointsSubtitle}>
            {user?.displayName ? `Nivel: ${
              totalPoints < 100 
                ? "Principiante" 
                : totalPoints < 500 
                  ? "Avanzado" 
                  : "Experto"
            }` : "Inicia sesión para acumular puntos"}
          </Text>
        </View>
        
        {/* Ways to earn points */}
        <View style={styles.earnPointsCard}>
          <Text style={styles.earnPointsTitle}>Cómo ganar puntos</Text>
          <View style={styles.earnPointsGrid}>
            <View style={styles.earnPointsItem}>
              <MaterialIcons name="shopping-cart" size={24} color="#007AFF" />
              <Text style={styles.earnPointsValue}>$1 = 2 puntos</Text>
              <Text style={styles.earnPointsLabel}>Por compra</Text>
            </View>
            <View style={styles.earnPointsItem}>
              <MaterialIcons name="rate-review" size={24} color="#FF9500" />
              <Text style={styles.earnPointsValue}>3 puntos</Text>
              <Text style={styles.earnPointsLabel}>Por reseña</Text>
            </View>
            <View style={styles.earnPointsItem}>
              <MaterialIcons name="share" size={24} color="#34C759" />
              <Text style={styles.earnPointsValue}>2 puntos</Text>
              <Text style={styles.earnPointsLabel}>Por compartir</Text>
            </View>
            <View style={styles.earnPointsItem}>
              <MaterialIcons name="place" size={24} color="#5856D6" />
              <Text style={styles.earnPointsValue}>1 punto</Text>
              <Text style={styles.earnPointsLabel}>Por cada 5 negocios visitados</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={handleShareApp}
          >
            <MaterialIcons name="share" size={18} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Compartir la app</Text>
          </TouchableOpacity>
        </View>
        
        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'history' && styles.activeTab
            ]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'history' && styles.activeTabText
            ]}>
              Historial
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'rewards' && styles.activeTab
            ]}
            onPress={() => setActiveTab('rewards')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'rewards' && styles.activeTabText
            ]}>
              Premios
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Content */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        ) : activeTab === 'history' ? (
          <View style={styles.tabContentContainer}>
            {transactions.length > 0 ? (
              transactions.map(item => (
                <View key={item.id} style={styles.transactionItem}>
                  <View style={styles.transactionIconContainer}>
                    {getTransactionIcon(item)}
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDescription}>{item.description}</Text>
                    <Text style={styles.transactionDate}>{formatDate(item.createdAt)}</Text>
                  </View>
                  <Text style={[
                    styles.transactionPoints,
                    item.points > 0 ? styles.pointsPositive : styles.pointsNegative
                  ]}>
                    {item.points > 0 ? '+' : ''}{item.points}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <MaterialIcons name="history" size={64} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>
                  Aún no tienes transacciones de puntos
                </Text>
                <Text style={styles.emptyStateSubText}>
                  Compra, escribe reseñas o comparte para ganar puntos
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.tabContentContainer}>
            {displayRewards.length > 0 ? (
              displayRewards.map(item => (
                <TouchableOpacity 
                  key={item.id}
                  style={[
                    styles.rewardItem,
                    totalPoints < item.pointsCost && styles.rewardItemDisabled
                  ]}
                  onPress={() => handleRedeem(item)}
                  disabled={totalPoints < item.pointsCost}
                >
                  <View style={styles.rewardContent}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.rewardImage} />
                    ) : (
                      <View style={styles.rewardImagePlaceholder}>
                        <MaterialIcons name="card-giftcard" size={40} color="#C7C7CC" />
                      </View>
                    )}
                    <View style={styles.rewardDetails}>
                      <Text style={styles.rewardName}>{item.name}</Text>
                      <Text style={styles.rewardDescription}>{item.description}</Text>
                      <View style={styles.rewardPointsContainer}>
                        <MaterialIcons name="stars" size={16} color="#FF9500" />
                        <Text style={styles.rewardPointsCost}>{item.pointsCost} puntos</Text>
                      </View>
                    </View>
                  </View>
                  {totalPoints < item.pointsCost && (
                    <View style={styles.rewardLocked}>
                      <MaterialIcons name="lock" size={20} color="#8E8E93" />
                      <Text style={styles.rewardLockedText}>
                        Te faltan {item.pointsCost - totalPoints} puntos
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <MaterialIcons name="card-giftcard" size={64} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>
                  No hay premios disponibles
                </Text>
                <Text style={styles.emptyStateSubText}>
                  Pronto agregaremos nuevos premios para ti
                </Text>
              </View>
            )}
          </View>
        )}
        
        {/* Extra padding at bottom for better scrolling */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerRight: {
    width: 40,
  },
  pointsCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pointsIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 40,
    padding: 12,
    marginBottom: 12,
  },
  pointsTitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
  },
  pointsSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
  },
  earnPointsCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  earnPointsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  earnPointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  earnPointsItem: {
    width: '48%',
    backgroundColor: '#F5F7FF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  earnPointsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginVertical: 8,
  },
  earnPointsLabel: {
    fontSize: 12,
    color: '#666666',
  },
  shareButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  shareButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  activeTabText: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666666',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  transactionItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  transactionIconContainer: {
    borderRadius: 40,
    padding: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  transactionPoints: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pointsPositive: {
    color: '#34C759',
  },
  pointsNegative: {
    color: '#FF3B30',
  },
  rewardItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  rewardItemDisabled: {
    opacity: 0.7,
  },
  rewardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#F0F0F5',
  },
  rewardImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardDetails: {
    flex: 1,
    marginLeft: 16,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  rewardDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    marginBottom: 8,
  },
  rewardPointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardPointsCost: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9500',
    marginLeft: 4,
  },
  rewardLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  rewardLockedText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  tabContentContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  bottomPadding: {
    height: 20,
  },
});

export default PointsScreen; 
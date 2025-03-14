import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinesses, Business } from '../context/BusinessContext';
import BusinessCard from '../components/BusinessCard';
import { useLocation } from '../hooks/useLocation';

type NavigationProps = StackNavigationProp<RootStackParamList>;

const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const { 
    refreshBusinesses, 
    toggleFavorite, 
    isFavorite,
    getFavoriteBusinesses,
    loading 
  } = useBusinesses();
  
  const { getFormattedDistance } = useLocation();
  
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteBusinesses, setFavoriteBusinesses] = useState<Business[]>([]);
  const [sortOrder, setSortOrder] = useState<'default' | 'nameAsc' | 'rating'>('default');
  
  // Update favorite businesses when the list changes
  useEffect(() => {
    updateFavoriteBusinesses();
  }, [sortOrder]);
  
  // Function to update favorite businesses with sorting
  const updateFavoriteBusinesses = () => {
    let favorites = getFavoriteBusinesses();
    
    // Apply sorting
    if (sortOrder === 'nameAsc') {
      favorites = [...favorites].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'rating') {
      favorites = [...favorites].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    
    setFavoriteBusinesses(favorites);
  };

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBusinesses();
    updateFavoriteBusinesses();
    setRefreshing(false);
  }, [refreshBusinesses]);

  // Navigate to business detail
  const navigateToBusinessDetail = (business: Business) => {
    navigation.navigate('BusinessDetail', { businessId: business.id });
  };
  
  // Handle removing from favorites
  const handleRemoveFavorite = (businessId: string) => {
    toggleFavorite(businessId);
    // Update the list immediately after toggling favorite
    setTimeout(() => {
      updateFavoriteBusinesses();
    }, 0);
  };
  
  // Render business item
  const renderBusinessItem = ({ item }: { item: Business }) => {
    // Get distance to business if location is available
    const distance = getFormattedDistance(item);
    
    return (
      <BusinessCard
        business={item}
        isFavorite={true} // In favorites screen, all items are favorites
        onPress={() => navigateToBusinessDetail(item)}
        onFavoritePress={() => handleRemoveFavorite(item.id)}
        distance={distance}
      />
    );
  };
  
  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="favorite" size={80} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>Aún no tienes favoritos</Text>
      <Text style={styles.emptySubtitle}>
        Agrega negocios a favoritos para verlos aquí y acceder a ellos rápidamente
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        // Fix: Navigate to MainTabs without extra params
        onPress={() => navigation.navigate('MainTabs')}
      >
        <Text style={styles.exploreButtonText}>Explorar negocios</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Mis Favoritos</Text>
        <View style={styles.placeholderButton} />
      </View>
      
      {/* Sort Controls */}
      {favoriteBusinesses.length > 0 && (
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Ordenar por:</Text>
          <TouchableOpacity
            style={[
              styles.sortButton, 
              sortOrder === 'default' ? styles.sortButtonActive : {}
            ]}
            onPress={() => setSortOrder('default')}
          >
            <Text style={[
              styles.sortButtonText,
              sortOrder === 'default' ? styles.sortButtonTextActive : {}
            ]}>
              Predeterminado
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.sortButton, 
              sortOrder === 'nameAsc' ? styles.sortButtonActive : {}
            ]}
            onPress={() => setSortOrder('nameAsc')}
          >
            <Text style={[
              styles.sortButtonText,
              sortOrder === 'nameAsc' ? styles.sortButtonTextActive : {}
            ]}>
              Nombre A-Z
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.sortButton, 
              sortOrder === 'rating' ? styles.sortButtonActive : {}
            ]}
            onPress={() => setSortOrder('rating')}
          >
            <Text style={[
              styles.sortButtonText,
              sortOrder === 'rating' ? styles.sortButtonTextActive : {}
            ]}>
              Calificación
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={favoriteBusinesses}
          keyExtractor={(item) => item.id}
          renderItem={renderBusinessItem}
          numColumns={2}
          columnWrapperStyle={styles.businessRow}
          contentContainerStyle={[
            styles.listContent,
            favoriteBusinesses.length === 0 ? { flex: 1 } : {}
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        />
      )}
      
      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity 
          style={styles.navItem}
          // Fix: Navigate to MainTabs and not try to use nested navigation directly
          onPress={() => navigation.navigate('MainTabs')}
        >
          <MaterialIcons name="home" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Inicio</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Map')}
        >
          <MaterialIcons name="explore" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Explorar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItemCenter}
          onPress={() => navigation.navigate('AddBusiness')}
        >
          <View style={styles.navItemCenterButton}>
            <MaterialIcons name="add" size={28} color="white" />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <MaterialIcons name="favorite" size={24} color="#007AFF" />
          <Text style={styles.navItemTextActive}>Favoritos</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <MaterialIcons name="person-outline" size={24} color="#8E8E93" />
          <Text style={styles.navItemText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  placeholderButton: {
    width: 40,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  sortLabel: {
    fontSize: 14,
    color: '#666666',
    marginRight: 12,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#F0F0F5',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666666',
  },
  sortButtonTextActive: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    height: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemCenterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navItemText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  navItemTextActive: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '600',
  },
});

export default FavoritesScreen;
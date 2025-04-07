import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  TextInput,
  Share,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinesses, Business } from '../context/BusinessContext';
import BusinessCard from '../components/BusinessCard';
import { useLocation } from '../hooks/useLocation';

type NavigationProps = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

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
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(
      favoriteBusinesses.flatMap(business => {
        if (!business.category) return [];
        if (typeof business.category === 'string') return [business.category];
        if (Array.isArray(business.category)) return business.category;
        return [];
      })
    ));
    return uniqueCategories;
  }, [favoriteBusinesses]);

  const filteredBusinesses = useMemo(() => {
    return favoriteBusinesses.filter(business => {
      const matchesSearch = !searchText || 
        business.name.toLowerCase().includes(searchText.toLowerCase());
      
      const matchesCategory = !selectedCategory || 
        (business.category && (
          typeof business.category === 'string' ? 
            business.category === selectedCategory : 
            Array.isArray(business.category) && (business.category as string[]).includes(selectedCategory)
        ));
        
      return matchesSearch && matchesCategory;
    });
  }, [favoriteBusinesses, searchText, selectedCategory]);

  useEffect(() => {
    updateFavoriteBusinesses();
  }, [sortOrder]);

  const updateFavoriteBusinesses = () => {
    let favorites = getFavoriteBusinesses();
    
    if (sortOrder === 'nameAsc') {
      favorites = [...favorites].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'rating') {
      favorites = [...favorites].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    
    setFavoriteBusinesses(favorites);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBusinesses();
    updateFavoriteBusinesses();
    setRefreshing(false);
  }, [refreshBusinesses]);

  const navigateToBusinessDetail = (business: Business) => {
    navigation.navigate('BusinessDetail', { businessId: business.id });
  };
  
  const handleRemoveFavorite = (businessId: string) => {
    toggleFavorite(businessId);
    setTimeout(() => {
      updateFavoriteBusinesses();
    }, 0);
  };

  const shareBusiness = async (business: Business) => {
    try {
      await Share.share({
        message: `¡Mira este negocio que me encanta! ${business.name} - Descárgate Localfy para más detalles.`,
        title: `Recomendación: ${business.name}`,
      });
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };

  const renderBusinessItem = ({ item }: { item: Business }) => {
    const distance = getFormattedDistance(item);
    
    return (
      <View style={styles.gridItemContainer}>
        <BusinessCard
          business={item}
          isFavorite={true}
          onPress={() => navigateToBusinessDetail(item)}
          onFavoritePress={() => handleRemoveFavorite(item.id)}
          distance={distance}
          showOpenStatus={true}
          style={styles.gridItem}
        />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="favorite" size={80} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>Aún no tienes favoritos</Text>
      <Text style={styles.emptySubtitle}>
        Agrega negocios a favoritos para verlos aquí y acceder a ellos rápidamente
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
      >
        <Text style={styles.exploreButtonText}>Explorar negocios</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptySearchState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search" size={80} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No se encontraron resultados</Text>
      <Text style={styles.emptySubtitle}>
        Intenta buscar con otro término o elimina el filtro de búsqueda
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Mis Favoritos</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar en favoritos"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MaterialIcons name="close" size={20} color="#8E8E93" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <Text style={styles.favoritesCount}>
          {favoriteBusinesses.length} {favoriteBusinesses.length === 1 ? 'Favorito' : 'Favoritos'}
        </Text>
      </View>
      
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={['Todos', ...categories]}
          keyExtractor={(item) => item}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === (item === 'Todos' ? null : item) && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(item === 'Todos' ? null : item)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === (item === 'Todos' ? null : item) && styles.categoryChipTextActive
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.categoriesList}
          showsHorizontalScrollIndicator={false}
        />
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredBusinesses}
          keyExtractor={(item) => item.id}
          renderItem={renderBusinessItem}
          numColumns={2}
          columnWrapperStyle={styles.businessRow}
          contentContainerStyle={[styles.listContent, { paddingBottom: 80 }]}
          ListEmptyComponent={filteredBusinesses.length === 0 && searchText 
            ? renderEmptySearchState 
            : renderEmptyState}
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
      
      <View style={styles.bottomNavigation}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
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
  categoriesContainer: {
    backgroundColor: 'white',
    paddingTop: 8,
    paddingBottom: 8,
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
    textAlign: 'center', // Center-align the text
    flex: 1, // Ensure the title takes up available space to center properly
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  favoritesCount: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  categoriesList: {
    paddingHorizontal: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    marginRight: 10,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  categoryChipActive: {
    backgroundColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  categoryChipTextActive: {
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
  },
  gridItemContainer: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  gridItem: {
    width: '100%',
    aspectRatio: 0.8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  listContent: {
    paddingTop: 8,
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
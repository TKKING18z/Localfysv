// components/MenuViewer.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Linking,
  ActivityIndicator,
  Alert,
  ScrollView,
  SectionList
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { MenuItem as MenuItemType } from '../context/BusinessContext';
import MenuItem from './menu/MenuItem';

// Interface actualizada
interface MenuViewerProps {
  menu?: MenuItemType[];
  menuUrl?: string;
  isNested?: boolean;  
  viewType?: 'restaurant' | 'tourism';  
  businessId?: string; 
  businessName?: string; 
}

const MenuViewer: React.FC<MenuViewerProps> = ({ 
  menu, 
  menuUrl,
  isNested = false,
  viewType = 'restaurant',
  businessId,
  businessName
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Generar IDs únicos para los elementos que no tengan
  const menuWithIds = React.useMemo(() => {
    if (!menu || menu.length === 0) return [];
    
    return menu.map((item, index) => ({
      ...item,
      id: item.id || `menu-item-${index}-${item.name.replace(/\s+/g, '-').toLowerCase()}`
    }));
  }, [menu]);
  
  // Extraer categorías únicas
  const categories = React.useMemo(() => {
    if (!menuWithIds || menuWithIds.length === 0) return [];
    const uniqueCategories = [...new Set(menuWithIds.map(item => item.category || 'Sin categoría'))];
    return uniqueCategories;
  }, [menuWithIds]);
  
  // Filtrar elementos para FlatList basados en categoría activa
  const filteredItems = React.useMemo(() => {
    if (!menuWithIds || menuWithIds.length === 0) return [];
    
    if (activeCategory) {
      return menuWithIds.filter(item => (item.category || 'Sin categoría') === activeCategory);
    }
    
    return menuWithIds;
  }, [menuWithIds, activeCategory]);
  
  // Abrir URL del menú externo
  const handleOpenMenuUrl = async () => {
    if (!menuUrl) return;
    
    let url = menuUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    setLoading(true);
    
    try {
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se puede abrir este enlace');
      }
    } catch (error) {
      console.error('Error al abrir URL:', error);
      Alert.alert('Error', 'No se pudo abrir el enlace del menú');
    } finally {
      setLoading(false);
    }
  };
  
  // Componente personalizado para cada elemento del menú con mayor tamaño
  const EnhancedMenuItem = React.memo(({ item }: { item: MenuItemType }) => {
    return (
      <View style={styles.enhancedMenuItem}>
        <View style={styles.menuItemContent}>
          <View style={styles.menuItemImageContainer}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.enhancedMenuItemImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.enhancedMenuItemPlaceholder}>
                <MaterialIcons name="restaurant" size={38} color="#BBBBBB" />
              </View>
            )}
          </View>
          
          <View style={styles.menuItemDetails}>
            <Text style={styles.enhancedMenuItemName}>{item.name}</Text>
            
            {item.description && (
              <Text style={styles.enhancedMenuItemDescription}>{item.description}</Text>
            )}
            
            <Text style={styles.enhancedMenuItemPrice}>
              ${parseFloat(item.price?.toString() || "0").toFixed(2)}
            </Text>
            
            {item.category && (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>{item.category}</Text>
              </View>
            )}
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.addToCartButton}
          onPress={() => {
            // Esta funcionalidad se maneja dentro del componente MenuItem
          }}
        >
          <MaterialIcons name="add-shopping-cart" size={22} color="#FFFFFF" />
          <Text style={styles.addToCartText}>Agregar</Text>
        </TouchableOpacity>
      </View>
    );
  });
  
  // Renderizar cada item del menú usando el componente MenuItem
  const renderFlatMenuItem = ({ item }: { item: MenuItemType }) => (
    <MenuItem
      id={`${businessId || ''}-${item.category || 'sin-categoria'}-${item.name}-${item.id || 'no-id'}`}
      name={item.name}
      description={item.description}
      price={parseFloat(item.price?.toString() || "0") || 0}
      image={item.imageUrl}
      businessId={businessId || ''}
      businessName={businessName || 'Localfy'}
      hasOptions={false}
    />
  );
  
  // Renderizar el header con las categorías
  const renderCategoriesHeader = () => {
    if (categories.length === 0) return null;
    
    return (
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
          {['Todos', ...categories].map((item, index) => (
            <TouchableOpacity
              key={`category-${index}-${item}`}
              style={[
                styles.categoryButton,
                (index === 0 && activeCategory === null) || (item === activeCategory) ? 
                  styles.activeCategoryButton : undefined
              ]}
              onPress={() => setActiveCategory(index === 0 ? null : item)}
            >
              <Text style={[
                styles.categoryButtonText,
                (index === 0 && activeCategory === null) || (item === activeCategory) ? 
                  styles.activeCategoryButtonText : undefined
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Debug - log para verificar si hay elementos en el menú
  console.log('MenuViewer: Elementos en el menú:', menu?.length || 0);
  console.log('MenuViewer: Categorías:', categories);
  console.log('MenuViewer: filteredItems:', filteredItems.length);
  
  // Si no hay datos de menú, mostrar mensaje apropiado
  if ((!menu || menu.length === 0) && !menuUrl) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons 
          name={viewType === 'tourism' ? "hiking" : "restaurant-menu"} 
          size={48} 
          color="#E5E5EA" 
        />
        <Text style={styles.emptyText}>{viewType === 'tourism' ? 'No hay planes disponibles' : 'No hay menú disponible'}</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Link a menú externo si está disponible */}
      {menuUrl && (
        <TouchableOpacity 
          style={styles.menuUrlButton}
          onPress={handleOpenMenuUrl}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="open-in-new" size={20} color="#FFFFFF" />
              <Text style={styles.menuUrlButtonText}>
                {viewType === 'tourism' ? 'Ver Planes Completos' : 'Ver Menú Completo'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
      
      {/* Lista de menú */}
      {menu && menu.length > 0 && (
        <>
          {renderCategoriesHeader()}
          <FlatList
            data={filteredItems}
            renderItem={renderFlatMenuItem}
            keyExtractor={(item, index) => `${item.id || `item-${index}`}-${item.name}`}
            contentContainerStyle={styles.menuList}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={true}
            removeClippedSubviews={true}
            initialNumToRender={8}
            maxToRenderPerBatch={5}
            windowSize={5}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No hay elementos disponibles</Text>
            }
          />
        </>
      )}
      
      {/* Mensaje cuando solo hay URL de menú */}
      {(!menu || menu.length === 0) && menuUrl && (
        <View style={styles.onlyUrlContainer}>
          <Text style={styles.onlyUrlText}>
            {viewType === 'tourism' 
              ? 'Este negocio tiene planes disponibles en línea. Haga clic en el botón de arriba para verlos.'
              : 'Este negocio tiene un menú externo disponible. Haga clic en el botón de arriba para verlo.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
  },
  menuUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  menuUrlButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  categoriesContainer: {
    marginBottom: 16,
    maxHeight: 50,
  },
  categoriesScrollContent: {
    paddingRight: 16,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F0F0F5',
    marginRight: 8,
  },
  activeCategoryButton: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666666',
  },
  activeCategoryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  menuList: {
    paddingBottom: 16,
    paddingHorizontal: 2,
  },
  enhancedMenuItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItemContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  menuItemImageContainer: {
    marginRight: 16,
  },
  enhancedMenuItemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  enhancedMenuItemPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  enhancedMenuItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  enhancedMenuItemDescription: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
  },
  enhancedMenuItemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 8,
  },
  menuItemLeft: {
    marginRight: 12,
  },
  menuItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  menuItemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  categoryTag: {
    backgroundColor: '#007AFF20',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  categoryTagText: {
    fontSize: 12,
    color: '#007AFF',
  },
  menuItemRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  onlyUrlContainer: {
    padding: 16,
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  onlyUrlText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#F5F7FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: '#007AFF',
  },
  addToCartButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
});

export default MenuViewer;
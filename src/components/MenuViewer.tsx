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
  isNested?: boolean;  // Add this property
  viewType?: 'restaurant' | 'tourism';  // Add this property
  businessId?: string; // Add this property
  businessName?: string; // Add this property
}

// Interface para las secciones
interface MenuSection {
  title: string;
  data: MenuItemType[];
}

const MenuViewer: React.FC<MenuViewerProps> = ({ 
  menu, 
  menuUrl,
  isNested = false,  // Default value
  viewType = 'restaurant',  // Default value
  businessId,
  businessName
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Extraer categorías únicas
  const categories = React.useMemo(() => {
    if (!menu || menu.length === 0) return [];
    const uniqueCategories = [...new Set(menu.map(item => item.category || 'Sin categoría'))];
    return uniqueCategories;
  }, [menu]);
  
  // Preparar secciones para SectionList
  const menuSections = React.useMemo(() => {
    if (!menu || menu.length === 0) return [];
    
    // Si hay una categoría activa, solo mostrar esa
    if (activeCategory) {
      const filteredItems = menu.filter(item => 
        (item.category || 'Sin categoría') === activeCategory
      );
      
      return [{
        title: activeCategory,
        data: filteredItems
      }];
    }
    
    // Si no hay categoría activa, agrupar por categorías
    const sections: MenuSection[] = [];
    
    categories.forEach(category => {
      const itemsInCategory = menu.filter(item => 
        (item.category || 'Sin categoría') === category
      );
      
      if (itemsInCategory.length > 0) {
        sections.push({
          title: category,
          data: itemsInCategory
        });
      }
    });
    
    return sections;
  }, [menu, categories, activeCategory]);
  
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
  
  // Generar color a partir de un string (para fondos de placeholder)
  const getColorFromString = (str: string): string => {
    const colors = [
      '#FF9500', '#FF2D55', '#5856D6', '#007AFF', '#34C759',
      '#AF52DE', '#FF3B30', '#5AC8FA', '#FFCC00', '#4CD964'
    ];
    
    const hash = Array.from(str).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  // Renderizar imagen con fallback
  const renderMenuItemImage = (imageUrl?: string, name?: string) => {
    if (!imageUrl) {
      return (
        <View style={styles.menuItemImagePlaceholder}>
          <MaterialIcons name="restaurant" size={24} color="#8E8E93" />
        </View>
      );
    }
    
    // Manejar diferentes formatos de imagen (URL, base64)
    return (
      <Image
        source={{ uri: imageUrl }}
        style={styles.menuItemImage}
        contentFit="cover"
        transition={200}
        placeholder={{ color: getColorFromString(name || 'item') }}
        recyclingKey={imageUrl} // Para evitar problemas de caché
      />
    );
  };
  
  // Renderizar cada item del menú usando el componente MenuItem
  const renderMenuItem = ({ item }: { item: MenuItemType }) => (
    <MenuItem
      id={`${businessId || ''}-${item.category || 'sin-categoria'}-${item.name}-${item.id}`}
      name={item.name}
      description={item.description}
      price={parseFloat(item.price.toString()) || 0}
      image={item.imageUrl}
      businessId={businessId || ''}
      businessName={businessName || 'Localfy'}
      onPress={() => {
        // Aquí puedes navegar a una pantalla de detalle del ítem si es necesario
      }}
      hasOptions={false}
    />
  );
  
  // Renderizar el header de cada sección
  const renderSectionHeader = ({ section: { title } }: { section: MenuSection }) => (
    <Text style={styles.categoryTitle}>{title}</Text>
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
      
      {/* Lista de items del menú usando SectionList */}
      {menu && menu.length > 0 ? (
        <SectionList
          sections={menuSections}
          renderItem={renderMenuItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={renderCategoriesHeader}
          contentContainerStyle={styles.menuList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
        />
      ) : menuUrl ? (
        <View style={styles.onlyUrlContainer}>
          <Text style={styles.onlyUrlText}>
            {viewType === 'tourism' 
              ? 'Este negocio tiene planes disponibles en línea. Haga clic en el botón de arriba para verlos.'
              : 'Este negocio tiene un menú externo disponible. Haga clic en el botón de arriba para verlo.'}
          </Text>
        </View>
      ) : null}
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
    paddingBottom: 8,
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
    marginVertical: 4,
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
});

export default MenuViewer;
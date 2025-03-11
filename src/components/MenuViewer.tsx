import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Linking, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { MenuItem } from '../context/BusinessContext';

interface MenuViewerProps {
  menu?: MenuItem[];
  menuUrl?: string;
}

const { width } = Dimensions.get('window');

const MenuViewer: React.FC<MenuViewerProps> = ({ menu, menuUrl }) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // Si no hay datos de menú pero hay URL de menú externo
  if ((!menu || menu.length === 0) && menuUrl) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <MaterialIcons name="restaurant-menu" size={20} color="#007AFF" />
          <Text style={styles.headerText}>Menú</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.menuLinkButton}
          onPress={() => {
            // Abrir enlace al menú
            if (menuUrl.startsWith('http://') || menuUrl.startsWith('https://')) {
              Linking.openURL(menuUrl);
            } else {
              Linking.openURL(`https://${menuUrl}`);
            }
          }}
        >
          <MaterialIcons name="menu-book" size={24} color="#007AFF" />
          <Text style={styles.menuLinkText}>Ver menú completo</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Si no hay datos de menú ni URL
  if (!menu || menu.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <MaterialIcons name="restaurant-menu" size={20} color="#007AFF" />
          <Text style={styles.headerText}>Menú</Text>
        </View>
        <Text style={styles.noDataText}>Menú no disponible</Text>
      </View>
    );
  }
  
  // Extraer categorías únicas
  const categories = Array.from(new Set(menu.map(item => item.category || 'Sin categoría')));
  
  // Filtrar elementos por categoría seleccionada
  const filteredItems = activeCategory 
    ? menu.filter(item => (item.category || 'Sin categoría') === activeCategory)
    : menu;
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialIcons name="restaurant-menu" size={20} color="#007AFF" />
        <Text style={styles.headerText}>Menú</Text>
      </View>
      
      {/* Categorías */}
      {categories.length > 1 && (
        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.categoryButton,
                activeCategory === null ? styles.activeCategoryButton : {}
              ]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[
                styles.categoryText,
                activeCategory === null ? styles.activeCategoryText : {}
              ]}>
                Todos
              </Text>
            </TouchableOpacity>
            
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  activeCategory === category ? styles.activeCategoryButton : {}
                ]}
                onPress={() => setActiveCategory(category)}
              >
                <Text style={[
                  styles.categoryText,
                  activeCategory === category ? styles.activeCategoryText : {}
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* Items del menú */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.menuItem}>
            {item.imageUrl && (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.menuItemImage}
                contentFit="cover"
              />
            )}
            
            <View style={styles.menuItemDetails}>
              <Text style={styles.menuItemName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.menuItemDescription}>{item.description}</Text>
              )}
              <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
      
      {menuUrl && (
        <TouchableOpacity 
          style={styles.viewFullMenuButton}
          onPress={() => {
            // Abrir enlace al menú completo
            if (menuUrl.startsWith('http://') || menuUrl.startsWith('https://')) {
              Linking.openURL(menuUrl);
            } else {
              Linking.openURL(`https://${menuUrl}`);
            }
          }}
        >
          <Text style={styles.viewFullMenuText}>Ver menú completo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333333',
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F7FF',
    marginRight: 8,
  },
  activeCategoryButton: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#007AFF',
  },
  activeCategoryText: {
    color: 'white',
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F5F7FF',
    borderRadius: 8,
    marginBottom: 8,
  },
  menuItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  menuItemDetails: {
    flex: 1,
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
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  separator: {
    height: 1,
    backgroundColor: '#E1E1E1',
    marginVertical: 8,
  },
  viewFullMenuButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    marginTop: 12,
  },
  viewFullMenuText: {
    color: 'white',
    fontWeight: 'bold',
  },
  menuLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    padding: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  menuLinkText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  }
});

export default MenuViewer;
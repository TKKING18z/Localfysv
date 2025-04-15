import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated } from 'react-native';

interface BusinessTabsProps {
  availableTabs: string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabBarOpacity: Animated.Value;
  isTouristAttraction: boolean;
}

const { width } = Dimensions.get('window');

const BusinessTabs: React.FC<BusinessTabsProps> = ({
  availableTabs,
  activeTab,
  setActiveTab,
  tabBarOpacity,
  isTouristAttraction,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Get tab icon based on tab name and context
  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'info': return 'info';
      case 'gallery': return 'photo-library';
      case 'menu': return isTouristAttraction ? 'hiking' : 'restaurant-menu';
      case 'promociones': return 'local-offer';
      case 'reservas': return 'event-available';
      case 'reseñas': return 'star-rate';
      default: return 'info';
    }
  };

  // Get tab label based on tab name and context
  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'info': return 'Información';
      case 'gallery': return 'Galería';
      case 'menu': return isTouristAttraction ? 'Planes' : 'Menú';
      case 'promociones': return 'Promos';
      case 'reservas': return 'Reservas';
      case 'reseñas': return 'Reseñas';
      default: return tab;
    }
  };
  
  // Scroll to active tab
  const handleTabPress = (tab: string, index: number) => {
    setActiveTab(tab);
    
    // Scroll the tab into view when selected
    if (scrollViewRef.current && availableTabs.length > 3) {
      const position = index * 120; // Aproximado basado en el ancho del tab
      scrollViewRef.current.scrollTo({ x: position - width / 3, animated: true });
    }
  };

  return (
    <Animated.View 
      style={[
        styles.tabsContainer,
        { opacity: tabBarOpacity }
      ]}
      accessibilityRole="tablist"
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {availableTabs.map((tab, index) => (
          <TouchableOpacity 
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.activeTab
            ]} 
            onPress={() => handleTabPress(tab, index)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            accessibilityLabel={`Pestaña ${getTabLabel(tab)}`}
          >
            <MaterialIcons 
              name={getTabIcon(tab)} 
              size={20} 
              color={activeTab === tab ? "#2563EB" : "#6B7280"} 
              style={styles.tabIcon}
            />
            <Text 
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.tabText, 
                activeTab === tab && styles.activeTabText
              ]}
            >
              {getTabLabel(tab)}
            </Text>
            
            {/* Indicador de pestaña activa */}
            {activeTab === tab && (
              <View style={styles.activeIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    marginBottom: 8,
    marginTop: 8,
    backgroundColor: 'white',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabIcon: {
    marginRight: 6,
  },
  activeTab: {
    backgroundColor: '#EBF5FF',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2563EB',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 3,
    backgroundColor: '#2563EB',
    borderRadius: 1.5,
  }
});

export default BusinessTabs; 
import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MenuViewer from '../MenuViewer';

interface BusinessMenuTabProps {
  menu: any;
  menuUrl: string | undefined;
  isTouristAttraction: boolean;
  businessId: string;
  businessName: string;
}

const BusinessMenuTab: React.FC<BusinessMenuTabProps> = ({ 
  menu, 
  menuUrl, 
  isTouristAttraction,
  businessId,
  businessName,
}) => {
  const dimensions = useWindowDimensions();
  
  // Debug para verificar si hay elementos en el menú
  console.log('BusinessMenuTab - menu:', menu?.length || 0, 'menuUrl:', !!menuUrl);
  if (menu) {
    console.log('BusinessMenuTab - menu primer elemento:', JSON.stringify(menu[0]));
  }

  return (
    <>
      {(menu || menuUrl) ? (
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>
            {isTouristAttraction ? 'Planes y Actividades' : 'Menú'}
          </Text>
          <View style={[styles.menuContainer, { height: dimensions.height * 0.8 }]}>
            <MenuViewer 
              menu={menu} 
              menuUrl={menuUrl} 
              viewType={isTouristAttraction ? 'tourism' : 'restaurant'}
              businessId={businessId}
              businessName={businessName}
            />
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <MaterialIcons 
            name={isTouristAttraction ? "hiking" : "restaurant-menu"} 
            size={48} 
            color="#E5E5EA" 
          />
          <Text style={styles.emptyCardText}>
            {isTouristAttraction ? 'No hay planes disponibles' : 'No hay menú disponible'}
          </Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff',
    height: '98%', // Aumentar para que ocupe casi toda la pantalla disponible
  },
  cardSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007aff',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)',
  },
  menuContainer: {
    marginBottom: 16,
    flex: 1,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  emptyCardText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
    textAlign: 'center',
  },
});

export default BusinessMenuTab; 
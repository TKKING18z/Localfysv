import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import PromoCard from '../promotions/PromoCard';
import { Promotion } from '../../types/businessTypes';

const { height } = Dimensions.get('window');

interface BusinessPromotionsTabProps {
  promotions: Promotion[];
  loadingPromotions: boolean;
  isBusinessOwner: boolean;
  navigateToPromotions: () => void;
}

const BusinessPromotionsTab: React.FC<BusinessPromotionsTabProps> = ({
  promotions,
  loadingPromotions,
  isBusinessOwner,
  navigateToPromotions,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.cardSectionTitle}>Promociones</Text>
          {isBusinessOwner && (
            <TouchableOpacity 
              style={styles.managementButton}
              onPress={navigateToPromotions}
            >
              <MaterialIcons name="edit" size={20} color="#007AFF" />
              <Text style={styles.managementButtonText}>Gestionar</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {loadingPromotions ? (
          <ActivityIndicator size="large" color="#007AFF" style={{marginVertical: 20}} />
        ) : promotions.length > 0 ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promotionsScrollContent}
          >
            {promotions.map((promo) => (
              <View key={promo.id} style={styles.promotionItemContainer}>
                <PromoCard promotion={promo} compact={true} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyStateContainer}>
            <MaterialIcons name="local-offer" size={48} color="#E5E5EA" />
            <Text style={styles.emptyStateText}>No hay promociones disponibles</Text>
          </View>
        )}

        {!isBusinessOwner && promotions.length > 0 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={navigateToPromotions}
          >
            <Text style={styles.viewAllButtonText}>Ver todas las promociones</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: height * 0.5,
  },
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
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007aff',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  managementButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  promotionsScrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  promotionItemContainer: {
    marginHorizontal: 8,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  viewAllButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 4,
  },
});

export default BusinessPromotionsTab; 
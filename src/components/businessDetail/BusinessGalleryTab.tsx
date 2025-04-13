import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import EnhancedGallery from '../EnhancedGallery';
import { BusinessImage } from '../../types/businessTypes';

const { height } = Dimensions.get('window');

interface BusinessGalleryTabProps {
  images: BusinessImage[] | undefined;
}

const BusinessGalleryTab: React.FC<BusinessGalleryTabProps> = ({ images }) => {
  return (
    <View style={styles.container}>
      {images && images.length > 0 ? (
        <View style={styles.galleryCard}>
          <Text style={styles.cardSectionTitle}>Galería de imágenes</Text>
          <EnhancedGallery images={images} />
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <MaterialIcons name="photo-library" size={48} color="#E5E5EA" />
          <Text style={styles.emptyCardText}>No hay imágenes disponibles</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: height * 0.5,
  },
  galleryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
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

export default BusinessGalleryTab; 
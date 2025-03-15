import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface GalleryImage {
  id?: string;
  url: string;
  isMain?: boolean;
}

interface EnhancedGalleryProps {
  images: GalleryImage[];
  title?: string;
  fullWidth?: boolean; // Añadir esta prop como opcional
}

const { width } = Dimensions.get('window');
const imageSize = (width - 48) / 3;

const EnhancedGallery: React.FC<EnhancedGalleryProps> = ({ images, title = "Galería" }) => {
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  if (!images || images.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <MaterialIcons name="photo-library" size={20} color="#007AFF" />
          <Text style={styles.headerText}>{title}</Text>
        </View>
        <Text style={styles.noDataText}>No hay imágenes disponibles</Text>
      </View>
    );
  }
  
  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setFullScreenVisible(true);
  };
  
  // Ordenar: primero la imagen principal, luego el resto
  const sortedImages = [...images].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    return 0;
  });
  
  const renderImageItem = ({ item, index }: { item: GalleryImage; index: number }) => (
    <TouchableOpacity 
      style={styles.imageContainer}
      onPress={() => handleImagePress(index)}
    >
      <Image
        source={{ uri: item.url }}
        style={styles.thumbnail}
        contentFit="cover"
        transition={200}
      />
      {item.isMain && (
        <View style={styles.mainBadge}>
          <Text style={styles.mainBadgeText}>Principal</Text>
        </View>
      )}
    </TouchableOpacity>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialIcons name="photo-library" size={20} color="#007AFF" />
        <Text style={styles.headerText}>{title}</Text>
      </View>
      
      <FlatList
        data={sortedImages}
        renderItem={renderImageItem}
        keyExtractor={(item, index) => item.id || `image-${index}`}
        numColumns={3}
        horizontal={false}
        scrollEnabled={false}
        contentContainerStyle={styles.imageGrid}
      />
      
      {/* Visualizador de imágenes a pantalla completa */}
      <Modal
        visible={fullScreenVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenVisible(false)}
      >
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setFullScreenVisible(false)}
          >
            <MaterialIcons name="close" size={28} color="white" />
          </TouchableOpacity>
          
          <FlatList
            data={sortedImages}
            renderItem={({ item }) => (
              <View style={styles.fullScreenImageContainer}>
                <Image
                  source={{ uri: item.url }}
                  style={styles.fullScreenImage}
                  contentFit="contain"
                />
              </View>
            )}
            horizontal
            pagingEnabled
            initialScrollIndex={selectedImageIndex}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}
          />
          
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationText}>
              {selectedImageIndex + 1} / {images.length}
            </Text>
          </View>
        </View>
      </Modal>
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
  imageGrid: {
    marginHorizontal: -4,
  },
  imageContainer: {
    width: imageSize,
    height: imageSize,
    margin: 4,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  mainBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mainBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImageContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: '80%',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  paginationText: {
    color: 'white',
    fontSize: 14,
  }
});

export default EnhancedGallery;
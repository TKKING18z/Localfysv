import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../theme';

interface ImageUploaderProps {
  onImagesSelected: (uris: string[]) => void;
  selectedImages: string[];
  existingImages?: string[];
  onRemoveSelected: (index: number) => void;
  maxImages: number;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImagesSelected,
  selectedImages,
  existingImages = [],
  onRemoveSelected,
  maxImages,
}) => {
  const totalImages = existingImages.length + selectedImages.length;
  const canAddMore = totalImages < maxImages;
  
  const requestPermissions = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisos necesarios',
          'Necesitamos acceso a tu galería para seleccionar imágenes.'
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'No se pudieron solicitar los permisos');
      return false;
    }
  }, []);
  
  const pickImages = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.7,
        aspect: [4, 3],
      });
      
      if (!result.canceled && result.assets) {
        const remainingSlots = maxImages - totalImages;
        const selectedAssets = result.assets.slice(0, remainingSlots);
        onImagesSelected(selectedAssets.map(asset => asset.uri));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'No se pudieron cargar las imágenes');
    }
  }, [maxImages, onImagesSelected, requestPermissions, totalImages]);
  
  const takePhoto = useCallback(async () => {
    if (!canAddMore) {
      Alert.alert(
        'Límite alcanzado',
        `Solo puedes subir un máximo de ${maxImages} imágenes.`
      );
      return;
    }
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permisos necesarios',
        'Necesitamos acceso a tu cámara para tomar fotos.'
      );
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
        aspect: [4, 3],
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        onImagesSelected([result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo capturar la foto');
    }
  }, [canAddMore, maxImages, onImagesSelected]);
  
  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item }} style={styles.image} />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemoveSelected(index)}
      >
        <MaterialIcons name="cancel" size={24} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
  
  const renderExistingImage = ({ item }: { item: string }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item }} style={styles.image} />
      <View style={styles.existingBadge}>
        <Text style={styles.existingBadgeText}>Subida</Text>
      </View>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, !canAddMore && styles.disabledButton]}
          onPress={pickImages}
          disabled={!canAddMore}
        >
          <MaterialIcons
            name="photo-library"
            size={20}
            color={canAddMore ? colors.primary : colors.grey}
          />
          <Text
            style={[
              styles.buttonText,
              !canAddMore && styles.disabledButtonText,
            ]}
          >
            Galería
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, !canAddMore && styles.disabledButton]}
          onPress={takePhoto}
          disabled={!canAddMore}
        >
          <MaterialIcons
            name="camera-alt"
            size={20}
            color={canAddMore ? colors.primary : colors.grey}
          />
          <Text
            style={[
              styles.buttonText,
              !canAddMore && styles.disabledButtonText,
            ]}
          >
            Cámara
          </Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.imageCount}>
        {totalImages} de {maxImages} imágenes
      </Text>
      
      {existingImages.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Imágenes existentes</Text>
          <FlatList
            data={existingImages}
            renderItem={renderExistingImage}
            keyExtractor={(_, index) => `existing-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </>
      )}
      
      {selectedImages.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Imágenes seleccionadas</Text>
          <FlatList
            data={selectedImages}
            renderItem={renderImageItem}
            keyExtractor={(_, index) => `selected-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.small,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: spacing.medium,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: spacing.borderRadius,
    marginRight: spacing.medium,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
    marginLeft: spacing.tiny,
  },
  disabledButtonText: {
    color: colors.grey,
  },
  imageCount: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.small,
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: spacing.small,
    marginBottom: spacing.small,
  },
  imageContainer: {
    marginRight: spacing.small,
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: spacing.borderRadius,
  },
  removeButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  existingBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 2,
  },
  existingBadgeText: {
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: 10,
    textAlign: 'center',
  },
});

export default ImageUploader;

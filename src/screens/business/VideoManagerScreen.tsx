import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import firebase from 'firebase/compat/app';
import 'firebase/compat/storage';
import { Video } from 'expo-av';

interface BusinessVideo {
  id?: string;
  url: string;
  thumbnail?: string;
}

interface RouteParams {
  businessId: string;
  initialVideos?: BusinessVideo[];
  onSave: (videos: BusinessVideo[]) => void;
}

type VideoManagerRouteProp = RouteProp<{ params: RouteParams }, 'params'>;
type NavigationProp = StackNavigationProp<any>;

// Generar ID único
const generateUniqueId = () => {
  return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const VideoManagerScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VideoManagerRouteProp>();
  const { businessId, initialVideos, onSave } = route.params;
  
  const [videos, setVideos] = useState<BusinessVideo[]>(initialVideos || []);
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Seleccionar video (solo URL)
  const addVideoUrl = () => {
    if (!videoUrl.trim()) {
      Alert.alert('Error', 'Ingresa una URL de video válida');
      return;
    }
    
    // Validar formato de URL (básico)
    if (!videoUrl.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com).*$/i)) {
      Alert.alert(
        'URL no compatible',
        'Por favor ingresa una URL de un servicio de video compatible (YouTube, Vimeo, Dailymotion)'
      );
      return;
    }
    
    // Añadir nuevo video
    const newVideo: BusinessVideo = {
      id: generateUniqueId(),
      url: videoUrl,
      thumbnail: thumbnailUri || undefined
    };
    
    setVideos([...videos, newVideo]);
    setVideoUrl('');
    setThumbnailUri(null);
  };
  
  // Seleccionar imagen de miniatura
  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para seleccionar imágenes.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setThumbnailUri(result.assets[0].uri);
    }
  };
  
  // Subir miniatura
  const uploadThumbnail = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const imageName = `video_thumbnails/${businessId}/${Date.now()}.jpg`;
      const ref = firebase.storage().ref().child(imageName);
      
      await ref.put(blob);
      return await ref.getDownloadURL();
    } catch (error) {
      console.error('Error al subir miniatura:', error);
      throw new Error('No se pudo subir la miniatura.');
    }
  };
  
  // Guardar todos los videos
  const handleSave = async () => {
    try {
      setLoading(true);
      
      let updatedVideos = [...videos];
      
      // Procesar y subir miniaturas pendientes
      for (let i = 0; i < updatedVideos.length; i++) {
        const video = updatedVideos[i];
        
        // Si la miniatura es una URI local, subirla
        if (video.thumbnail && video.thumbnail.startsWith('file://')) {
          try {
            const downloadUrl = await uploadThumbnail(video.thumbnail);
            updatedVideos[i] = {
              ...video,
              thumbnail: downloadUrl
            };
          } catch (error) {
            console.error('Error al procesar miniatura:', error);
          }
        }
      }
      
      onSave(updatedVideos);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron guardar los videos.');
    } finally {
      setLoading(false);
    }
  };
  
  // Eliminar video
  const handleDeleteVideo = (id: string) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar este video?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: () => setVideos(videos.filter(v => v.id !== id)) 
        }
      ]
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestionar Videos</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollContent}>
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Añade videos para mostrar tu negocio. Puedes agregar URL de videos de YouTube, Vimeo u otros servicios.
          </Text>
        </View>
        
        {/* Videos actuales */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Videos Actuales</Text>
          
          {videos.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="videocam-off" size={48} color="#D1D1D6" />
              <Text style={styles.emptyText}>
                No has añadido ningún video. Añade URL de videos para mostrar.
              </Text>
            </View>
          ) : (
            videos.map((video, index) => (
              <View key={video.id || index} style={styles.videoItem}>
                <View style={styles.videoPreview}>
                  {video.thumbnail ? (
                    <Image
                      source={{ uri: video.thumbnail }}
                      style={styles.thumbnail}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.thumbnailPlaceholder}>
                      <MaterialIcons name="video-library" size={24} color="#8E8E93" />
                    </View>
                  )}
                  
                  <View style={styles.playIconOverlay}>
                    <MaterialIcons name="play-arrow" size={24} color="white" />
                  </View>
                </View>
                
                <View style={styles.videoInfo}>
                  <Text style={styles.videoUrl} numberOfLines={2}>
                    {video.url}
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDeleteVideo(video.id || '')}
                  >
                    <MaterialIcons name="delete" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
        
        {/* Añadir nuevo video */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Añadir Video</Text>
          
          <Text style={styles.fieldLabel}>URL del Video</Text>
          <TextInput
            style={styles.input}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder="https://www.youtube.com/watch?v=ejemplo"
            placeholderTextColor="#8E8E93"
            autoCapitalize="none"
            keyboardType="url"
          />
          
          <Text style={styles.fieldLabel}>Miniatura (Opcional)</Text>
          <TouchableOpacity 
            style={styles.thumbnailSelector}
            onPress={pickThumbnail}
          >
            {thumbnailUri ? (
              <Image
                source={{ uri: thumbnailUri }}
                style={styles.thumbnailPreview}
                contentFit="cover"
              />
            ) : (
              <View style={styles.thumbnailSelectorPlaceholder}>
                <MaterialIcons name="add-photo-alternate" size={32} color="#8E8E93" />
                <Text style={styles.thumbnailSelectorText}>
                  Seleccionar Miniatura
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.addVideoButton,
              !videoUrl.trim() ? styles.addVideoButtonDisabled : {}
            ]}
            onPress={addVideoUrl}
            disabled={!videoUrl.trim()}
          >
            <MaterialIcons 
              name="add-circle" 
              size={20} 
              color={videoUrl.trim() ? 'white' : '#CCCCCC'} 
            />
            <Text style={[
              styles.addVideoButtonText,
              !videoUrl.trim() ? styles.addVideoButtonTextDisabled : {}
            ]}>
              Añadir Video
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E1F5FE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0277BD',
  },
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 16,
  },
  videoItem: {
    marginBottom: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoPreview: {
    height: 150,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  videoUrl: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
  },
  deleteButton: {
    padding: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    marginBottom: 16,
  },
  thumbnailSelector: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  thumbnailSelectorPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailSelectorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  thumbnailPreview: {
    width: '100%',
    height: '100%',
  },
  addVideoButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  addVideoButtonDisabled: {
    backgroundColor: '#F0F0F5',
  },
  addVideoButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  addVideoButtonTextDisabled: {
    color: '#8E8E93',
  },
});

export default VideoManagerScreen;
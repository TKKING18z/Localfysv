import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';

interface VideoPlayerProps {
  videos: Array<{id?: string, url: string, thumbnail?: string}>;
}

const { width } = Dimensions.get('window');
const videoHeight = width * 9 / 16; // Aspect ratio 16:9

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videos }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(0);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<Video>(null);
  
  if (!videos || videos.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <MaterialIcons name="videocam" size={20} color="#007AFF" />
          <Text style={styles.headerText}>Videos</Text>
        </View>
        <Text style={styles.noDataText}>No hay videos disponibles</Text>
      </View>
    );
  }
  
  const togglePlay = async () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      setLoading(true);
      await videoRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  };
  
  const handlePlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setLoading(false);
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
    }
  };
  
  const handleVideoSelection = (index: number) => {
    if (index === currentVideo) return;
    
    setCurrentVideo(index);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.unloadAsync();
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialIcons name="videocam" size={20} color="#007AFF" />
        <Text style={styles.headerText}>Videos</Text>
      </View>
      
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: videos[currentVideo].url }}
          style={styles.video}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
        
        {!isPlaying && (
          <TouchableOpacity 
            style={styles.playButton}
            onPress={togglePlay}
          >
            <MaterialIcons name="play-arrow" size={50} color="white" />
          </TouchableOpacity>
        )}
        
        {isPlaying && (
          <TouchableOpacity 
            style={styles.pauseButton}
            onPress={togglePlay}
          >
            <MaterialIcons name="pause" size={50} color="white" />
          </TouchableOpacity>
        )}
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}
      </View>
      
      {videos.length > 1 && (
        <View style={styles.thumbnailsContainer}>
          {videos.map((video, index) => (
            <TouchableOpacity
              key={video.id || `video-${index}`}
              style={[
                styles.thumbnailButton,
                currentVideo === index ? styles.activeThumbnail : {}
              ]}
              onPress={() => handleVideoSelection(index)}
            >
              {video.thumbnail ? (
                <Image
                  source={{ uri: video.thumbnail }}
                  style={styles.thumbnail}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.placeholderThumbnail}>
                  <MaterialIcons name="video-library" size={24} color="#8E8E93" />
                </View>
              )}
              <View style={styles.thumbnailOverlay}>
                <MaterialIcons name="play-arrow" size={24} color="white" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
  videoContainer: {
    width: '100%',
    height: videoHeight,
    backgroundColor: 'black',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  pauseButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  thumbnailsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    marginHorizontal: -4,
  },
  thumbnailButton: {
    width: 80,
    height: 45,
    margin: 4,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  activeThumbnail: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});

export default VideoPlayer;
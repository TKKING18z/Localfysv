import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ImageProps, ActivityIndicator, ViewStyle } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;
  fallbackText?: string;
  cacheKey?: string;
  placeholderColor?: string;
  resizeWidth?: number;
  showLoading?: boolean;
}

const CachedImage: React.FC<CachedImageProps> = ({
  uri,
  fallbackText,
  cacheKey,
  placeholderColor = '#E1E1E1',
  resizeWidth,
  showLoading = false,
  style,
  ...props
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  // Generate a unique filename for the cached image
  const generateCacheFilename = async (uri: string, key?: string): Promise<string> => {
    // Create a unique hash for the image URI or the provided key
    const pathToHash = key || uri;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pathToHash
    );
    return `${FileSystem.cacheDirectory}localfy-${hash.substring(0, 12)}.jpg`;
  };

  // Handle image loading and caching
  useEffect(() => {
    if (!uri) {
      setError(true);
      return;
    }

    const loadAndCacheImage = async () => {
      try {
        setLoading(true);
        setError(false);

        // Generate the cache filename
        const cacheFilePath = await generateCacheFilename(uri, cacheKey);

        // Check if the file already exists in cache
        const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);

        if (fileInfo.exists) {
          // Use cached version
          setCachedUri(cacheFilePath);
          setLoading(false);
          return;
        }

        // Download the image
        await FileSystem.downloadAsync(uri, cacheFilePath);

        // Resize image if needed to reduce memory usage
        if (resizeWidth) {
          const manipResult = await manipulateAsync(
            cacheFilePath,
            [{ resize: { width: resizeWidth } }],
            { format: SaveFormat.JPEG, compress: 0.8 }
          );
          
          // Save the resized image back to cache
          await FileSystem.moveAsync({
            from: manipResult.uri,
            to: cacheFilePath,
          });
        }

        // Use the cached image
        setCachedUri(cacheFilePath);
      } catch (e) {
        console.error('Error caching image:', e);
        setCachedUri(uri); // Fallback to original URI
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadAndCacheImage();
  }, [uri, cacheKey, resizeWidth]);

  // Create a safe style object for View components
  const safeViewStyle = StyleSheet.flatten([
    styles.imageContainer,
    style
  ]) as ViewStyle;

  // Create a safe fallback style
  const safeFallbackStyle = StyleSheet.flatten([
    styles.fallbackContainer, 
    { backgroundColor: placeholderColor }, 
    style
  ]) as ViewStyle;

  // Show fallback view when there's an error or no URI
  if (!uri || error) {
    return (
      <View style={safeFallbackStyle}>
        <Text style={styles.fallbackText}>
          {fallbackText ? fallbackText.charAt(0).toUpperCase() : 'L'}
        </Text>
      </View>
    );
  }

  return (
    <View style={safeViewStyle}>
      {loading && showLoading && (
        <ActivityIndicator style={styles.loader} color="#007AFF" size="small" />
      )}
      
      {cachedUri && (
        <Image
          source={{ uri: cachedUri }}
          style={[styles.image, loading ? styles.imageLoading : null]}
          onError={() => setError(true)}
          {...props}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLoading: {
    opacity: 0.7,
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E1E1E1',
  },
  fallbackText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loader: {
    position: 'absolute',
    zIndex: 1,
  },
});

export default CachedImage;
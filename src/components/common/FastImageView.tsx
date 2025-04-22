import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle, StyleProp, ImageStyle, Image as RNImage, Text, Platform } from 'react-native';
import { Image } from 'expo-image';

interface FastImageViewProps {
  source: any;
  style?: StyleProp<ImageStyle>;
  placeholderColor?: string;
  showLoadingIndicator?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  containerStyle?: StyleProp<ViewStyle>;
  defaultSource?: number;
  fallbackComponent?: React.ReactNode;
  onLoad?: (event: any) => void;
  onLoadEnd?: () => void;
  onError?: () => void;
  tintColor?: string;
}

const FastImageView: React.FC<FastImageViewProps> = ({
  source,
  style,
  placeholderColor = 'transparent',
  showLoadingIndicator = false,
  resizeMode = 'cover',
  contentFit,
  containerStyle,
  defaultSource,
  fallbackComponent,
  onLoad,
  onLoadEnd,
  onError,
  tintColor,
  ...rest
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Verificar si la fuente es válida
  const isValidSource = React.useMemo(() => {
    if (typeof source === 'number') return true;
    if (!source) return false;
    
    const uri = (source as { uri?: string })?.uri;
    return !!uri && typeof uri === 'string' && uri.trim() !== '';
  }, [source]);

  // Cleanup function to prevent setting state after unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleLoadStart = useCallback(() => {
    if (isMountedRef.current) {
      setIsLoading(true);
      setHasError(false);
    }
  }, []);

  const handleLoadEnd = useCallback(() => {
    if (isMountedRef.current) {
      setIsLoading(false);
      if (onLoadEnd) onLoadEnd();
    }
  }, [onLoadEnd]);

  const handleLoad = useCallback((event: any) => {
    if (isMountedRef.current && onLoad) {
      onLoad(event);
    }
  }, [onLoad]);

  const handleError = useCallback(() => {
    if (isMountedRef.current) {
      setIsLoading(false);
      setHasError(true);
      if (onError) onError();
    }
  }, [onError]);

  // Map resizeMode to contentFit (expo-image)
  const imageContentFit = React.useMemo(() => {
    if (contentFit) return contentFit;
    
    // Map from react-native-fast-image resizeMode to expo-image contentFit
    switch (resizeMode) {
      case 'cover': return 'cover';
      case 'contain': return 'contain';
      case 'stretch': return 'fill';
      case 'center': return 'none';
      default: return 'cover';
    }
  }, [resizeMode, contentFit]);

  // Si tenemos que usar una imagen de respaldo o hay un error
  if (!isValidSource || hasError) {
    return (
      <View style={[styles.container, containerStyle, { backgroundColor: 'transparent' }]}>
        {defaultSource ? (
          <RNImage
            source={defaultSource}
            style={[styles.image, style]}
            resizeMode={resizeMode}
          />
        ) : fallbackComponent ? (
          fallbackComponent
        ) : (
          <View style={[styles.placeholderContainer, { backgroundColor: 'transparent' }]}>
            <Text style={styles.placeholderText}>!</Text>
          </View>
        )}
      </View>
    );
  }

  // Renderizar expo-image con manejo de errores
  return (
    <View style={[styles.container, containerStyle, { backgroundColor: 'transparent' }]}>
      {isLoading && showLoadingIndicator && (
        <ActivityIndicator 
          style={[styles.loader, StyleSheet.absoluteFill]}
          size="small" 
          color="#007AFF" 
        />
      )}
      
      {isMountedRef.current && (
        <Image
          source={source}
          style={[styles.image, style]}
          contentFit={imageContentFit}
          tintColor={tintColor}
          onLoadStart={handleLoadStart}
          onLoad={handleLoad}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          cachePolicy="memory-disk"
          placeholder={placeholderColor}
          transition={300}
          {...rest}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loader: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  placeholderText: {
    fontSize: 24,
    color: 'rgba(0,0,0,0.3)',
    fontWeight: 'bold',
  }
});

export default React.memo(FastImageView); 
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle, StyleProp, ImageStyle, Image as RNImage, Text, Platform } from 'react-native';
import FastImage, { FastImageProps, ImageStyle as FastImageStyle, OnLoadEvent } from 'react-native-fast-image';

interface FastImageViewProps extends Omit<FastImageProps, 'style'> {
  style?: StyleProp<ImageStyle>;
  placeholderColor?: string;
  showLoadingIndicator?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  containerStyle?: StyleProp<ViewStyle>;
  defaultSource?: number;
  fallbackComponent?: React.ReactNode;
}

const FastImageView: React.FC<FastImageViewProps> = ({
  source,
  style,
  placeholderColor = '#E1E1E1',
  showLoadingIndicator = false,
  resizeMode = 'cover',
  containerStyle,
  defaultSource,
  fallbackComponent,
  onLoad,
  onLoadEnd,
  onError,
  ...rest
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFastImageAvailable, setIsFastImageAvailable] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);
  
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
    setShouldRender(true);
    
    // Retraso minúsculo para asegurar que la referencia nativa esté lista
    const timerId = setTimeout(() => {
      if (isMountedRef.current) {
        setShouldRender(true);
      }
    }, 50);

    return () => {
      isMountedRef.current = false;
      setShouldRender(false);
      clearTimeout(timerId);
    };
  }, []);

  // Verificar disponibilidad de FastImage de forma segura
  const checkFastImageAvailability = useCallback(() => {
    try {
      // Verificar si estamos en web, donde FastImage no funciona
      if (Platform.OS === 'web') {
        return false;
      }
      
      // Verificar si FastImage existe y tiene las propiedades necesarias
      return !!(
        FastImage && 
        typeof FastImage === 'function' && 
        FastImage.resizeMode && 
        FastImage.priority
      );
    } catch (error) {
      console.warn('Error verificando disponibilidad de FastImage:', error);
      return false;
    }
  }, []);

  // Efecto para determinar si FastImage está disponible antes de renderizar
  useEffect(() => {
    let mounted = true;
    
    // Verificar si FastImage está disponible
    const isAvailable = checkFastImageAvailability();
    
    if (!isAvailable && mounted && isMountedRef.current) {
      console.warn('FastImage no está disponible correctamente, usando Image fallback');
      setIsFastImageAvailable(false);
    }
    
    return () => {
      mounted = false;
    };
  }, [checkFastImageAvailability]);

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

  const handleLoad = useCallback((event: OnLoadEvent) => {
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

  // Map resize mode to FastImage constants safely
  const fastImageResizeMode = React.useMemo(() => {
    try {
      if (!FastImage || !FastImage.resizeMode) {
        return undefined;
      }
      
      switch (resizeMode) {
        case 'cover':
          return FastImage.resizeMode.cover;
        case 'contain':
          return FastImage.resizeMode.contain;
        case 'stretch':
          return FastImage.resizeMode.stretch;
        case 'center':
          return FastImage.resizeMode.center;
        default:
          return FastImage.resizeMode.cover;
      }
    } catch (error) {
      console.error('Error accessing FastImage.resizeMode:', error);
      return undefined;
    }
  }, [resizeMode]);

  // Create source with priority safely
  const sourceWithPriority = React.useMemo(() => {
    try {
      if (typeof source === 'number') {
        return source;
      }
      
      if (isValidSource) {
        // Ensure FastImage is available before accessing its properties
        const priorityValue = FastImage?.priority?.normal || 'normal';
        const cacheValue = FastImage?.cacheControl?.immutable || 'immutable';
        
        return {
          ...source,
          priority: priorityValue,
          cache: cacheValue
        };
      }
      
      return defaultSource || { uri: '' };
    } catch (error) {
      console.error('Error creating sourceWithPriority:', error);
      return defaultSource || { uri: '' };
    }
  }, [source, isValidSource, defaultSource]);

  // Si tenemos que usar una imagen de respaldo o hay un error
  if (!isValidSource || !isFastImageAvailable || hasError || !shouldRender) {
    return (
      <View style={[styles.container, containerStyle, { backgroundColor: placeholderColor }]}>
        {defaultSource ? (
          <RNImage
            source={defaultSource}
            style={[styles.image, style]}
            resizeMode={resizeMode}
          />
        ) : fallbackComponent ? (
          fallbackComponent
        ) : (
          <View style={[styles.placeholderContainer, { backgroundColor: placeholderColor }]}>
            <Text style={styles.placeholderText}>!</Text>
          </View>
        )}
      </View>
    );
  }

  // Renderizar FastImage normalmente con manejo de errores
  return (
    <View style={[styles.container, containerStyle, { backgroundColor: placeholderColor }]}>
      {isLoading && showLoadingIndicator && (
        <ActivityIndicator 
          style={[styles.loader, StyleSheet.absoluteFill]}
          size="small" 
          color="#007AFF" 
        />
      )}
      
      {isMountedRef.current && FastImage && (
        <FastImage
          source={sourceWithPriority}
          style={[styles.image, style] as StyleProp<FastImageStyle>}
          resizeMode={fastImageResizeMode}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onLoad={handleLoad}
          onError={handleError}
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
  },
  placeholderText: {
    fontSize: 24,
    color: 'rgba(0,0,0,0.3)',
    fontWeight: 'bold',
  }
});

export default React.memo(FastImageView); 
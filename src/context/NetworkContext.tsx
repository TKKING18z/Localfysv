import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { AppState, AppStateStatus, Platform, Dimensions } from 'react-native';
import DeviceInfo from 'react-native-device-info';

interface NetworkContextValue {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
  isSlowConnection: boolean;
  isLowPerformanceDevice: boolean;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  lastUpdated: number;
  handleConnectionChange: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
  isInternetReachable: true,
  connectionType: 'unknown',
  isSlowConnection: false,
  isLowPerformanceDevice: false,
  connectionQuality: 'unknown',
  lastUpdated: Date.now(),
  handleConnectionChange: async () => {},
});

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [connectionType, setConnectionType] = useState<string | null>('unknown');
  const [isSlowConnection, setIsSlowConnection] = useState<boolean>(false);
  const [isLowPerformanceDevice, setIsLowPerformanceDevice] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>('unknown');
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  
  // Refs para evitar cálculos repetidos
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const pingStartTime = useRef<number>(0);
  const lastCheckTime = useRef<number>(0);
  const consecutiveFailures = useRef<number>(0);
  
  // Detección de dispositivo de bajo rendimiento una sola vez al inicio
  useEffect(() => {
    const detectLowPerformanceDevice = async () => {
      try {
        // Combinar múltiples factores para detectar dispositivos de gama baja
        const totalMemory = await DeviceInfo.getTotalMemory();
        const totalMemoryGB = totalMemory / (1024 * 1024 * 1024);
        const apiLevel = await DeviceInfo.getApiLevel();
        const { width, height } = Dimensions.get('window');
        const screenSize = width * height;
        
        // Criterios conservadores para considerar un dispositivo como de gama baja
        const isLowMemory = totalMemoryGB < 2.5; // Menos de 2.5GB de RAM
        const isOldAndroid = Platform.OS === 'android' && apiLevel < 26; // Anterior a Android 8
        const isOldiOS = Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) < 12;
        const isLowResolution = screenSize < 1000000; // Resolución baja (menor a HD)
        
        // Criterio: Cumplir al menos 2 de las condiciones
        const lowPerformanceScore = [isLowMemory, isOldAndroid, isOldiOS, isLowResolution].filter(Boolean).length;
        const isLowSpec = lowPerformanceScore >= 2;
        
        console.log(`[NetworkContext] Device performance assessment:
          Memory: ${totalMemoryGB.toFixed(2)}GB, 
          OS: ${Platform.OS} ${Platform.Version}, 
          API Level: ${apiLevel}, 
          Resolution: ${width}x${height}
          Is low performance: ${isLowSpec}
        `);
        
        setIsLowPerformanceDevice(isLowSpec);
      } catch (error) {
        console.error('[NetworkContext] Error detecting device performance:', error);
        // Default a false para evitar limitaciones innecesarias
        setIsLowPerformanceDevice(false);
      }
    };
    
    detectLowPerformanceDevice();
  }, []);
  
  // Medir la calidad de conexión con ping
  const measureConnectionQuality = useCallback(async () => {
    // Prevenir ejecuciones múltiples en intervalos cortos
    const now = Date.now();
    if (now - lastCheckTime.current < 10000) return;
    lastCheckTime.current = now;
    
    try {
      if (!isConnected) {
        setConnectionQuality('poor');
        return;
      }
      
      // Usar un servicio conocido para medir latencia
      pingStartTime.current = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      const pingTime = Date.now() - pingStartTime.current;
      
      // Clasificar calidad según la latencia
      let quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' = 'unknown';
      
      if (response.ok) {
        if (pingTime < 150) quality = 'excellent';
        else if (pingTime < 300) quality = 'good';
        else if (pingTime < 500) quality = 'fair';
        else quality = 'poor';
        
        consecutiveFailures.current = 0;
      } else {
        consecutiveFailures.current++;
        quality = 'poor';
      }
      
      console.log(`[NetworkContext] Connection quality: ${quality} (ping: ${pingTime}ms)`);
      setConnectionQuality(quality);
      setIsSlowConnection(quality === 'poor' || quality === 'fair');
      setLastUpdated(Date.now());
    } catch (error) {
      console.warn('[NetworkContext] Error measuring connection quality:', error);
      consecutiveFailures.current++;
      
      // Después de varios errores consecutivos, considerar la conexión como pobre
      if (consecutiveFailures.current >= 2) {
        setConnectionQuality('poor');
        setIsSlowConnection(true);
      }
      
      setLastUpdated(Date.now());
    }
  }, [isConnected]);
  
  // Check if connection is slow based on type
  const checkConnectionSpeed = useCallback((state: NetInfoState) => {
    // Consider 2G and some 3G connections as slow
    const slowTypes = ['none', 'unknown', 'cellular', '2g', '3g'];
    const isSlow = 
      !state.isConnected || 
      !state.isInternetReachable || 
      (state.type === 'cellular' && 
       slowTypes.includes(state.details?.cellularGeneration || ''));
    
    setIsSlowConnection(isSlow);
    
    // Iniciar medición de calidad si hay conectividad
    if (state.isConnected && state.isInternetReachable !== false) {
      measureConnectionQuality();
    } else {
      setConnectionQuality('poor');
    }
  }, [measureConnectionQuality]);
  
  // Handle network state changes
  const handleNetInfoChange = useCallback((state: NetInfoState) => {
    setIsConnected(state.isConnected !== null ? state.isConnected : true);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);
    checkConnectionSpeed(state);
    setLastUpdated(Date.now());
  }, [checkConnectionSpeed]);
  
  // Force network check - useful when app comes back to foreground
  const handleConnectionChange = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      handleNetInfoChange(state);
    } catch (error) {
      console.error('[NetworkContext] Error checking network state:', error);
    }
  }, [handleNetInfoChange]);
  
  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      handleConnectionChange();
      
      // Programar mediciones periódicas cuando la app está activa
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
      
      // Cada 30 segundos medimos calidad en dispositivos de gama baja
      // o cada 60 segundos en dispositivos normales
      const intervalTime = isLowPerformanceDevice ? 60000 : 30000;
      checkInterval.current = setInterval(() => {
        measureConnectionQuality();
      }, intervalTime);
    } else if (nextAppState === 'background' && checkInterval.current) {
      // Detener mediciones en segundo plano para ahorrar batería
      clearInterval(checkInterval.current);
      checkInterval.current = null;
    }
  }, [handleConnectionChange, measureConnectionQuality, isLowPerformanceDevice]);
  
  useEffect(() => {
    // Initial check
    handleConnectionChange();
    
    // Subscribe to network changes
    const unsubscribeNetInfo: NetInfoSubscription = NetInfo.addEventListener(handleNetInfoChange);
    
    // Subscribe to app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
        checkInterval.current = null;
      }
    };
  }, [handleConnectionChange, handleAppStateChange, handleNetInfoChange]);
  
  const value = {
    isConnected,
    isInternetReachable,
    connectionType,
    isSlowConnection,
    isLowPerformanceDevice,
    connectionQuality,
    lastUpdated,
    handleConnectionChange,
  };
  
  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

// Custom hook for using the network context
export const useNetwork = (): NetworkContextValue => {
  const context = useContext(NetworkContext);
  
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  
  return context;
}; 
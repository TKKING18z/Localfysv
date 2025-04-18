import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';

interface NetworkContextValue {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
  isSlowConnection: boolean;
  handleConnectionChange: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
  isInternetReachable: true,
  connectionType: 'unknown',
  isSlowConnection: false,
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
  
  // Check if connection is slow based on type
  const checkConnectionSpeed = (state: NetInfoState) => {
    // Consider 2G and some 3G connections as slow
    const slowTypes = ['none', 'unknown', 'cellular', '2g', '3g'];
    const isSlow = 
      !state.isConnected || 
      !state.isInternetReachable || 
      (state.type === 'cellular' && 
       slowTypes.includes(state.details?.cellularGeneration || ''));
    
    setIsSlowConnection(isSlow);
  };
  
  // Handle network state changes
  const handleNetInfoChange = (state: NetInfoState) => {
    setIsConnected(state.isConnected !== null ? state.isConnected : true);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);
    checkConnectionSpeed(state);
  };
  
  // Force network check - useful when app comes back to foreground
  const handleConnectionChange = async () => {
    try {
      const state = await NetInfo.fetch();
      handleNetInfoChange(state);
    } catch (error) {
      console.error('Error checking network state:', error);
    }
  };
  
  // Handle app state changes
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      handleConnectionChange();
    }
  };
  
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
    };
  }, []);
  
  const value = {
    isConnected,
    isInternetReachable,
    connectionType,
    isSlowConnection,
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
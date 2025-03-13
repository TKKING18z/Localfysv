import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';

interface StoreContextType {
  callbacks: Record<string, any>;
  setCallback: (key: string, callback: any) => void;
  getCallback: (key: string) => any;
  removeCallback: (key: string) => void; // Añadimos función para limpiar callbacks
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [callbacks, setCallbacks] = useState<Record<string, any>>({});

  // Añadir logging para depuración
  useEffect(() => {
    console.log('StoreContext - Current callbacks:', Object.keys(callbacks));
  }, [callbacks]);

  const setCallback = (key: string, callback: any) => {
    console.log(`StoreContext - Setting callback with key: ${key}`);
    if (typeof callback !== 'function') {
      console.warn(`StoreContext - Attempted to set non-function callback for key: ${key}`);
      return;
    }
    
    setCallbacks(prev => ({
      ...prev,
      [key]: callback
    }));
  };

  const getCallback = (key: string) => {
    const callback = callbacks[key];
    console.log(`StoreContext - Getting callback with key: ${key}, exists: ${!!callback}`);
    
    if (!callback) {
      console.warn(`StoreContext - No callback found for key: ${key}`);
    }
    
    return callback;
  };

  const removeCallback = (key: string) => {
    console.log(`StoreContext - Removing callback with key: ${key}`);
    setCallbacks(prev => {
      const newCallbacks = { ...prev };
      delete newCallbacks[key];
      return newCallbacks;
    });
  };

  return (
    <StoreContext.Provider value={{ callbacks, setCallback, getCallback, removeCallback }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
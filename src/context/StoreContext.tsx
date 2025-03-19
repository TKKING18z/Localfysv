import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';

// Tipo para cualquier callback que pueda ser almacenado
type StoreCallback = (...args: any[]) => any;

interface StoreContextType {
  setCallback: (key: string, callback: StoreCallback) => void;
  getCallback: (key: string) => StoreCallback | undefined;
  removeCallback: (key: string) => void;
  getCallbackIds: () => string[];
  setTempData: (key: string, data: any) => void;
  getTempData: (key: string) => any;
  removeTempData: (key: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [callbacks, setCallbacks] = useState<Record<string, StoreCallback>>({});
  const [tempData, setTempDataState] = useState<Record<string, any>>({});

  // Método para logear los callbacks para depuración
  useEffect(() => {
    console.log('StoreContext - Current callbacks:', Object.keys(callbacks));
  }, [callbacks]);

  // Método para establecer un callback
  const setCallback = (key: string, callback: StoreCallback) => {
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

  // Método para obtener un callback
  const getCallback = (key: string): StoreCallback | undefined => {
    const callback = callbacks[key];
    const exists = !!callback;
    
    console.log(`StoreContext - Getting callback with key: ${key}, exists: ${exists}`);
    
    if (!exists) {
      console.warn(`StoreContext - No callback found for key: ${key}`);
    }
    
    return callback;
  };

  // Método para eliminar un callback
  const removeCallback = (key: string) => {
    console.log(`StoreContext - Removing callback with key: ${key}`);
    
    setCallbacks(prev => {
      const newCallbacks = { ...prev };
      delete newCallbacks[key];
      return newCallbacks;
    });
  };

  // Método para obtener todos los IDs de callbacks
  const getCallbackIds = (): string[] => {
    return Object.keys(callbacks);
  };

  // Métodos para manejar datos temporales
  const setTempData = (key: string, data: any) => {
    setTempDataState(prev => ({
      ...prev,
      [key]: data
    }));
  };

  const getTempData = (key: string) => {
    return tempData[key];
  };

  const removeTempData = (key: string) => {
    setTempDataState(prev => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });
  };

  // Valor del contexto
  const contextValue: StoreContextType = {
    setCallback,
    getCallback,
    removeCallback,
    getCallbackIds,
    setTempData,
    getTempData,
    removeTempData
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
};

// Hook personalizado para utilizar el StoreContext
export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore debe ser usado dentro de un StoreProvider');
  }
  return context;
};
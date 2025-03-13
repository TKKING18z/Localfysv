import React, { createContext, useState, ReactNode, useContext } from 'react';

interface StoreContextType {
  callbacks: Record<string, any>;
  setCallback: (key: string, callback: any) => void;
  getCallback: (key: string) => any;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [callbacks, setCallbacks] = useState<Record<string, any>>({});

  const setCallback = (key: string, callback: any) => {
    setCallbacks(prev => ({
      ...prev,
      [key]: callback
    }));
  };

  const getCallback = (key: string) => {
    return callbacks[key];
  };

  return (
    <StoreContext.Provider value={{ callbacks, setCallback, getCallback }}>
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
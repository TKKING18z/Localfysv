import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define theme colors and properties
interface Theme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

// Default light theme
const lightTheme: Theme = {
  primaryColor: '#3498db',
  secondaryColor: '#2ecc71',
  backgroundColor: '#F5F7FF',
  textColor: '#333333',
  accentColor: '#e74c3c',
};

// Default dark theme
const darkTheme: Theme = {
  primaryColor: '#2980b9',
  secondaryColor: '#27ae60',
  backgroundColor: '#121212',
  textColor: '#FFFFFF',
  accentColor: '#c0392b',
};

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

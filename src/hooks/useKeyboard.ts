import { useState, useEffect } from 'react';
import { Keyboard, KeyboardEventListener, Platform, EmitterSubscription, Dimensions, NativeModules, StatusBar } from 'react-native';

// Get device info to detect iPhone models with notch/dynamic island
const { StatusBarManager } = NativeModules;

export default function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  const [statusBarHeight, setStatusBarHeight] = useState<number>(Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0);
  
  // Determine if this is a modern iPhone (X or newer) based on dimensions and notch
  const isModernIphone = Platform.OS === 'ios' && 
    ((screenHeight / screenWidth > 2) || // Modern iPhones have taller aspect ratios
     statusBarHeight > 20); // Larger status bar indicates notch/dynamic island
  
  useEffect(() => {
    // Get accurate status bar height on iOS
    if (Platform.OS === 'ios' && StatusBarManager.getHeight) {
      StatusBarManager.getHeight((statusBarFrameData: { height: number }) => {
        setStatusBarHeight(statusBarFrameData.height);
      });
    }
    
    const subscriptions: EmitterSubscription[] = [];
    
    if (Platform.OS === 'ios') {
      // iOS can use WillShow/WillHide for more responsive UI
      const keyboardWillShow = (e: any) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        setKeyboardVisible(true);
      };
      
      const keyboardWillHide = () => {
        setKeyboardHeight(0);
        setKeyboardVisible(false);
      };
      
      // Additional listeners to ensure we're catching keyboard show/hide
      const keyboardDidShow = (e: any) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        setKeyboardVisible(true);
      };
      
      subscriptions.push(
        Keyboard.addListener('keyboardWillShow', keyboardWillShow),
        Keyboard.addListener('keyboardWillHide', keyboardWillHide),
        Keyboard.addListener('keyboardDidShow', keyboardDidShow) // Backup listener
      );
    } else {
      // Android requires DidShow/DidHide events
      const keyboardDidShow = (e: any) => {
        // On some Android devices, reported height can be incorrect
        // We limit it to a reasonable percentage of screen height
        const height = Math.min(e.endCoordinates.height, screenHeight * 0.6);
        setKeyboardHeight(height);
        setKeyboardVisible(true);
      };
      
      const keyboardDidHide = () => {
        setKeyboardHeight(0);
        setKeyboardVisible(false);
      };
      
      subscriptions.push(
        Keyboard.addListener('keyboardDidShow', keyboardDidShow),
        Keyboard.addListener('keyboardDidHide', keyboardDidHide)
      );
      
      // On Android, we also check if keyboard is already visible when component mounts
      // This helps with devices that might not trigger keyboard events properly
      setTimeout(() => {
        // Fix: Keyboard.isVisible() returns a boolean directly
        const isKeyboardVisible = Keyboard.isVisible();
        
        if (isKeyboardVisible) {
          setKeyboardVisible(true);
          setKeyboardHeight(screenHeight * 0.4); // Approximate 40% of screen height
        }
      }, 100);
    }
    
    return () => {
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, [screenHeight]);

  // Calculate the safe bottom padding with enhanced logic for modern iPhones
  const safeBottomPadding = Platform.OS === 'ios' ? 
    (keyboardVisible ? 
      (isModernIphone ? 
        // Enhanced padding for modern iPhones (iPhone X and newer)
        Math.max(34, keyboardHeight * 0.08) : 
        // Standard padding for older iPhones
        Math.max(10, keyboardHeight * 0.05)
      ) : 
      // Default padding when keyboard is hidden (provides space for home indicator on iPhone X+)
      (isModernIphone ? 34 : 0)
    ) : 
    0; // On Android we handle this differently

  return {
    keyboardHeight,
    keyboardVisible,
    visibleAreaHeight: screenHeight - keyboardHeight,
    safeBottomPadding,
    isModernIphone // Export this info to be used elsewhere if needed
  };
}

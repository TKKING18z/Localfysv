import { useState, useEffect } from 'react';
import { Keyboard, Platform, EmitterSubscription, Dimensions, NativeModules, StatusBar } from 'react-native';

const { StatusBarManager } = NativeModules;

export default function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  const [statusBarHeight, setStatusBarHeight] = useState<number>(Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0);
  
  // Determine if this is a modern iPhone (X or newer) based on dimensions and notch
  const isModernIphone = Platform.OS === 'ios' && 
    ((screenHeight / screenWidth > 2) || 
     statusBarHeight > 20);
  
  useEffect(() => {
    // Get accurate status bar height on iOS
    if (Platform.OS === 'ios' && StatusBarManager.getHeight) {
      StatusBarManager.getHeight((statusBarFrameData: { height: number }) => {
        setStatusBarHeight(statusBarFrameData.height);
      });
    }
    
    const subscriptions: EmitterSubscription[] = [];
    
    if (Platform.OS === 'ios') {
      const keyboardWillShow = (e: any) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        setKeyboardVisible(true);
      };
      
      const keyboardWillHide = () => {
        setKeyboardHeight(0);
        setKeyboardVisible(false);
      };
      
      const keyboardDidShow = (e: any) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        setKeyboardVisible(true);
      };
      
      subscriptions.push(
        Keyboard.addListener('keyboardWillShow', keyboardWillShow),
        Keyboard.addListener('keyboardWillHide', keyboardWillHide),
        Keyboard.addListener('keyboardDidShow', keyboardDidShow)
      );
    } else {
      const keyboardDidShow = (e: any) => {
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
      
      setTimeout(() => {
        const isKeyboardVisible = Keyboard.isVisible();
        
        if (isKeyboardVisible) {
          setKeyboardVisible(true);
          setKeyboardHeight(screenHeight * 0.4);
        }
      }, 100);
    }
    
    return () => {
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, [screenHeight]);

  // Simplified safe bottom padding calculation
  const safeBottomPadding = Platform.OS === 'ios' ? 
    (isModernIphone ? (keyboardVisible ? 0 : 34) : 0) : 0;

  return {
    keyboardHeight,
    keyboardVisible,
    visibleAreaHeight: screenHeight - keyboardHeight,
    safeBottomPadding,
    isModernIphone
  };
}
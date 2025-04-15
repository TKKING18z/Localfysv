// src/screens/onboarding/NextButton.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AntDesign } from '@expo/vector-icons';

interface NextButtonProps {
  percentage: number;
  onPress: () => void;
  disabled?: boolean;
}

const NextButton: React.FC<NextButtonProps> = ({ percentage, onPress, disabled = false }) => {
  const size = 128;
  const strokeWidth = 2;
  const center = size / 2;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<View>(null);
  
  const animation = (toValue: number) => {
    return Animated.timing(progressAnimation, {
      toValue,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };
  
  useEffect(() => {
    animation(percentage);
  }, [percentage]);
  
  const strokeDashoffset = progressAnimation.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });
  
  return (
    <View style={styles.container}>
      <View style={styles.circleOutlineContainer}>
        <View style={styles.circleOutline} />
        <Animated.View
          ref={progressRef}
          style={[
            styles.progress,
            {
              transform: [
                {
                  rotateZ: '270deg',
                },
              ],
            },
          ]}
        />
      </View>
      <TouchableOpacity 
        onPress={onPress} 
        style={[
          styles.button,
          disabled && styles.buttonDisabled
        ]}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <AntDesign name="arrowright" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  circleOutlineContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleOutline: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    position: 'absolute',
  },
  progress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#007AFF',
    position: 'absolute',
  },
  button: {
    position: 'absolute',
    backgroundColor: '#007AFF',
    borderRadius: 32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#A0C2F0',
    shadowOpacity: 0.1,
  },
});

export default NextButton;
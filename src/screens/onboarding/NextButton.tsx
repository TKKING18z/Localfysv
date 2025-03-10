// src/screens/onboarding/NextButton.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AntDesign } from '@expo/vector-icons';

interface NextButtonProps {
  percentage: number;
  onPress: () => void;
}

const NextButton: React.FC<NextButtonProps> = ({ percentage, onPress }) => {
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
      <TouchableOpacity onPress={onPress} style={styles.button}>
        <AntDesign name="arrowright" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderColor: '#ddd',
    position: 'absolute',
  },
  progress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#4A55A2',
    position: 'absolute',
  },
  button: {
    position: 'absolute',
    backgroundColor: '#4A55A2',
    borderRadius: 32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NextButton;
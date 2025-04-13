// src/screens/onboarding/NextButton.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import Svg, { G, Circle } from 'react-native-svg';

interface NextButtonProps {
  percentage: number;
  onPress: () => void;
}

const NextButton: React.FC<NextButtonProps> = ({ percentage, onPress }) => {
  const size = 80;
  const strokeWidth = 2;
  const center = size / 2;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<any>(null);
  
  const animation = (toValue: number) => {
    return Animated.timing(progressAnimation, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };
  
  useEffect(() => {
    animation(percentage);
  }, [percentage]);
  
  const AnimatedCircle = Animated.createAnimatedComponent(Circle);
  
  const strokeDashoffset = progressAnimation.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });
  
  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={center}>
          <Circle
            stroke="#E6E7E8"
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
          />
          <AnimatedCircle
            ref={progressRef}
            stroke="#4A55A2"
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <TouchableOpacity onPress={onPress} style={styles.button} activeOpacity={0.7}>
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
  button: {
    position: 'absolute',
    backgroundColor: '#4A55A2',
    borderRadius: 32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});

export default NextButton;
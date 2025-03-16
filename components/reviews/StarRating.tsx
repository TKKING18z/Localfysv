import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface StarRatingProps {
  rating?: number;
  size?: number;
  maxStars?: number;
  editable?: boolean;
  onRatingChange?: (rating: number) => void;
  containerStyle?: object;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating = 0,
  size = 24,
  maxStars = 5,
  editable = false,
  onRatingChange,
  containerStyle,
}) => {
  // Array for animations
  const starAnimations = React.useRef(Array(maxStars).fill(0).map(() => new Animated.Value(1))).current;

  // Animate stars when rating changes
  useEffect(() => {
    if (rating > 0) {
      // Animate the filled stars
      for (let i = 0; i < rating; i++) {
        Animated.sequence([
          Animated.timing(starAnimations[i], {
            toValue: 1.5,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(starAnimations[i], {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [rating, starAnimations]);

  const handlePress = (index: number) => {
    if (editable && onRatingChange) {
      // Animate the pressed star
      Animated.sequence([
        Animated.timing(starAnimations[index], {
          toValue: 1.5,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(starAnimations[index], {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      
      onRatingChange(index + 1);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {Array.from({ length: maxStars }).map((_, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => handlePress(index)}
          activeOpacity={editable ? 0.7 : 1}
        >
          <Animated.View style={{ transform: [{ scale: starAnimations[index] }] }}>
            <MaterialIcons
              name={index < rating ? 'star' : 'star-border'}
              size={size}
              color={index < rating ? colors.primary : colors.grey}
            />
          </Animated.View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default StarRating;
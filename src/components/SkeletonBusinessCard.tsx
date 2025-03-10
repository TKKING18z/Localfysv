import React from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 columns with padding

const SkeletonBusinessCard: React.FC = () => {
  // Create animated value for the shimmer effect
  const shimmerValue = new Animated.Value(0);

  // Start animation when component mounts
  React.useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
    };
  }, [shimmerValue]);

  // Interpolate for the shimmer gradient
  const shimmer = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(240,240,240,0.5)', 'rgba(255,255,255,0.8)']
  });

  // Use animated value to create the shimmer effect with proper types
  const shimmerStyle = {
    position: 'absolute' as 'absolute',
    top: 0,
    left: 0,
    width: '100%' as const,
    height: '100%' as const,
    backgroundColor: shimmer,
  };

  return (
    <View style={styles.container}>
      {/* Skeleton image */}
      <View style={styles.imageContainer}>
        <View style={styles.image} />
        <Animated.View style={shimmerStyle} />
      </View>

      {/* Skeleton text */}
      <View style={styles.infoContainer}>
        <View style={styles.titleSkeleton}>
          <Animated.View style={shimmerStyle} />
        </View>
        <View style={styles.categorySkeleton}>
          <Animated.View style={shimmerStyle} />
        </View>
        <View style={styles.distanceSkeleton}>
          <Animated.View style={shimmerStyle} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: cardWidth,
    borderRadius: 16,
    backgroundColor: 'white',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  imageContainer: {
    height: cardWidth * 0.8,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    backgroundColor: '#E1E1E1',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  infoContainer: {
    padding: 12,
  },
  titleSkeleton: {
    height: 16,
    width: '80%',
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  categorySkeleton: {
    height: 12,
    width: '50%',
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  distanceSkeleton: {
    height: 12,
    width: '30%',
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
    overflow: 'hidden',
  },
});

export default SkeletonBusinessCard;

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 columns with margins

const SkeletonBusinessCard: React.FC = () => {
  const opacityAnimation = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnimation, {
          toValue: 0.6,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnimation, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    
    animation.start();
    
    return () => {
      animation.stop();
    };
  }, [opacityAnimation]);

  return (
    <View style={styles.card}>
      <Animated.View style={[
        styles.image,
        { opacity: opacityAnimation }
      ]} />
      <View style={styles.infoContainer}>
        <Animated.View style={[
          styles.title,
          { opacity: opacityAnimation }
        ]} />
        <Animated.View style={[
          styles.category,
          { opacity: opacityAnimation }
        ]} />
        <Animated.View style={[
          styles.rating,
          { opacity: opacityAnimation }
        ]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: '#E0E0E0',
  },
  infoContainer: {
    padding: 12,
  },
  title: {
    height: 18,
    width: '80%',
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  category: {
    height: 12,
    width: '50%',
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  rating: {
    height: 12,
    width: '30%',
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
});

export default SkeletonBusinessCard;

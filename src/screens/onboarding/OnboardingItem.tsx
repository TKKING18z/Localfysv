// src/screens/onboarding/OnboardingItem.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native';

interface OnboardingItemProps {
  item: {
    id: string;
    title: string;
    description: string;
    image: any;
  };
}

const OnboardingItem: React.FC<OnboardingItemProps> = ({ item }) => {
  const { width } = useWindowDimensions();
  
  return (
    <View style={[styles.container, { width }]}>
      <Image 
        source={item.image} 
        style={[styles.image, { width: width * 0.8, resizeMode: 'contain' }]}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  image: {
    flex: 0.6,
    justifyContent: 'center',
    height: 300,
  },
  content: {
    flex: 0.4,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 28,
    marginBottom: 10,
    color: '#4A55A2',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#62656b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default OnboardingItem;
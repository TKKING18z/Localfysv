import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

// Navigation type
type AddBusinessScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddBusiness'>;

/**
 * AddBusinessScreen
 * This screen now serves as a redirect to the new business onboarding flow.
 * It displays a loading spinner briefly before navigating to the BusinessOnboardingWelcome screen.
 */
const AddBusinessScreen: React.FC = () => {
  const navigation = useNavigation<AddBusinessScreenNavigationProp>();
  
  // Immediately redirect to the new onboarding flow
  useEffect(() => {
    // Add a small delay to show the loading indicator 
    // (makes the transition feel more intentional)
    const timer = setTimeout(() => {
      navigation.replace('BusinessOnboardingWelcome');
    }, 500);
    
    return () => clearTimeout(timer);
  }, [navigation]);
  
  // Show a loading spinner while redirecting
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default AddBusinessScreen;


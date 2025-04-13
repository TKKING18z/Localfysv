import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ProgressIndicatorProps {
  isLoading: boolean;
  uploadProgress: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  isLoading,
  uploadProgress
}) => {
  if (!isLoading) return null;
  
  return (
    <View style={styles.progressContainer}>
      <Text style={styles.progressText}>
        Subiendo información: {uploadProgress.toFixed(0)}%
      </Text>
      <View style={styles.progressBarContainer}>
        <View 
          style={[
            styles.progressBar, 
            {width: `${uploadProgress}%`}
          ]} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  progressContainer: {
    marginVertical: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E7FF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007aff',
    borderRadius: 4,
  },
});

export default ProgressIndicator; 
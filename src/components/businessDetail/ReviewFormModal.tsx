import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ReviewForm from '../../../components/reviews/ReviewForm';

interface ReviewFormModalProps {
  showReviewForm: boolean;
  businessId: string;
  businessName: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ReviewFormModal: React.FC<ReviewFormModalProps> = ({
  showReviewForm,
  businessId,
  businessName,
  userId,
  userName,
  userPhotoURL,
  onClose,
  onSuccess,
}) => {
  if (!showReviewForm) return null;

  return (
    <View style={[styles.reviewFormOverlay, { zIndex: 2000 }]}>
      <TouchableOpacity 
        style={styles.reviewFormBackdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <View style={[styles.reviewFormContainer]}>
        <View style={styles.reviewFormHeader}>
          <Text style={styles.reviewFormTitle}>Añadir Reseña</Text>
          <TouchableOpacity 
            onPress={onClose}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <MaterialIcons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        {/* ReviewForm */}
        <ReviewForm
          businessId={businessId}
          businessName={businessName}
          userId={userId}
          userName={userName}
          userPhotoURL={userPhotoURL}
          onSuccess={() => {
            onClose();
            onSuccess();
          }}
          onCancel={onClose}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  reviewFormOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewFormBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  reviewFormContainer: {
    width: '95%',
    height: '90%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  reviewFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  reviewFormTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
});

export default ReviewFormModal; 
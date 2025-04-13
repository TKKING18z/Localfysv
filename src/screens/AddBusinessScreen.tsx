import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useStore } from '../context/StoreContext';

// Hooks
import useAddBusiness, { CALLBACK_IDS } from '../hooks/business/useAddBusiness';

// Components
import BasicInfoSection from '../components/addBusiness/BasicInfoSection';
import ContactInfoSection from '../components/addBusiness/ContactInfoSection';
import AdvancedSettingsSection from '../components/addBusiness/AdvancedSettingsSection';
import ReservationSection from '../components/addBusiness/ReservationSection';
import ImagePickerSection from '../components/addBusiness/ImagePickerSection';
import LocationMapModal from '../components/addBusiness/LocationMapModal';
import ProgressIndicator from '../components/addBusiness/ProgressIndicator';

// Navigation type
type AddBusinessScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddBusiness'>;

const AddBusinessScreen: React.FC = () => {
  const navigation = useNavigation<AddBusinessScreenNavigationProp>();
  const store = useStore();
  
  const {
    formState,
    setField,
    locationHandlers,
    categorySuggestions,
    formFunctions,
    reservationHandlers,
    forceRender,
    setForceRender
  } = useAddBusiness();
  
  // Extract parameters from hooks
  const { 
    mapVisible, mapRegion, markerLocation, 
    getCurrentLocation, openLocationPicker, handleMapPress,
    confirmLocationSelection, centerMapOnCurrentLocation, setMapVisible
  } = locationHandlers;
  
  const {
    suggestedCategories,
    showSuggestions,
    updateCategorySuggestions,
    selectCategory
  } = categorySuggestions;
  
  const {
    validatePhone,
    validateForm,
    handleSubmit,
    pickImage,
    handleNameChange,
    handleDescriptionChange,
    handlePhoneChange
  } = formFunctions;
  
  const {
    reservationSettings,
    hasPromotions
  } = reservationHandlers;
  
  // Handle back button to prevent accidental navigation away
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (formState.hasUnsavedChanges) {
          Alert.alert(
            "Cambios sin guardar",
            "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?",
            [
              { text: "Cancelar", style: "cancel", onPress: () => {} },
              { text: "Descartar cambios", style: "destructive", onPress: () => navigation.goBack() }
            ]
          );
          return true; // Prevent default behavior
        } else {
          return false; // Let default behavior happen
        }
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [formState.hasUnsavedChanges, navigation])
  );

  // Check for existing promotions only once when the screen gets focus
  // FIX: Remove the continuous re-render that was causing infinite logs
  useFocusEffect(
    useCallback(() => {
      // Only force a single re-render when the screen is focused
      // This avoids the continuous loop of re-renders
      const timeoutId = setTimeout(() => {
        setForceRender(Date.now());
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }, [])
  );

  // Navigation functions
  const navigateToBusinessHours = () => {
    try {
      navigation.navigate('BusinessHours', {
        initialHours: formState.businessHours,
        callbackId: CALLBACK_IDS.BUSINESS_HOURS
      });
    } catch (error) {
      console.error('Error navegando a BusinessHours:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de horarios. Intente nuevamente.');
    }
  };

  const navigateToPaymentMethods = () => {
    try {
      navigation.navigate('PaymentMethods', {
        initialMethods: formState.paymentMethods,
        callbackId: CALLBACK_IDS.PAYMENT_METHODS
      });
    } catch (error) {
      console.error('Error navegando a PaymentMethods:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de métodos de pago. Intente nuevamente.');
    }
  };

  const navigateToSocialLinks = () => {
    try {
      navigation.navigate('SocialLinks', {
        initialLinks: formState.socialLinks,
        callbackId: CALLBACK_IDS.SOCIAL_LINKS
      });
    } catch (error) {
      console.error('Error navegando a SocialLinks:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de redes sociales. Intente nuevamente.');
    }
  };

  const navigateToMenuEditor = () => {
    try {
      navigation.navigate('MenuEditor', {
        businessId: 'new_business',
        initialMenu: formState.menu,
        menuUrl: formState.menuUrl,
        callbackId: CALLBACK_IDS.MENU_EDITOR
      });
    } catch (error) {
      console.error('Error navegando a MenuEditor:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de menú. Intente nuevamente.');
    }
  };

  // Navigate to reservations and promotions screens safely
  const navigateToReservations = () => {
    try {
      // Save current settings in the store so they're available for the reservations screen
      store.setTempData('tempReservationSettings', reservationSettings);
      
      navigation.navigate('Reservations', {
        businessId: 'new_business',
        businessName: formState.name || 'Nuevo Negocio',
        isNewBusiness: true
      });
    } catch (error) {
      console.error('Error navegando a Reservations:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de reservaciones. Intente nuevamente.');
    }
  };

  const navigateToPromotions = () => {
    try {
      navigation.navigate('Promotions', {
        businessId: 'new_business',
        businessName: formState.name || 'Nuevo Negocio',
        isNewBusiness: true
      });
    } catch (error) {
      console.error('Error navegando a Promotions:', error);
      Alert.alert('Error', 'No se pudo abrir la pantalla de promociones. Intente nuevamente.');
    }
  };

  // Handle back navigation with unsaved changes check
  const handleBackNavigation = () => {
    if (formState.hasUnsavedChanges) {
      Alert.alert(
        "Cambios sin guardar",
        "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Descartar cambios", style: "destructive", onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Handler for setting address from TextInput
  const handleAddressChange = (text: string) => {
    setField('address', text);
  };

  // Handler for setting form fields with boolean values
  const setAcceptsReservations = (value: boolean) => {
    setField('acceptsReservations', value);
  };

  const setAllowsPromotions = (value: boolean) => {
    setField('allowsPromotions', value);
  };

  // Handler for form submission with navigation back on success
  const handleFormSubmit = async () => {
    const businessId = await handleSubmit();
    if (businessId) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBackNavigation}
              accessibilityLabel="Volver atrás"
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Agregar Negocio</Text>
            <View style={styles.placeholder}></View>
          </View>
          
          {/* Form content */}
          <View style={styles.form}>
            {/* Basic Information */}
            <BasicInfoSection 
              formState={formState} 
              suggestedCategories={suggestedCategories}
              showSuggestions={showSuggestions}
              handleNameChange={handleNameChange}
              handleDescriptionChange={handleDescriptionChange}
              updateCategorySuggestions={updateCategorySuggestions}
              selectCategory={selectCategory}
            />
            
            {/* Contact Information */}
            <ContactInfoSection 
              formState={formState}
              handlePhoneChange={handlePhoneChange}
              openLocationPicker={openLocationPicker}
              setAddress={handleAddressChange}
            />
            
            {/* Advanced Settings */}
            <AdvancedSettingsSection 
              formState={formState}
              navigateToBusinessHours={navigateToBusinessHours}
              navigateToPaymentMethods={navigateToPaymentMethods}
              navigateToSocialLinks={navigateToSocialLinks}
              navigateToMenuEditor={navigateToMenuEditor}
            />

            {/* Reservation and Promotions Section */}
            <ReservationSection 
              formState={formState}
              setAcceptsReservations={setAcceptsReservations}
              setAllowsPromotions={setAllowsPromotions}
              navigateToReservations={navigateToReservations}
              navigateToPromotions={navigateToPromotions}
              hasPromotions={hasPromotions}
              forceRender={forceRender}
            />
            
            {/* Image Picker */}
            <ImagePickerSection 
              formState={formState}
              pickImage={pickImage}
            />

            {/* Progress Indicator */}
            <ProgressIndicator 
              isLoading={formState.isLoading}
              uploadProgress={formState.uploadProgress}
            />
          </View>
          
          {/* Submit Button */}
          <TouchableOpacity 
            style={[
              styles.submitButton,
              formState.isLoading ? styles.submitButtonDisabled : {}
            ]} 
            onPress={handleFormSubmit}
            disabled={formState.isLoading}
          >
            {formState.isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="business" size={24} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Guardar Negocio</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Map Modal */}
      <LocationMapModal 
        visible={mapVisible}
        mapRegion={mapRegion}
        markerLocation={markerLocation}
        handleMapPress={handleMapPress}
        confirmLocationSelection={confirmLocationSelection}
        centerMapOnCurrentLocation={centerMapOnCurrentLocation}
        closeModal={() => setMapVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  scrollContent: {
    paddingBottom: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#007aff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  form: {
    padding: 16,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#007aff',
    borderRadius: 14,
    padding: 18,
    margin: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#7FB5FF',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default AddBusinessScreen;


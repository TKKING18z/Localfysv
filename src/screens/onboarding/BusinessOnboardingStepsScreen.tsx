import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useBusinessOnboarding } from '../../context/BusinessOnboardingContext';

// Step components
import BasicInfoStep from './steps/BasicInfoStep';
import VisualProfileStep from './steps/VisualProfileStep';
import ValuePropositionStep from './steps/ValuePropositionStep';
import MenuManagementStep from './steps/MenuManagementStep';
import BusinessOperationsStep from './steps/BusinessOperationsStep';
import DigitalPresenceStep from './steps/DigitalPresenceStep';

type BusinessOnboardingStepsScreenNavigationProp = StackNavigationProp<
  RootStackParamList, 
  'BusinessOnboardingSteps'
>;

const BusinessOnboardingStepsScreen: React.FC = () => {
  const navigation = useNavigation<BusinessOnboardingStepsScreenNavigationProp>();
  const { 
    formState, 
    currentStep, 
    totalSteps, 
    nextStep, 
    prevStep, 
    validateCurrentStep,
    finishOnboarding,
    progress,
    isSaving,
    lastSaved,
    saveProgress,
    onboardingMode,
    markStepComplete
  } = useBusinessOnboarding();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Handle back button
  const handleBack = () => {
    if (currentStep === 1) {
      // First step, go back to mode selection
      Alert.alert(
        "¿Deseas cancelar?",
        "Perderás tu progreso actual si sales ahora. ¿Estás seguro?",
        [
          { text: "Continuar editando", style: "cancel" },
          { 
            text: "Salir sin guardar", 
            style: "destructive", 
            onPress: () => navigation.goBack()
          }
        ]
      );
    } else {
      // Go to previous step
      prevStep();
    }
  };
  
  // Manual save current step (for fixing sync issues)
  const handleManualSave = async () => {
    console.log("Manual save requested");
    
    // Force save and provide feedback
    const saved = await saveProgress();
    
    if (saved) {
      // Log what was saved to help diagnose
      console.log("Manual save successful, saved form state:", JSON.stringify(formState));
      
      Alert.alert(
        "Datos guardados",
        "Tus datos han sido guardados exitosamente. Intenta continuar ahora.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Error al guardar",
        "No se pudo guardar tu progreso. Por favor verifica tu conexión a internet."
      );
    }
  };
  
  // Handle continue button with improved error handling
  const handleContinue = async () => {
    // Special handling for the first step (BasicInfoStep)
    if (currentStep === 1) {
      // Save progress first
      await saveProgress();
      
      // Check if all required fields are present
      const hasName = formState.name && formState.name.trim() !== '';
      const hasCategory = formState.category && formState.category.trim() !== '';
      const hasPhone = formState.phone && formState.phone.trim() !== '';
      const hasLocation = formState.location && 
                        typeof formState.location === 'object' && 
                        'latitude' in formState.location && 
                        'longitude' in formState.location;
      
      // If all required fields are present, mark step as complete and proceed
      if (hasName && hasCategory && hasPhone && hasLocation) {
        // Mark the step as complete
        markStepComplete('basicInfo');
        
        // Proceed to next step directly
        nextStep();
        return;
      } else {
        // Show missing fields error
        const missingFields = [];
        if (!hasName) missingFields.push("Nombre del negocio");
        if (!hasCategory) missingFields.push("Categoría");
        if (!hasPhone) missingFields.push("Teléfono");
        if (!hasLocation) missingFields.push("Ubicación");
        
        Alert.alert(
          "Campos incompletos",
          `Por favor completa los siguientes campos:\n• ${missingFields.join('\n• ')}`,
          [{ text: "Entendido" }]
        );
        return;
      }
    }
    
    // Handle step 2 (Visual Profile) manually
    if (currentStep === 2) {
      await saveProgress(); // Save current progress
      
      // Check if image is present
      if (!formState.image) {
        Alert.alert(
          "Imagen requerida",
          "Por favor selecciona una imagen para tu negocio antes de continuar.",
          [{ text: "Entendido" }]
        );
        return;
      }
      
      // Mark step as complete and proceed
      markStepComplete('visualProfile');
      nextStep();
      return;
    }
    
    // Handle step 3 (Value Proposition) manually
    if (currentStep === 3) {
      await saveProgress(); // Save current progress
      
      // Check if description is present
      if (!formState.description || formState.description.trim().length < 20) {
        Alert.alert(
          "Descripción requerida",
          "Por favor ingresa una descripción de al menos 20 caracteres antes de continuar.",
          [{ text: "Entendido" }]
        );
        return;
      }
      
      // Mark step as complete and proceed
      markStepComplete('valueProposition');
      nextStep();
      return;
    }
    
    // Handle step 4 (Menu Management) manually
    if (currentStep === 4) {
      await saveProgress(); // Save current progress
      
      // El menú es opcional, así que siempre podemos continuar
      // Pero si hay menú, marcamos el paso como completado
      if ((formState.menu && formState.menu.length > 0) || 
          (formState.menuUrl && formState.menuUrl.trim() !== '')) {
        markStepComplete('menuManagement');
      }
      
      // Continuar al siguiente paso
      nextStep();
      return;
    }
    
    // For other steps, use normal validation or allow skipping in express mode
    if (onboardingMode === 'express' && currentStep > 3) {
      // In express mode, mark step as complete and proceed for optional steps
      if (currentStep === 5) {
        markStepComplete('businessOperations');
      } else if (currentStep === 6) {
        markStepComplete('digitalPresence');
      }
      
      // If this is the last step, finish the onboarding
      if (currentStep === totalSteps) {
        handleFinish();
      } else {
        // Otherwise, go to next step
        nextStep();
      }
      return;
    }
    
    // Use normal validation for other cases
    const validation = validateCurrentStep();
    if (!validation.isValid) {
      // Format error messages
      const errorTitles: Record<string, string> = {
        name: 'Nombre del negocio',
        category: 'Categoría',
        phone: 'Teléfono',
        location: 'Ubicación',
        email: 'Correo electrónico',
        image: 'Imagen',
        description: 'Descripción'
      };
      
      // If no specific errors but validation failed, show generic message
      if (Object.keys(validation.errors).length === 0) {
        Alert.alert(
          "Campos requeridos",
          "Por favor completa todos los campos requeridos antes de continuar.",
          [{ text: "Entendido" }]
        );
        return;
      }
      
      // Format errors with field names
      const formattedErrors = Object.entries(validation.errors).map(([field, message]) => {
        const fieldTitle = errorTitles[field] || field;
        return `${fieldTitle}: ${message}`;
      }).join('\n• ');
      
      Alert.alert(
        "Por favor corrige los siguientes campos:",
        `• ${formattedErrors}`,
        [{ text: "Entendido" }]
      );
    } else {
      // Validation successful - proceed directly
      
      // Mark current step as complete
      if (currentStep === 5) {
        markStepComplete('businessOperations');
      } else if (currentStep === 6) {
        markStepComplete('digitalPresence');
      }
      
      // If this is the last step, finish the onboarding
      if (currentStep === totalSteps) {
        handleFinish();
      } else {
        // Otherwise, go to next step
        nextStep();
      }
    }
  };
  
  // Handle save for later
  const handleSaveForLater = async () => {
    const saved = await saveProgress();
    if (saved) {
      Alert.alert(
        "Progreso guardado",
        "Podrás continuar desde este punto más adelante.",
        [{ text: "OK", onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) }]
      );
    } else {
      Alert.alert(
        "Error al guardar",
        "No se pudo guardar tu progreso. Intenta de nuevo."
      );
    }
  };
  
  // Ensure auto-save on form changes with debouncing to reduce excessive saves
  useEffect(() => {
    // Create a unique key from the form state to only save when it actually changes
    // This will prevent saving the same data repeatedly
    const formStateKey = JSON.stringify({
      name: formState.name,
      category: formState.category,
      description: formState.description,
      phone: formState.phone,
      location: formState.location,
      image: formState.image ? 'image-set' : null, // Only track if image exists, not the full data
      // Only include fields that would trigger a save
    });
    
    // Use a longer timeout for auto-saving to reduce frequency
    const saveTimeout = setTimeout(() => {
      // Avoid logging to reduce console noise
      saveProgress();
    }, 5000); // Increased from 2000ms to 5000ms
    
    return () => clearTimeout(saveTimeout);
  }, [formState.name, formState.category, formState.description, 
      formState.phone, formState.location, formState.image]);
  
  // Handle finish onboarding
  const handleFinish = async () => {
    setIsSubmitting(true);
    
    const businessId = await finishOnboarding();
    
    setIsSubmitting(false);
    
    if (businessId) {
      Alert.alert(
        "¡Felicidades!",
        "Tu negocio ha sido creado exitosamente.",
        [{ 
          text: "Ver mi negocio", 
          onPress: () => navigation.navigate('BusinessDetail', { businessId, fromOnboarding: true }) 
        }]
      );
    } else {
      Alert.alert(
        "Error",
        "No se pudo crear el negocio. Por favor, intenta de nuevo.",
        [{ text: "OK" }]
      );
    }
  };
  
  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfoStep />;
      case 2:
        return <VisualProfileStep />;
      case 3:
        return <ValuePropositionStep />;
      case 4:
        return <MenuManagementStep />;
      case 5:
        return <BusinessOperationsStep />;
      case 6:
        return <DigitalPresenceStep />;
      default:
        return <BasicInfoStep />;
    }
  };
  
  // Get step title
  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Información Básica";
      case 2: return "Perfil Visual";
      case 3: return "Propuesta de Valor";
      case 4: {
        // Detectar si es una atracción turística
        const category = formState.category?.toLowerCase() || '';
        const isTourism = category.includes('turismo') || 
                          category.includes('atracción') || 
                          category.includes('turisticos') ||
                          category.includes('turística') ||
                          category.includes('tour') ||
                          category.includes('aventura') ||
                          category.includes('lugares');
        return isTourism ? "Planes y Actividades" : "Menú y Productos";
      }
      case 5: return "Operaciones";
      case 6: return "Presencia Digital";
      default: return "Información Básica";
    }
  };
  
  // Get step subtitle
  const getStepSubtitle = () => {
    switch (currentStep) {
      case 1: return "Lo básico primero. Información esencial para tu negocio.";
      case 2: return "Dale identidad a tu negocio con imágenes de calidad.";
      case 3: return "¿Qué hace especial a tu negocio? Cuéntaselo a tus clientes.";
      case 4: {
        // Detectar si es una atracción turística
        const category = formState.category?.toLowerCase() || '';
        const isTourism = category.includes('turismo') || 
                          category.includes('atracción') || 
                          category.includes('turisticos') ||
                          category.includes('turística') ||
                          category.includes('tour') ||
                          category.includes('aventura') ||
                          category.includes('lugares');
        return isTourism 
          ? "Crea tus planes o actividades para atraer visitantes."
          : "Crea tu menú de productos o servicios para los clientes.";
      }
      case 5: return "Configura cómo opera tu negocio día a día.";
      case 6: return "Conecta tu ecosistema digital para mayor visibilidad.";
      default: return "";
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBack}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getStepTitle()}</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleManualSave}
          activeOpacity={0.8}
        >
          <MaterialIcons name="save" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill,
              { width: `${progress}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>Paso {currentStep} de {totalSteps}</Text>
        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.savingText}>Guardando...</Text>
          </View>
        )}
        {lastSaved && !isSaving && (
          <Text style={styles.lastSavedText}>
            Guardado: {lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
        )}
      </View>
      
      {/* Step subtitle */}
      <Text style={styles.stepSubtitle}>{getStepSubtitle()}</Text>
      
      {/* Main Content - Each step now handles its own scrolling */}
      <View style={styles.mainContentContainer}>
        {renderStep()}
      </View>
      
      {/* Express mode info - Fixed at the bottom above buttons */}
      {onboardingMode === 'express' && currentStep > 2 && (
        <View style={styles.expressInfoFixed}>
          <MaterialIcons name="flash-on" size={20} color="#007AFF" />
          <Text style={styles.expressInfoText}>
            Configuración Express: Puedes completar esta sección más tarde.
          </Text>
        </View>
      )}
      
      {/* Bottom buttons */}
      <View style={styles.buttonContainer}>
        {currentStep < totalSteps ? (
          <>
            {onboardingMode === 'express' && currentStep > 2 && (
              <TouchableOpacity 
                style={styles.skipButton}
                onPress={nextStep}
                activeOpacity={0.8}
              >
                <Text style={styles.skipButtonText}>Completar después</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continuar</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity 
            style={[styles.finishButton, isSubmitting && styles.disabledButton]}
            onPress={handleFinish}
            activeOpacity={0.8}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.finishButtonText}>Finalizar</Text>
                <MaterialIcons name="check" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    zIndex: 10, // Ensure header stays on top
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  saveButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A2463',
  },
  progressContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
    zIndex: 5, // Ensure progress bar stays on top
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E1E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
    top: 0,
  },
  savingText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  lastSavedText: {
    fontSize: 12,
    color: '#8E8E93',
    position: 'absolute',
    right: 16,
    top: 0,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#5E6A81',
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 22,
  },
  mainContentContainer: {
    flex: 1, // This allows the content to take up all available space
    position: 'relative',
  },
  expressInfoFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  expressInfoText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E1E8F0',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  skipButton: {
    backgroundColor: 'white',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E1E8F0',
  },
  skipButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '500',
  },
  finishButton: {
    backgroundColor: '#34C759',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: '#A0DFB2',
    shadowOpacity: 0.1,
  },
});

export default BusinessOnboardingStepsScreen; 
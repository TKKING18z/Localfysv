import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { BusinessFormState } from '../hooks/business/useAddBusiness';
import { firebaseService } from '../services/firebaseService';

// Onboarding mode types
export type OnboardingMode = 'express' | 'detailed';

// Interface for step completion status
interface CompletedSteps {
  basicInfo: boolean;
  visualProfile: boolean;
  valueProposition: boolean;
  menuManagement: boolean;
  businessOperations: boolean;
  digitalPresence: boolean;
}

// Status for form validation
interface StepValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

// Main context interface
interface BusinessOnboardingContextType {
  // State
  formState: BusinessFormState;
  currentStep: number;
  totalSteps: number;
  onboardingMode: OnboardingMode;
  stepsCompleted: CompletedSteps;
  stepsForLater: string[];
  progress: number;
  isSaving: boolean;
  lastSaved: Date | null;
  
  // Functions
  setField: (field: keyof BusinessFormState, value: any) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  saveProgress: () => Promise<boolean>;
  finishOnboarding: () => Promise<string | null>;
  setOnboardingMode: (mode: OnboardingMode) => void;
  validateCurrentStep: () => StepValidation;
  markStepComplete: (step: keyof CompletedSteps) => void;
  markStepForLater: (step: string) => void;
  removeStepForLater: (step: string) => void;
  discardOnboarding: () => Promise<boolean>;
  recoverProgress: () => Promise<boolean>;
  forceStepValidation: (stepKey: keyof CompletedSteps) => void;
}

// Create context with safe defaults
const BusinessOnboardingContext = createContext<BusinessOnboardingContextType>({
  formState: {
    name: '',
    description: '',
    category: '',
    address: '',
    phone: '',
    image: null,
    location: null,
    businessHours: undefined,
    paymentMethods: [],
    socialLinks: undefined,
    menu: [],
    menuUrl: '',
    acceptsReservations: true,
    allowsPromotions: true,
    isLoading: false,
    uploadProgress: 0,
    hasUnsavedChanges: false,
    validationErrors: {},
    galleryImages: []
  },
  currentStep: 1,
  totalSteps: 6,
  onboardingMode: 'detailed',
  stepsCompleted: {
    basicInfo: false,
    visualProfile: false,
    valueProposition: false,
    menuManagement: false,
    businessOperations: false,
    digitalPresence: false
  },
  stepsForLater: [],
  progress: 0,
  isSaving: false,
  lastSaved: null,
  
  setField: () => {},
  nextStep: () => {},
  prevStep: () => {},
  goToStep: () => {},
  saveProgress: async () => false,
  finishOnboarding: async () => null,
  setOnboardingMode: () => {},
  validateCurrentStep: () => ({ isValid: false, errors: {} }),
  markStepComplete: () => {},
  markStepForLater: () => {},
  removeStepForLater: () => {},
  discardOnboarding: async () => false,
  recoverProgress: async () => false,
  forceStepValidation: () => {}
});

// Hook for accessing the context
export const useBusinessOnboarding = () => useContext(BusinessOnboardingContext);

// Provider component
export const BusinessOnboardingProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  
  // Initialize form state
  const [formState, setFormState] = useState<BusinessFormState>({
    name: '',
    description: '',
    category: '',
    address: '',
    phone: '',
    image: null,
    location: null,
    businessHours: undefined,
    paymentMethods: [],
    socialLinks: undefined,
    menu: [],
    menuUrl: '',
    acceptsReservations: true,
    allowsPromotions: true,
    isLoading: false,
    uploadProgress: 0,
    hasUnsavedChanges: false,
    validationErrors: {},
    galleryImages: []
  });
  
  // Onboarding state
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(6);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('detailed');
  const [stepsCompleted, setStepsCompleted] = useState<CompletedSteps>({
    basicInfo: false,
    visualProfile: false,
    valueProposition: false,
    menuManagement: false,
    businessOperations: false,
    digitalPresence: false
  });
  const [stepsForLater, setStepsForLater] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Update progress whenever form state or steps change
  useEffect(() => {
    // Calculate progress based on completed steps and form data
    const stepProgression = Object.values(stepsCompleted).filter(Boolean).length / 6;
    const formProgression = calculateFormProgress();
    
    const calculatedProgress = (stepProgression + formProgression) / 2;
    const newProgress = Math.min(Math.floor(calculatedProgress * 100), 100);
    
    // Only update if progress has actually changed
    if (newProgress !== progress) {
      setProgress(newProgress);
    }
    
    // Auto-save after any form change, but only if not currently saving
    if (!isSaving) {
      const saveTimeout = setTimeout(() => {
        saveProgress();
      }, 3000);
      
      return () => clearTimeout(saveTimeout);
    }
  }, [formState, stepsCompleted, stepsForLater, progress, isSaving]);
  
  // Calculate progress based on filled form fields
  const calculateFormProgress = () => {
    let fieldsCompleted = 0;
    let totalFields = 0;
    
    // Required fields
    const requiredFields: (keyof BusinessFormState)[] = ['name', 'category', 'description', 'phone', 'image'];
    requiredFields.forEach(field => {
      totalFields++;
      if (field === 'image' && formState.image) fieldsCompleted++;
      else if (typeof formState[field] === 'string' && (formState[field] as string).trim() !== '') fieldsCompleted++;
    });
    
    // Optional fields
    const optionalFields: (keyof BusinessFormState)[] = ['location', 'address', 'businessHours', 'paymentMethods', 'socialLinks', 'menu'];
    optionalFields.forEach(field => {
      totalFields++;
      
      if (field === 'location' && formState.location) fieldsCompleted++;
      else if (field === 'address' && formState.address && formState.address.trim() !== '') fieldsCompleted++;
      else if (field === 'businessHours' && formState.businessHours) fieldsCompleted++;
      else if (field === 'paymentMethods' && formState.paymentMethods && formState.paymentMethods.length > 0) fieldsCompleted++;
      else if (field === 'socialLinks' && formState.socialLinks && Object.keys(formState.socialLinks).length > 0) fieldsCompleted++;
      else if (field === 'menu' && formState.menu && formState.menu.length > 0) fieldsCompleted++;
    });
    
    // Update step completion
    if (fieldsCompleted > 0) {
      // Basic info is complete when mandatory fields are filled
      if (!stepsCompleted.basicInfo && 
          formState.name && formState.category && formState.phone && formState.location) {
        markStepComplete('basicInfo');
      }
      
      // Menu management is complete when menu or menuUrl exists
      if (!stepsCompleted.menuManagement && 
          ((formState.menu && formState.menu.length > 0) || 
           (formState.menuUrl && formState.menuUrl.trim() !== ''))) {
        markStepComplete('menuManagement');
      }
    }
    
    return fieldsCompleted / totalFields;
  };
  
  // Helper to set a single field
  const setField = useCallback((field: keyof BusinessFormState, value: any) => {
    setFormState(prev => {
      // Only update if the value has actually changed
      if (JSON.stringify(prev[field]) === JSON.stringify(value)) {
        return prev;
      }
      return { ...prev, [field]: value };
    });
  }, []);
  
  // Navigation functions
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };
  
  // Save progress to storage
  const saveProgress = async (): Promise<boolean> => {
    if (!user?.uid) return false;
    
    try {
      setIsSaving(true);
      
      // Clean form state to remove undefined values that Firestore doesn't accept
      const cleanFormState = { ...formState } as any; // Use any temporarily to avoid type errors during cleanup
      
      // Replace undefined values with null for Firestore compatibility
      if (cleanFormState.businessHours === undefined) {
        cleanFormState.businessHours = null;
      }
      
      if (cleanFormState.socialLinks === undefined) {
        cleanFormState.socialLinks = null;
      }
      
      // Create a clean data object to avoid reference issues
      const dataToSave = {
        formState: cleanFormState,
        currentStep,
        stepsCompleted: { ...stepsCompleted },
        stepsForLater: [...stepsForLater],
        onboardingMode,
        lastUpdated: new Date().toISOString()
      };
      
      // First save to AsyncStorage for offline access
      await AsyncStorage.setItem(
        `business_onboarding_${user.uid}`,
        JSON.stringify(dataToSave)
      );
      
      // Then save to Firestore if online
      try {
        await firebaseService.users.saveBusinessDraft(user.uid, dataToSave);
      } catch (firestoreError) {
        console.error('Error saving to Firestore:', firestoreError);
        // Continue with local save result since we saved to AsyncStorage
      }
      
      // Update last saved timestamp
      setIsSaving(false);
      setLastSaved(new Date());
      
      return true;
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
      setIsSaving(false);
      return false;
    }
  };
  
  // Finish onboarding and create the business
  const finishOnboarding = async (): Promise<string | null> => {
    if (!user?.uid) return null;
    
    try {
      setFormState(prev => ({ ...prev, isLoading: true }));
      
      // Prepare business data
      const businessData = {
        name: formState.name,
        description: formState.description,
        category: formState.category,
        ...(formState.address ? { address: formState.address } : {}),
        ...(formState.phone ? { phone: formState.phone } : {}),
        ...(formState.location ? { location: formState.location } : {}),
        ...(formState.businessHours && Object.keys(formState.businessHours).length > 0 ? 
            { businessHours: formState.businessHours } : {}),
        ...(formState.paymentMethods && formState.paymentMethods.length > 0 ? 
            { paymentMethods: formState.paymentMethods } : {}),
        ...(formState.socialLinks && Object.keys(formState.socialLinks).length > 0 ? 
            { socialLinks: formState.socialLinks } : {}),
        ...(formState.menu && formState.menu.length > 0 ? { menu: formState.menu } : {}),
        ...(formState.menuUrl ? { menuUrl: formState.menuUrl } : {}),
        ...(formState.services ? { services: formState.services } : {}),
        acceptsReservations: formState.acceptsReservations,
        createdBy: user.uid,
        images: []  // Will be populated after upload
      };
      
      // Create business
      const result = await firebaseService.businesses.create(businessData);
      
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Error creating business');
      }
      
      const businessId = result.data.id;
      
      // Array to collect all images that will be added to the business
      const businessImages: Array<{url: string, isMain?: boolean}> = [];
      
      // Upload main image if available
      if (formState.image) {
        const imageResult = await firebaseService.businesses.uploadBusinessImage(
          businessId,
          formState.image,
          true // isMain
        );
        
        if (imageResult.success && imageResult.data) {
          // Add the uploaded main image to our collection
          businessImages.push({
            url: imageResult.data.url,
            isMain: true
          });
        }
      }
      
      // Upload gallery images if available
      if (formState.galleryImages && formState.galleryImages.length > 0) {
        // Process each gallery image
        for (const galleryImage of formState.galleryImages) {
          const galleryImageResult = await firebaseService.businesses.uploadBusinessImage(
            businessId,
            galleryImage,
            false // not main image
          );
          
          if (galleryImageResult.success && galleryImageResult.data) {
            // Add the uploaded gallery image to our collection
            businessImages.push({
              url: galleryImageResult.data.url,
              isMain: false
            });
          }
        }
      }
      
      // Update business with all images if we have any
      if (businessImages.length > 0) {
        await firebaseService.businesses.updateImages(businessId, businessImages);
      }
      
      // Clear draft
      await clearOnboardingDraft();
      
      setFormState(prev => ({ ...prev, isLoading: false }));
      return businessId;
    } catch (error) {
      console.error('Error creating business:', error);
      setFormState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  };
  
  // Force a step to be valid (for emergency bypass when validation is stuck)
  const forceStepValidation = useCallback((stepKey: keyof CompletedSteps) => {
    console.log(`Forcing validation success for step: ${stepKey}`);
    setStepsCompleted(prev => ({
      ...prev,
      [stepKey]: true
    }));
  }, []);
  
  // Step management
  const validateCurrentStep = (): StepValidation => {
    const errors: Record<string, string> = {};
    let isValid = true;
    
    // Log the current state being validated
    console.log("Validating with form state:", JSON.stringify(formState));
    
    // Emergency bypass: If step is already marked as complete, skip validation
    switch (currentStep) {
      case 1:
        if (stepsCompleted.basicInfo) {
          console.log("Basic info step marked as complete, skipping validation");
          return { isValid: true, errors: {} };
        }
        break;
      case 2:
        if (stepsCompleted.visualProfile) {
          console.log("Visual profile step marked as complete, skipping validation");
          return { isValid: true, errors: {} };
        }
        break;
      case 3:
        if (stepsCompleted.valueProposition) {
          console.log("Value proposition step marked as complete, skipping validation");
          return { isValid: true, errors: {} };
        }
        break;
      case 4:
        if (stepsCompleted.menuManagement) {
          console.log("Menu management step marked as complete, skipping validation");
          return { isValid: true, errors: {} };
        }
        break;
      // Add more cases for other steps
    }
    
    // Validate based on current step
    switch (currentStep) {
      case 1: // Basic Info
        // Check name field
        if (!formState.name || !formState.name.trim()) {
          errors.name = 'El nombre del negocio es obligatorio';
          isValid = false;
          console.log("Name validation failed:", formState.name);
        } else {
          console.log("Name validation passed:", formState.name);
        }
        
        // Check category field
        if (!formState.category || !formState.category.trim()) {
          errors.category = 'La categoría es obligatoria';
          isValid = false;
          console.log("Category validation failed:", formState.category);
        } else {
          console.log("Category validation passed:", formState.category);
        }
        
        // Check phone field
        if (!formState.phone || !formState.phone.trim()) {
          errors.phone = 'El teléfono de contacto es obligatorio';
          isValid = false;
          console.log("Phone validation failed:", formState.phone);
        } else if (!/^[0-9+\-\s()]{7,20}$/.test(formState.phone)) {
          errors.phone = 'Formato de teléfono inválido';
          isValid = false;
          console.log("Phone format validation failed:", formState.phone);
        } else {
          console.log("Phone validation passed:", formState.phone);
        }
        
        // Check location field
        if (!formState.location) {
          errors.location = 'Selecciona una ubicación en el mapa';
          isValid = false;
          console.log("Location validation failed: location is null");
        } else if (typeof formState.location !== 'object' || 
                 !('latitude' in formState.location) || 
                 !('longitude' in formState.location)) {
          errors.location = 'Ubicación inválida, intenta seleccionarla nuevamente';
          isValid = false;
          console.log("Location format validation failed:", formState.location);
        } else {
          console.log("Location validation passed:", formState.location);
        }
        
        // Email validation (optional field)
        if (formState.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
          errors.email = 'Formato de correo electrónico inválido';
          isValid = false;
        }
        
        // Final validation result
        console.log(`Step 1 validation ${isValid ? 'passed' : 'failed'} with errors:`, errors);
        break;
        
      case 2: // Visual Profile
        if (!formState.image) {
          errors.image = 'La imagen del negocio es obligatoria';
          isValid = false;
        }
        break;
        
      case 3: // Value Proposition
        if (!formState.description || !formState.description.trim()) {
          errors.description = 'La descripción es obligatoria';
          isValid = false;
        } else if (formState.description.length < 20) {
          errors.description = 'La descripción debe tener al menos 20 caracteres';
          isValid = false;
        }
        break;
        
      case 4: // Menu Management
        // No required fields, all are optional
        // But mark step as valid if there's at least some menu data
        if ((formState.menu && formState.menu.length > 0) || 
            (formState.menuUrl && formState.menuUrl.trim() !== '')) {
          markStepComplete('menuManagement');
        }
        break;
        
      // For other steps, all fields are optional
    }
    
    // Log validation errors for debugging
    if (Object.keys(errors).length > 0) {
      console.log('Validation errors:', errors);
    }
    
    // Update validation errors in form state
    setFormState(prev => ({
      ...prev,
      validationErrors: errors
    }));
    
    return { isValid, errors };
  };
  
  const markStepComplete = useCallback((step: keyof CompletedSteps) => {
    setStepsCompleted(prev => {
      // Only update if the value is changing from false to true
      if (prev[step] === true) {
        return prev;
      }
      return {
        ...prev,
        [step]: true
      };
    });
  }, []);
  
  const markStepForLater = (step: string) => {
    if (!stepsForLater.includes(step)) {
      setStepsForLater(prev => [...prev, step]);
    }
  };
  
  const removeStepForLater = (step: string) => {
    setStepsForLater(prev => prev.filter(s => s !== step));
  };
  
  // Clear all onboarding data
  const clearOnboardingDraft = async () => {
    if (!user?.uid) return;
    
    try {
      await AsyncStorage.removeItem(`business_onboarding_${user.uid}`);
      await firebaseService.users.removeBusinessDraft(user.uid);
    } catch (error) {
      console.error('Error clearing onboarding draft:', error);
    }
  };
  
  // Discard onboarding
  const discardOnboarding = async (): Promise<boolean> => {
    try {
      await clearOnboardingDraft();
      
      // Reset state
      setFormState({
        name: '',
        description: '',
        category: '',
        address: '',
        phone: '',
        image: null,
        location: null,
        businessHours: undefined,
        paymentMethods: [],
        socialLinks: undefined,
        menu: [],
        menuUrl: '',
        acceptsReservations: true,
        allowsPromotions: true,
        isLoading: false,
        uploadProgress: 0,
        hasUnsavedChanges: false,
        validationErrors: {},
        galleryImages: []
      });
      
      setCurrentStep(1);
      setStepsCompleted({
        basicInfo: false,
        visualProfile: false,
        valueProposition: false,
        menuManagement: false,
        businessOperations: false,
        digitalPresence: false
      });
      setStepsForLater([]);
      
      return true;
    } catch (error) {
      console.error('Error discarding onboarding:', error);
      return false;
    }
  };
  
  // Recover saved progress
  const recoverProgress = async (): Promise<boolean> => {
    if (!user?.uid) return false;
    
    try {
      console.log("Attempting to recover progress...");
      
      // Try to get from AsyncStorage first (faster)
      const savedData = await AsyncStorage.getItem(`business_onboarding_${user.uid}`);
      
      if (savedData) {
        console.log("Found data in AsyncStorage");
        const parsed = JSON.parse(savedData);
        
        // Verify the data structure before using it
        if (parsed.formState) {
          console.log("Valid formState found, loading from AsyncStorage");
          setFormState(parsed.formState);
          setCurrentStep(parsed.currentStep || 1);
          setStepsCompleted(parsed.stepsCompleted || {
            basicInfo: false,
            visualProfile: false,
            valueProposition: false,
            menuManagement: false,
            businessOperations: false,
            digitalPresence: false
          });
          setStepsForLater(parsed.stepsForLater || []);
          setOnboardingMode(parsed.onboardingMode || 'detailed');
          setLastSaved(new Date(parsed.lastUpdated));
          return true;
        } else {
          console.error("Invalid data structure in AsyncStorage");
        }
      }
      
      // If not in AsyncStorage, try Firestore
      console.log("Trying to load from Firestore...");
      const firestoreData = await firebaseService.users.getBusinessDraft(user.uid);
      
      if (firestoreData && firestoreData.success && firestoreData.data) {
        console.log("Valid data found in Firestore");
        if (firestoreData.data.formState) {
          setFormState(firestoreData.data.formState);
          setCurrentStep(firestoreData.data.currentStep || 1);
          setStepsCompleted(firestoreData.data.stepsCompleted || {
            basicInfo: false,
            visualProfile: false,
            valueProposition: false,
            menuManagement: false,
            businessOperations: false,
            digitalPresence: false
          });
          setStepsForLater(firestoreData.data.stepsForLater || []);
          setOnboardingMode(firestoreData.data.onboardingMode || 'detailed');
          setLastSaved(new Date(firestoreData.data.lastUpdated));
          
          // Also save to AsyncStorage for next time
          await AsyncStorage.setItem(
            `business_onboarding_${user.uid}`,
            JSON.stringify(firestoreData.data)
          );
          
          return true;
        } else {
          console.error("Invalid data structure in Firestore");
        }
      }
      
      console.log("No valid saved data found");
      return false;
    } catch (error) {
      console.error('Error recovering onboarding progress:', error);
      return false;
    }
  };
  
  // Context value
  const value = {
    formState,
    currentStep,
    totalSteps,
    onboardingMode,
    stepsCompleted,
    stepsForLater,
    progress,
    isSaving,
    lastSaved,
    
    setField,
    nextStep,
    prevStep,
    goToStep,
    saveProgress,
    finishOnboarding,
    setOnboardingMode,
    validateCurrentStep,
    markStepComplete,
    markStepForLater,
    removeStepForLater,
    discardOnboarding,
    recoverProgress,
    forceStepValidation
  };
  
  return (
    <BusinessOnboardingContext.Provider value={value}>
      {children}
    </BusinessOnboardingContext.Provider>
  );
}; 
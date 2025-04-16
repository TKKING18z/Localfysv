import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBusinessOnboarding } from '../../../context/BusinessOnboardingContext';

// Suggested keywords by category
const KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  'Restaurante': ['comida', 'restaurante', 'gourmet', 'chef', 'local', 'menú', 'platos', 'gastronomía'],
  'Cafetería': ['café', 'postres', 'espresso', 'ambiente', 'acogedor', 'desayuno', 'merienda'],
  'Tienda': ['tienda', 'productos', 'compras', 'calidad', 'servicio', 'artículos', 'venta'],
  'Bar': ['bar', 'tragos', 'cócteles', 'bebidas', 'noche', 'ambiente', 'música'],
  'Hotel': ['hotel', 'hospedaje', 'habitaciones', 'alojamiento', 'turismo', 'descanso', 'vacaciones'],
  'Spa': ['spa', 'masajes', 'relajación', 'tratamientos', 'belleza', 'bienestar', 'salud'],
  'Gimnasio': ['fitness', 'ejercicio', 'gimnasio', 'entrenamiento', 'salud', 'deporte', 'bienestar']
};

// Default keywords for categories not explicitly defined
const DEFAULT_KEYWORDS = ['servicio', 'calidad', 'atención', 'profesional', 'experiencia', 'local'];

const ValuePropositionStep: React.FC = () => {
  const { formState, setField, markStepComplete } = useBusinessOnboarding();
  
  // Local state
  const [shortDescriptionChars, setShortDescriptionChars] = useState(0);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  
  // Initialize keywords and suggested keywords based on category
  useEffect(() => {
    // Check if we already have keywords
    if (formState.keywords && formState.keywords.length > 0) {
      setKeywords(formState.keywords);
    }
    
    // Update suggested keywords based on category
    if (formState.category) {
      const lowerCategory = formState.category.toLowerCase();
      let suggested: string[] = [...DEFAULT_KEYWORDS];
      
      // Find matching category for suggestions
      Object.keys(KEYWORDS_BY_CATEGORY).forEach(category => {
        if (lowerCategory.includes(category.toLowerCase())) {
          suggested = KEYWORDS_BY_CATEGORY[category];
        }
      });
      
      // Filter out already selected keywords
      const filteredSuggestions = suggested.filter(
        keyword => !keywords.includes(keyword)
      );
      
      setSuggestedKeywords(filteredSuggestions);
    }
  }, [formState.category, formState.keywords]);
  
  // Effect to mark step complete when required fields are filled
  useEffect(() => {
    if (formState.description && formState.description.length >= 20) {
      markStepComplete('valueProposition');
    }
  }, [formState.description]);
  
  // Effect to update character count
  useEffect(() => {
    if (formState.shortDescription) {
      setShortDescriptionChars(formState.shortDescription.length);
    }
  }, [formState.shortDescription]);
  
  // Handle short description change
  const handleShortDescriptionChange = (text: string) => {
    if (text.length <= 120) {
      setField('shortDescription', text);
      setShortDescriptionChars(text.length);
    }
  };
  
  // Handle full description change
  const handleDescriptionChange = (text: string) => {
    setField('description', text);
  };
  
  // Handle adding a keyword
  const addKeyword = (keyword: string) => {
    const trimmedKeyword = keyword.trim().toLowerCase();
    
    // Don't add empty or duplicate keywords
    if (trimmedKeyword === '' || keywords.includes(trimmedKeyword)) {
      setKeywordInput('');
      return;
    }
    
    const updatedKeywords = [...keywords, trimmedKeyword];
    setKeywords(updatedKeywords);
    setField('keywords', updatedKeywords);
    setKeywordInput('');
    
    // Update suggested keywords
    setSuggestedKeywords(prevSuggested => 
      prevSuggested.filter(suggested => suggested !== trimmedKeyword)
    );
  };
  
  // Handle removing a keyword
  const removeKeyword = (index: number) => {
    const removedKeyword = keywords[index];
    const updatedKeywords = keywords.filter((_, i) => i !== index);
    setKeywords(updatedKeywords);
    setField('keywords', updatedKeywords);
    
    // Add back to suggestions if it was a suggested keyword
    const matchingCategory = Object.keys(KEYWORDS_BY_CATEGORY).find(category => 
      formState.category?.toLowerCase().includes(category.toLowerCase())
    );
    
    if (matchingCategory && KEYWORDS_BY_CATEGORY[matchingCategory].includes(removedKeyword)) {
      setSuggestedKeywords(prev => [...prev, removedKeyword]);
    } else if (DEFAULT_KEYWORDS.includes(removedKeyword)) {
      setSuggestedKeywords(prev => [...prev, removedKeyword]);
    }
  };
  
  // Generate a description suggestion based on category and name
  const generateDescriptionSuggestion = () => {
    const businessName = formState.name || 'Nuestro negocio';
    const category = formState.category?.toLowerCase() || '';
    
    let suggestion = '';
    
    if (category.includes('restaurante')) {
      suggestion = `${businessName} es un restaurante que ofrece una experiencia culinaria única con platos preparados con ingredientes frescos y locales. Nuestro ambiente acogedor es perfecto para disfrutar en familia o con amigos.`;
    } else if (category.includes('café') || category.includes('cafetería')) {
      suggestion = `${businessName} es un espacio acogedor para disfrutar de las mejores variedades de café, acompañadas de deliciosos postres y snacks. El lugar ideal para trabajar, estudiar o reunirse con amigos.`;
    } else if (category.includes('tienda')) {
      suggestion = `En ${businessName} encontrarás productos de calidad con el mejor servicio. Ofrecemos variedad, buenos precios y atención personalizada para satisfacer tus necesidades.`;
    } else if (category.includes('bar')) {
      suggestion = `${businessName} es el lugar perfecto para disfrutar de bebidas de calidad en un ambiente único. Ofrecemos una amplia selección de cócteles y tragos preparados por bartenders profesionales.`;
    } else if (category.includes('hotel') || category.includes('hostal')) {
      suggestion = `${businessName} te ofrece una estancia confortable y tranquila, con todas las comodidades para que disfrutes de tu viaje. Ubicado estratégicamente para facilitar tu experiencia turística.`;
    } else {
      suggestion = `En ${businessName} nos dedicamos a ofrecer servicios de alta calidad y atención personalizada. Nuestro compromiso es la satisfacción del cliente y la excelencia en todo lo que hacemos.`;
    }
    
    setField('description', suggestion);
  };
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
    >
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>¿Qué hace especial a tu negocio?</Text>
          <Text style={styles.sectionSubtitle}>
            Cuenta a tus clientes qué te diferencia de la competencia.
          </Text>
          
          {/* Short Description */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Descripción corta *</Text>
            <Text style={styles.inputHint}>Máximo 120 caracteres</Text>
            <TextInput
              style={[
                styles.textInput,
                formState.validationErrors.shortDescription ? styles.inputError : {}
              ]}
              value={formState.shortDescription || ''}
              onChangeText={handleShortDescriptionChange}
              placeholder="Ej: Cafetería artesanal con productos orgánicos y ambiente acogedor"
              placeholderTextColor="#AEAEB2"
              maxLength={120}
            />
            <Text style={styles.charCount}>{shortDescriptionChars}/120</Text>
            {formState.validationErrors.shortDescription && (
              <Text style={styles.errorText}>{formState.validationErrors.shortDescription}</Text>
            )}
          </View>
          
          {/* Full Description */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Descripción completa *</Text>
            <View style={styles.descriptionHeader}>
              <Text style={styles.inputHint}>Cuenta más sobre tu negocio</Text>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={generateDescriptionSuggestion}
              >
                <MaterialIcons name="auto-awesome" size={16} color="#007AFF" />
                <Text style={styles.generateButtonText}>Generar sugerencia</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[
                styles.textArea,
                formState.validationErrors.description ? styles.inputError : {}
              ]}
              value={formState.description || ''}
              onChangeText={handleDescriptionChange}
              placeholder="Cuéntanos sobre tu negocio, qué servicios o productos ofreces, y qué te diferencia de la competencia."
              placeholderTextColor="#AEAEB2"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            {formState.validationErrors.description && (
              <Text style={styles.errorText}>{formState.validationErrors.description}</Text>
            )}
          </View>
          
          {/* Keywords */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Palabras clave relevantes</Text>
            <Text style={styles.inputHint}>
              Ayudarán a que te encuentren más fácilmente (máximo 10)
            </Text>
            
            {/* Keyword input */}
            <View style={styles.keywordInputContainer}>
              <TextInput
                style={styles.keywordInput}
                value={keywordInput}
                onChangeText={setKeywordInput}
                placeholder="Añadir palabra clave"
                placeholderTextColor="#AEAEB2"
                onSubmitEditing={() => addKeyword(keywordInput)}
              />
              <TouchableOpacity
                style={styles.addKeywordButton}
                onPress={() => addKeyword(keywordInput)}
                disabled={keywordInput.trim() === ''}
              >
                <MaterialIcons name="add" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
            
            {/* Selected keywords */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.keywordsContainer}
              contentContainerStyle={styles.keywordsContent}
            >
              {keywords.map((keyword, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.keywordTag}
                  onPress={() => removeKeyword(index)}
                >
                  <Text style={styles.keywordText}>{keyword}</Text>
                  <MaterialIcons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Suggested keywords */}
            {suggestedKeywords.length > 0 && (
              <View style={styles.suggestedSection}>
                <Text style={styles.suggestedTitle}>Sugerencias:</Text>
                <View style={styles.suggestedContainer}>
                  {suggestedKeywords.slice(0, 5).map((keyword, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestedKeyword}
                      onPress={() => addKeyword(keyword)}
                    >
                      <Text style={styles.suggestedKeywordText}>{keyword}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
          
          {/* Add extra padding at the bottom for better scrolling */}
          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1, 
    paddingBottom: 100, // Add extra padding at the bottom
  },
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A2463',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#5E6A81',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6,
  },
  inputHint: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E1E8F0',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  charCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 15,
  },
  generateButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  textArea: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E1E8F0',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  keywordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  keywordInput: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E1E8F0',
    borderRightWidth: 0,
  },
  addKeywordButton: {
    backgroundColor: 'white',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E1E8F0',
    borderLeftWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keywordsContainer: {
    maxHeight: 40,
    marginBottom: 12,
  },
  keywordsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  keywordTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  keywordText: {
    color: 'white',
    fontSize: 14,
    marginRight: 4,
  },
  suggestedSection: {
    marginTop: 8,
  },
  suggestedTitle: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 8,
  },
  suggestedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  suggestedKeyword: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  suggestedKeywordText: {
    color: '#007AFF',
    fontSize: 14,
  },
  bottomPadding: {
    height: 100, // Extra space at the bottom
  }
});

export default ValuePropositionStep; 
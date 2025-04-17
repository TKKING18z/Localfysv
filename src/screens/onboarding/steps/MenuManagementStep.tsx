import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { useBusinessOnboarding } from '../../../context/BusinessOnboardingContext';
import { CALLBACK_IDS } from '../../../hooks/business/useAddBusiness';
import { useStore } from '../../../context/StoreContext';
import { MenuItem } from '../../../context/BusinessContext';
import MenuViewer from '../../../components/MenuViewer';

type Navigation = StackNavigationProp<RootStackParamList>;

const MenuManagementStep: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { formState, setField, markStepComplete } = useBusinessOnboarding();
  const store = useStore();
  const [loading, setLoading] = useState(false);
  
  // Usar un ref para controlar si el callback ya ha sido registrado
  const callbackRegistered = useRef(false);

  // Determinar si es una atracción turística basado en la categoría
  const isTouristAttraction = useCallback(() => {
    if (!formState.category) return false;
    
    const category = formState.category.toLowerCase();
    return category.includes('turismo') || 
           category.includes('atracción') || 
           category.includes('turisticos') ||
           category.includes('turística') ||
           category.includes('tour') ||
           category.includes('aventura') || 
           category.includes('lugares');
  }, [formState.category]);

  // Labels dinámicos según el tipo de negocio
  const getLabels = useCallback(() => {
    const isTourist = isTouristAttraction();
    return {
      title: isTourist ? "Planes y Actividades" : "Menú y Productos",
      description: isTourist 
        ? "Agrega los planes y actividades que ofreces. Esto ayudará a los clientes a conocer tus servicios antes de visitarte."
        : "Agrega los productos y servicios que ofreces en tu negocio. Esto ayudará a los clientes a conocer tu oferta antes de visitarte.",
      configButton: isTourist ? "Configurar Planes" : "Configurar Menú",
      emptyTitle: isTourist ? "Sin planes configurados" : "Sin menú configurado",
      emptyText: isTourist 
        ? "Agrega planes y actividades para que tus clientes puedan verlos. También puedes agregar un enlace a tu sitio web si ya tienes uno."
        : "Agrega productos a tu menú para que tus clientes puedan verlos. También puedes agregar un enlace a tu menú externo si ya tienes uno.",
      viewTitle: isTourist ? "Vista previa de planes" : "Vista previa del menú"
    };
  }, [isTouristAttraction]);

  // Callback memoizado para evitar recreaciones innecesarias
  const menuEditorCallback = useCallback((newMenu: MenuItem[], newMenuUrl: string) => {
    console.log('MenuEditor callback ejecutado con datos:', { menu: newMenu, menuUrl: newMenuUrl });
    setField('menu', newMenu);
    setField('menuUrl', newMenuUrl);
    
    // Marcar paso como completado si tiene al menos un elemento de menú o una URL
    if ((newMenu && newMenu.length > 0) || newMenuUrl) {
      markStepComplete('menuManagement');
    }
  }, [setField, markStepComplete]);

  // Registrar el callback solo una vez al montar el componente
  useEffect(() => {
    // Capturar la referencia a store para evitar cambios
    const storeRef = store;
    
    // Evitamos registrar el callback múltiples veces
    if (!callbackRegistered.current) {
      storeRef.setCallback(CALLBACK_IDS.MENU_EDITOR, menuEditorCallback);
      callbackRegistered.current = true;
    }

    // Función de limpieza
    return () => {
      storeRef.removeCallback(CALLBACK_IDS.MENU_EDITOR);
      callbackRegistered.current = false;
    };
  }, [menuEditorCallback]); // Solo depende del callback memoizado

  // Function to check if menu exists - memoized to avoid unnecessary recreation
  const hasMenu = useCallback(() => {
    return (formState.menu && formState.menu.length > 0) || 
           (formState.menuUrl && formState.menuUrl.length > 0);
  }, [formState.menu, formState.menuUrl]);

  // Memoize handleOpenMenuEditor to prevent unnecessary recreations
  const handleOpenMenuEditor = useCallback(() => {
    setLoading(true);
    
    // Navegar a la pantalla de edición de menú
    navigation.navigate('MenuEditor', {
      businessId: 'tempId', // ID temporal para el nuevo negocio
      initialMenu: formState.menu || [],
      menuUrl: formState.menuUrl || '',
      callbackId: CALLBACK_IDS.MENU_EDITOR // Usar el ID del callback registrado
    });
    
    // Pequeño retraso antes de restablecer el estado de carga
    setTimeout(() => {
      setLoading(false);
    }, 300);
  }, [navigation, formState.menu, formState.menuUrl]);

  const labels = getLabels();

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons 
        name={isTouristAttraction() ? "hiking" : "restaurant-menu"} 
        size={60} 
        color="#D1D1D6" 
      />
      <Text style={styles.emptyTitle}>{labels.emptyTitle}</Text>
      <Text style={styles.emptyText}>{labels.emptyText}</Text>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={handleOpenMenuEditor}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <MaterialIcons name="add" size={20} color="white" />
            <Text style={styles.addButtonText}>{labels.configButton}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderMenuPreview = () => (
    <View style={styles.previewContainer}>
      <View style={styles.previewHeader}>
        <Text style={styles.previewTitle}>{labels.viewTitle}</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={handleOpenMenuEditor}
        >
          <MaterialIcons name="edit" size={18} color="#007AFF" />
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.menuPreview}>
        <MenuViewer 
          menu={formState.menu}
          menuUrl={formState.menuUrl}
          isNested={true}
          viewType={isTouristAttraction() ? 'tourism' : 'restaurant'}
          businessId="tempId"
          businessName={formState.name || "Mi Negocio"}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <MaterialIcons 
              name={isTouristAttraction() ? "hiking" : "restaurant-menu"} 
              size={24} 
              color="#007AFF" 
            />
            <Text style={styles.headerTitle}>{labels.title}</Text>
          </View>

          <Text style={styles.description}>{labels.description}</Text>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Puedes agregar, editar o eliminar elementos en cualquier momento después de crear tu negocio.
            </Text>
          </View>

          {hasMenu() ? renderMenuPreview() : renderEmptyState()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A2463',
    marginLeft: 10,
  },
  description: {
    fontSize: 16,
    color: '#5E6A81',
    marginBottom: 20,
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  previewContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  menuPreview: {
    padding: 15,
  },
});

export default MenuManagementStep; 
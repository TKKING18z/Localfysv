import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { SocialLinks } from '../../context/BusinessContext';
import { useStore } from '../../context/StoreContext';

interface RouteParams {
  initialLinks?: SocialLinks;
  callbackId: string;
}

type SocialLinksRouteProp = RouteProp<{ SocialLinks: RouteParams }, 'SocialLinks'>;
type NavigationProp = StackNavigationProp<{ SocialLinks: RouteParams }, 'SocialLinks'>;

// Definición de redes sociales
const socialNetworks = [
  { key: 'facebook', label: 'Facebook', icon: 'facebook', placeholder: 'https://facebook.com/minegocio' },
  { key: 'instagram', label: 'Instagram', icon: 'camera-alt', placeholder: 'https://instagram.com/minegocio' },
  { key: 'twitter', label: 'Twitter', icon: 'chat', placeholder: 'https://twitter.com/minegocio' },
  { key: 'tiktok', label: 'TikTok', icon: 'music-video', placeholder: 'https://tiktok.com/@minegocio' },
  { key: 'website', label: 'Sitio Web', icon: 'public', placeholder: 'https://minegocio.com' }
];

const SocialLinksScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SocialLinksRouteProp>();
  const store = useStore();
  
  // Extraer parámetros de manera segura
  const getParams = (): RouteParams => {
    try {
      if (!route.params) {
        console.warn('No route params found for SocialLinksScreen');
        return { callbackId: '' };
      }
      return route.params;
    } catch (error) {
      console.error('Error accessing route params:', error);
      return { callbackId: '' };
    }
  };
  
  const { initialLinks, callbackId } = getParams();
  
  // Estado para los enlaces
  const [links, setLinks] = useState<SocialLinks>(initialLinks || {});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Log iniciales para depuración
  useEffect(() => {
    console.log('SocialLinksScreen mounted with params:', {
      initialLinks: initialLinks ? 'provided' : 'not provided',
      callbackId
    });
    
    // Comprobar si el callback existe
    const callback = store.getCallback(callbackId);
    console.log(`SocialLinksScreen - Callback exists: ${!!callback}`);
    
    return () => {
      console.log(`SocialLinksScreen unmounting, callbackId: ${callbackId}`);
    };
  }, []);
  
  // Detectar cambios
  useEffect(() => {
    setHasChanges(true);
  }, [links]);
  
  // Actualizar enlace
  const updateLink = (key: keyof SocialLinks, value: string) => {
    console.log(`Updating ${key} link to: ${value}`);
    setLinks(prevLinks => ({
      ...prevLinks,
      [key]: value
    }));
  };
  
  // Abrir enlace para probar
  const testLink = (url: string) => {
    if (!url) return;
    
    // Asegurarse de que la URL tenga el prefijo correcto
    const formattedUrl = !url.startsWith('http://') && !url.startsWith('https://') 
      ? 'https://' + url 
      : url;
    
    Linking.openURL(formattedUrl).catch(err => {
      console.error('Error opening URL:', err);
      Alert.alert('Error', 'No se pudo abrir el enlace. Verifica que la URL sea correcta.');
    });
  };
  
  // Validar una URL
  const isValidUrl = (url: string): boolean => {
    if (!url) return true; // Vacío es válido
    
    // Regex simple para validar URLs
    const pattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    return pattern.test(url);
  };
  
  // Guardar cambios
  const handleSave = () => {
    if (!callbackId) {
      console.error("No callback ID provided, cannot save social links");
      Alert.alert(
        "Error",
        "No se pueden guardar los enlaces. ID de callback no válido.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
      return;
    }
    
    // Validar URLs antes de guardar
    let invalidUrls = false;
    Object.entries(links).forEach(([key, value]) => {
      if (value && !isValidUrl(value)) {
        invalidUrls = true;
        Alert.alert('URL Inválida', `La URL para ${key} no es válida.`);
      }
    });
    
    if (invalidUrls) return;
    
    try {
      // Verificar que los enlaces son válidos
      const validatedLinks: SocialLinks = {};
      
      Object.entries(links).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          validatedLinks[key as keyof SocialLinks] = value.trim();
        }
      });
      
      // Obtener el callback del store
      const saveCallback = store.getCallback(callbackId);
      
      if (typeof saveCallback === 'function') {
        console.log(`Executing callback with ID: ${callbackId}`);
        console.log('Saving social links:', validatedLinks);
        
        // Llamar al callback con los datos actualizados
        saveCallback(validatedLinks);
        
        // Mostrar confirmación
        Alert.alert(
          "Éxito",
          "Enlaces sociales guardados correctamente.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error("Callback not found or not a function");
      }
    } catch (error) {
      console.error("Error saving social links:", error);
      Alert.alert(
        "Error",
        "No se pudieron guardar los enlaces. Inténtelo nuevamente.",
        [{ text: "OK" }]
      );
    }
  };
  
  // Confirmar antes de salir si hay cambios sin guardar
  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        "Cambios sin guardar",
        "Tienes cambios sin guardar. ¿Deseas descartarlos?",
        [
          { text: "No", style: "cancel" },
          { text: "Sí", onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Redes Sociales</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Guardar</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollContent}>
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Añade enlaces a las redes sociales y sitio web de tu negocio para que tus clientes puedan encontrarte fácilmente.
          </Text>
        </View>
        
        {/* Campos para cada red social */}
        <View style={styles.linksContainer}>
          {socialNetworks.map(network => (
            <View key={network.key} style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <MaterialIcons 
                  name={network.icon as any} 
                  size={24} 
                  color="#007AFF" 
                />
                <Text style={styles.labelText}>{network.label}</Text>
              </View>
              
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={links[network.key as keyof SocialLinks] || ''}
                  onChangeText={(text) => updateLink(network.key as keyof SocialLinks, text)}
                  placeholder={network.placeholder}
                  placeholderTextColor="#8E8E93"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                
                {links[network.key as keyof SocialLinks] ? (
                  <TouchableOpacity 
                    style={styles.testButton}
                    onPress={() => testLink(links[network.key as keyof SocialLinks] || '')}
                  >
                    <MaterialIcons name="open-in-new" size={24} color="#007AFF" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.emptyButton} />
                )}
              </View>
            </View>
          ))}
        </View>
        
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Consejos:</Text>
          <Text style={styles.tipText}>• Asegúrate de incluir la URL completa (ej: https://facebook.com/tunegocio).</Text>
          <Text style={styles.tipText}>• Si no tienes presencia en alguna red social, déjala en blanco.</Text>
          <Text style={styles.tipText}>• Verifica que los enlaces funcionen correctamente usando el botón de prueba.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E1F5FE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0277BD',
  },
  linksContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333333',
  },
  testButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyButton: {
    width: 44,
    height: 44,
    marginLeft: 8,
  },
  tipsContainer: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F5A623',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#8B7E69',
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default SocialLinksScreen;
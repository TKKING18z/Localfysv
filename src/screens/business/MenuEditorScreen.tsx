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
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import firebase from 'firebase/compat/app';
import 'firebase/compat/storage';
import { MenuItem } from '../../context/BusinessContext';

interface RouteParams {
  businessId: string;
  initialMenu?: MenuItem[];
  menuUrl?: string;
  onSave: (menu: MenuItem[], menuUrl: string) => void;
}

type MenuEditorRouteProp = RouteProp<{ params: RouteParams }, 'params'>;
type NavigationProp = StackNavigationProp<any>;

// Generar ID único
const generateUniqueId = () => {
  return `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Definición de la interfaz para los estilos
import { ViewStyle, TextStyle, ImageStyle } from 'react-native';

interface MenuEditorStyles {
  container: ViewStyle;
  header: ViewStyle;
  backButton: ViewStyle;
  headerTitle: TextStyle;
  saveButton: ViewStyle;
  saveButtonText: TextStyle;
  scrollContent: ViewStyle;
  infoBox: ViewStyle;
  infoText: TextStyle;
  sectionContainer: ViewStyle;
  sectionHeader: ViewStyle;
  sectionTitle: TextStyle;
  sectionDescription: TextStyle;
  urlInput: TextStyle;
  emptyState: ViewStyle;
  emptyStateText: TextStyle;
  emptyStateButton: ViewStyle;
  emptyStateButtonText: TextStyle;
  addButton: ViewStyle;
  addButtonText: TextStyle;
  menuItems: ViewStyle;
  menuItem: ViewStyle;
  menuItemLeft: ViewStyle;
  menuItemImage: ImageStyle;
  menuItemImagePlaceholder: ViewStyle;
  menuItemCenter: ViewStyle;
  menuItemName: TextStyle;
  menuItemDescription: TextStyle;
  categoryTag: ViewStyle;
  categoryTagText: TextStyle;
  menuItemRight: ViewStyle;
  menuItemPrice: TextStyle;
  editButton: ViewStyle;
  separator: ViewStyle;
  modalContainer: ViewStyle;
  modalContent: ViewStyle;
  modalHeader: ViewStyle;
  modalTitle: TextStyle;
  closeButton: ViewStyle;
  modalScrollContent: ViewStyle;
  fieldLabel: TextStyle;
  textInput: TextStyle;
  textArea: TextStyle;
  priceInputContainer: ViewStyle;
  priceCurrency: TextStyle;
  priceInput: TextStyle;
  categoryInputContainer: ViewStyle;
  categoryInput: TextStyle;
  imageSelectContainer: ViewStyle;
  imagePlaceholder: ViewStyle;
  imagePlaceholderText: TextStyle;
  selectedImage: ImageStyle;
  uploadingText: TextStyle;
  modalActions: ViewStyle;
  deleteButton: ViewStyle;
  deleteButtonText: TextStyle;
  saveItemButton: ViewStyle;
  disabledButton: ViewStyle;
  saveItemButtonText: TextStyle;
}

const MenuEditorScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MenuEditorRouteProp>();
  
  // Proporcionar un valor por defecto para onSave si es undefined
  const { 
    businessId, 
    initialMenu, 
    menuUrl: initialMenuUrl, 
    onSave = (menu: MenuItem[], menuUrl: string) => {
      console.warn('onSave callback no proporcionado');
      // Si deseas, puedes almacenar los datos en localStorage o similar como fallback
    } 
  } = route.params || {}; // Asegúrate de manejar el caso donde route.params sea undefined
  
  // Estado para los items del menú
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenu || []);
  const [menuUrl, setMenuUrl] = useState<string>(initialMenuUrl || '');
  
  // Estado para las categorías de menú
  const [categories, setCategories] = useState<string[]>([]);
  
  // Estado para el modal de edición
  const [modalVisible, setModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<MenuItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Estados para el formulario del modal
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemImage, setItemImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Cargar categorías existentes al inicio
  useEffect(() => {
    if (menuItems.length > 0) {
      const uniqueCategories = [...new Set(menuItems.map(item => item.category || '').filter(Boolean))];
      setCategories(uniqueCategories);
    }
  }, []);
  
  // Seleccionar imagen
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para seleccionar imágenes.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUri = result.assets[0].uri;
      setItemImage(selectedUri);
    }
  };
  
  // Subir imagen a Firebase Storage
  const uploadImage = async (uri: string): Promise<string> => {
    setUploadingImage(true);
    
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Usar la ruta temp_uploads que ya está permitida en tus reglas
      const userId = firebase.auth().currentUser?.uid || 'anonymous';
      const imageName = `temp_uploads/${userId}/${Date.now()}_menu_item.jpg`;
      const ref = firebase.storage().ref().child(imageName);
      
      await ref.put(blob);
      const downloadUrl = await ref.getDownloadURL();
      
      return downloadUrl;
    } catch (error) {
      console.error('Error al subir imagen:', error);
      throw new Error('No se pudo subir la imagen. Intenta nuevamente.');
    } finally {
      setUploadingImage(false);
    }
  };
  
  // Añadir o actualizar item
  const saveItem = async () => {
    // Validación básica
    if (!itemName.trim()) {
      Alert.alert('Error', 'El nombre del producto es obligatorio');
      return;
    }
    
    if (!itemPrice.trim() || isNaN(parseFloat(itemPrice))) {
      Alert.alert('Error', 'Precio inválido');
      return;
    }
    
    try {
      let imageUrl = currentItem?.imageUrl || null;
      
      // Si hay una nueva imagen seleccionada, subirla
      if (itemImage && !itemImage.startsWith('http')) {
        imageUrl = await uploadImage(itemImage);
      }
      
      const itemData: MenuItem = {
        id: currentItem?.id || generateUniqueId(),
        name: itemName.trim(),
        price: parseFloat(itemPrice),
        description: itemDescription.trim() || undefined,
        category: itemCategory.trim() || undefined,
        imageUrl: imageUrl || undefined
      };
      
      if (editMode) {
        // Actualizar item existente
        setMenuItems(prev => prev.map(item => 
          item.id === itemData.id ? itemData : item
        ));
      } else {
        // Añadir nuevo item
        setMenuItems(prev => [...prev, itemData]);
      }
      
      // Actualizar categorías si es necesario
      if (itemCategory && !categories.includes(itemCategory)) {
        setCategories(prev => [...prev, itemCategory]);
      }
      
      // Cerrar modal y limpiar estado
      closeModal();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Error desconocido');
    }
  };
  
  // Eliminar item
  const deleteItem = (id: string) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar este item del menú?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: () => {
            setMenuItems(prev => prev.filter(item => item.id !== id));
            
            // Actualizar categorías si es necesario
            const remainingCategories = [...new Set(
              menuItems.filter(item => item.id !== id)
                .map(item => item.category || '')
                .filter(Boolean)
            )];
            setCategories(remainingCategories);
            
            // Cerrar modal si está abierto
            if (modalVisible) {
              closeModal();
            }
          }
        },
      ]
    );
  };
  
  // Abrir modal para editar
  const openEditModal = (item: MenuItem) => {
    setCurrentItem(item);
    setItemName(item.name);
    setItemPrice(item.price.toString());
    setItemDescription(item.description || '');
    setItemCategory(item.category || '');
    setItemImage(item.imageUrl || null);
    setEditMode(true);
    setModalVisible(true);
  };
  
  // Abrir modal para añadir
  const openAddModal = () => {
    setCurrentItem(null);
    setItemName('');
    setItemPrice('');
    setItemDescription('');
    setItemCategory(categories.length > 0 ? categories[0] : '');
    setItemImage(null);
    setEditMode(false);
    setModalVisible(true);
  };
  
  // Cerrar modal
  const closeModal = () => {
    setModalVisible(false);
    setCurrentItem(null);
    setItemName('');
    setItemPrice('');
    setItemDescription('');
    setItemCategory('');
    setItemImage(null);
    setEditMode(false);
  };
  
  // Guardar todo con verificación adicional
  const handleSave = () => {
    try {
      // Verificar explícitamente si onSave es una función
      if (typeof onSave === 'function') {
        onSave(menuItems, menuUrl);
      } else {
        // Mostrar una alerta si onSave no es una función
        Alert.alert(
          'Advertencia',
          'Los cambios no se guardarán debido a un error de configuración.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error al guardar el menú:', error);
      Alert.alert('Error', 'No se pudieron guardar los cambios. Por favor, inténtalo de nuevo.');
    } finally {
      // Siempre volver atrás, independientemente de si onSave funcionó o no
      navigation.goBack();
    }
  };
  
  // Renderizar item de menú
  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity 
      style={styles.menuItem}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.menuItemLeft}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.menuItemImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.menuItemImagePlaceholder}>
            <MaterialIcons name="fastfood" size={24} color="#8E8E93" />
          </View>
        )}
      </View>
      
      <View style={styles.menuItemCenter}>
        <Text style={styles.menuItemName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.menuItemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        {item.category && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{item.category}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.menuItemRight}>
        <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => openEditModal(item)}
        >
          <MaterialIcons name="edit" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editor de Menú</Text>
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
            Añade los productos de tu menú con precios y descripciones. También puedes proporcionar un enlace a tu menú completo.
          </Text>
        </View>
        
        {/* Enlace de menú externo */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Enlace a Menú Externo (Opcional)</Text>
          <Text style={styles.sectionDescription}>
            Puedes proporcionar un enlace a un menú PDF, imagen o sitio web.
          </Text>
          
          <TextInput
            style={styles.urlInput}
            value={menuUrl}
            onChangeText={setMenuUrl}
            placeholder="https://ejemplo.com/menu"
            placeholderTextColor="#8E8E93"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        
        {/* Lista de items del menú */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items del Menú</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={openAddModal}
            >
              <MaterialIcons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Añadir</Text>
            </TouchableOpacity>
          </View>
          
          {menuItems.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="restaurant-menu" size={48} color="#D1D1D6" />
              <Text style={styles.emptyStateText}>
                Tu menú está vacío. ¡Añade algunos productos!
              </Text>
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={openAddModal}
              >
                <Text style={styles.emptyStateButtonText}>Añadir Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.menuItems}>
              <FlatList
                data={menuItems}
                renderItem={renderMenuItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Modal para añadir/editar item */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editMode ? 'Editar Item' : 'Añadir Item'}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeModal}
              >
                <MaterialIcons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollContent}>
              {/* Nombre */}
              <Text style={styles.fieldLabel}>Nombre *</Text>
              <TextInput
                style={styles.textInput}
                value={itemName}
                onChangeText={setItemName}
                placeholder="Ej. Hamburguesa Clásica"
                placeholderTextColor="#8E8E93"
              />
              
              {/* Precio */}
              <Text style={styles.fieldLabel}>Precio *</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceCurrency}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={itemPrice}
                  onChangeText={setItemPrice}
                  placeholder="0.00"
                  placeholderTextColor="#8E8E93"
                  keyboardType="decimal-pad"
                />
              </View>
              
              {/* Descripción */}
              <Text style={styles.fieldLabel}>Descripción</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={itemDescription}
                onChangeText={setItemDescription}
                placeholder="Descripción del producto..."
                placeholderTextColor="#8E8E93"
                multiline
                numberOfLines={4}
              />
              
              {/* Categoría */}
              <Text style={styles.fieldLabel}>Categoría</Text>
              <View style={styles.categoryInputContainer}>
                <TextInput
                  style={styles.categoryInput}
                  value={itemCategory}
                  onChangeText={setItemCategory}
                  placeholder="Ej. Entradas, Platos Principales, Postres"
                  placeholderTextColor="#8E8E93"
                />
                {categories.length > 0 && (
                  <MaterialIcons 
                    name="arrow-drop-down" 
                    size={24} 
                    color="#8E8E93"
                    onPress={() => {
                      // Mostrar selector de categorías
                      Alert.alert(
                        'Seleccionar Categoría',
                        'Elige una categoría existente o escribe una nueva',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          ...categories.map(cat => ({
                            text: cat,
                            onPress: () => setItemCategory(cat)
                          }))
                        ]
                      );
                    }} 
                  />
                )}
              </View>
              
              {/* Imagen */}
              <Text style={styles.fieldLabel}>Imagen (Opcional)</Text>
              <TouchableOpacity 
                style={styles.imageSelectContainer}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                {itemImage ? (
                  <Image
                    source={{ uri: itemImage }}
                    style={styles.selectedImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialIcons name="add-photo-alternate" size={48} color="#8E8E93" />
                    <Text style={styles.imagePlaceholderText}>
                      Seleccionar Imagen
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              
              {uploadingImage && (
                <Text style={styles.uploadingText}>Subiendo imagen...</Text>
              )}
              
              {/* Botones de acción */}
              <View style={styles.modalActions}>
                {editMode && (
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => currentItem && deleteItem(currentItem.id)}
                  >
                    <MaterialIcons name="delete" size={20} color="#FFFFFF" />
                    <Text style={styles.deleteButtonText}>Eliminar</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={[
                    styles.saveItemButton,
                    uploadingImage ? styles.disabledButton : {},
                    // Usar marginLeft como propiedad dinámica basada en editMode
                    { marginLeft: editMode ? 8 : 0 }
                  ]}
                  onPress={saveItem}
                  disabled={uploadingImage}
                >
                  <MaterialIcons name="check" size={20} color="#FFFFFF" />
                  <Text style={styles.saveItemButtonText}>
                    {editMode ? 'Actualizar' : 'Añadir'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create<MenuEditorStyles>({
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
  sectionContainer: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  urlInput: {
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginVertical: 16,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 4,
  },
  menuItems: {
    // Contenedor para la lista de ítems
  },
  menuItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  menuItemLeft: {
    marginRight: 12,
  },
  menuItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  menuItemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  categoryTag: {
    backgroundColor: '#007AFF20',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  categoryTagText: {
    fontSize: 12,
    color: '#007AFF',
  },
  menuItemRight: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  editButton: {
    padding: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    padding: 4,
  },
  modalScrollContent: {
    padding: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    marginBottom: 16,
  },
  priceCurrency: {
    fontSize: 16,
    color: '#333333',
    paddingLeft: 12,
  },
  priceInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  categoryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    marginBottom: 16,
  },
  categoryInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  imageSelectContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F5',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  uploadingText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 32,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  saveItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    marginLeft: 0, // Este valor se sobrescribe dinámicamente
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#A2D1FF',
  },
  saveItemButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
});

export default MenuEditorScreen;
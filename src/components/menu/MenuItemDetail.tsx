import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  Dimensions,
  ScrollView,
  Alert
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';

const { width, height } = Dimensions.get('window');

interface MenuItemDetailProps {
  visible: boolean;
  onClose: () => void;
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  businessId: string;
  businessName: string;
}

const MenuItemDetail: React.FC<MenuItemDetailProps> = ({
  visible,
  onClose,
  id,
  name,
  description,
  price,
  image,
  businessId,
  businessName,
}) => {
  const [quantity, setQuantity] = useState(1);
  const { cart, addToCart } = useCart();

  const handleAddToCart = async () => {
    // Asegurarse de que siempre haya un nombre de negocio
    const itemBusinessName = businessName || 'Localfy';
    
    // Si ya tenemos items de otro negocio, confirmar si quiere reemplazar
    if (cart.businessId && cart.businessId !== businessId && cart.items.length > 0) {
      Alert.alert(
        "Pedido de otro negocio",
        `Ya tienes items en tu carrito de ${cart.businessName}. ¿Deseas reemplazar tu carrito actual?`,
        [
          {
            text: "Cancelar",
            style: "cancel"
          },
          {
            text: "Reemplazar", 
            onPress: async () => {
              await addToCart({
                id,
                name,
                price,
                quantity,
                businessId,
                businessName: itemBusinessName,
                image
              });
              onClose();
            }
          }
        ]
      );
      return;
    }
    
    // Agregar al carrito
    await addToCart({
      id,
      name,
      price,
      quantity,
      businessId,
      businessName: itemBusinessName,
      image
    });
    
    // Mostrar confirmación
    Alert.alert(
      "Añadido al carrito",
      `${name} ha sido añadido a tu carrito`,
      [{ text: "OK" }]
    );
    
    // Resetear cantidad y cerrar modal
    setQuantity(1);
    onClose();
  };

  const incrementQuantity = () => setQuantity(prev => prev + 1);
  
  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Header con botón de cierre */}
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{name}</Text>
              <View style={{ width: 30 }} />
            </View>
            
            <ScrollView style={styles.contentScroll}>
              {/* Imagen del producto */}
              <View style={styles.imageContainer}>
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={styles.image}
                    contentFit="cover"
                    transition={300}
                  />
                ) : (
                  <View style={styles.placeholderImage}>
                    <MaterialIcons name="restaurant" size={48} color="#BBBBBB" />
                  </View>
                )}
              </View>
              
              {/* Detalles del producto */}
              <View style={styles.detailsContainer}>
                <Text style={styles.itemName}>{name}</Text>
                <Text style={styles.itemPrice}>${price.toFixed(2)}</Text>
                
                {description ? (
                  <Text style={styles.itemDescription}>{description}</Text>
                ) : (
                  <Text style={styles.noDescription}>No hay descripción disponible</Text>
                )}
              </View>
            </ScrollView>
            
            {/* Barra de acciones inferior */}
            <View style={styles.actionsContainer}>
              <View style={styles.quantityContainer}>
                <Text style={styles.quantityLabel}>Cantidad:</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity 
                    style={styles.quantityButton}
                    onPress={decrementQuantity}
                    disabled={quantity <= 1}
                  >
                    <MaterialIcons 
                      name="remove" 
                      size={20} 
                      color={quantity <= 1 ? "#CCCCCC" : "#007AFF"} 
                    />
                  </TouchableOpacity>
                  <Text style={styles.quantityValue}>{quantity}</Text>
                  <TouchableOpacity 
                    style={styles.quantityButton}
                    onPress={incrementQuantity}
                  >
                    <MaterialIcons name="add" size={20} color="#007AFF" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.addToCartButton}
                onPress={handleAddToCart}
              >
                <MaterialIcons name="shopping-cart" size={20} color="#FFFFFF" />
                <Text style={styles.addToCartText}>
                  Agregar - ${(price * quantity).toFixed(2)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContent: {
    width: width * 0.9,
    height: height * 0.6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 200,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 16,
  },
  itemName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 16,
  },
  itemDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  noDescription: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  actionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  addToCartButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default MenuItemDetail; 
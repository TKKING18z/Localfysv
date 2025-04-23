import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Platform,
  Alert 
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart, CartItem } from '../../context/CartContext';
import MenuItemDetail from './MenuItemDetail';

type MenuItemProps = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  businessId: string;
  businessName: string;
  onPress?: () => void;
  hasOptions?: boolean;
};

const MenuItem: React.FC<MenuItemProps> = ({
  id,
  name,
  description,
  price,
  image,
  businessId,
  businessName,
  onPress,
  hasOptions = false
}) => {
  const [quantity, setQuantity] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { cart, addToCart } = useCart();
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      setShowDetailModal(true);
    }
  };
  
  const handleAddToCart = async () => {
    // Si el item tiene opciones, ir a la pantalla de detalle
    if (hasOptions) {
      handlePress();
      return;
    }
    
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
    
    // Resetear cantidad
    setQuantity(1);
  };
  
  const incrementQuantity = () => setQuantity(prev => prev + 1);
  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };
  
  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.contentRow}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <MaterialIcons name="restaurant" size={28} color="#BBBBBB" />
            </View>
          )}
          
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={2}>{name}</Text>
            {description && (
              <Text style={styles.description} numberOfLines={2}>{description}</Text>
            )}
            <Text style={styles.price}>${price.toFixed(2)}</Text>
          </View>
        </View>
        
        <View style={styles.actions}>
          {hasOptions ? (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={handleAddToCart}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add-shopping-cart" size={22} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Ver</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quantityContainer}>
              <View style={styles.quantitySelector}>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={decrementQuantity}
                  disabled={quantity <= 1}
                >
                  <MaterialIcons name="remove" size={20} color={quantity <= 1 ? "#CCCCCC" : "#007AFF"} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={incrementQuantity}
                >
                  <MaterialIcons name="add" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.addButton}
                onPress={handleAddToCart}
                activeOpacity={0.7}
              >
                <MaterialIcons name="add-shopping-cart" size={22} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      {/* Modal de detalle */}
      <MenuItemDetail 
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        id={id}
        name={name}
        description={description}
        price={price}
        image={image}
        businessId={businessId}
        businessName={businessName}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginVertical: 6,
    marginHorizontal: 2,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  contentRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  image: {
    width: 85,
    height: 85,
    borderRadius: 8,
  },
  placeholderImage: {
    width: 85,
    height: 85,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 8,
    lineHeight: 18,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  actions: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  quantityContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    width: 100,
    height: 36,
    justifyContent: 'space-between',
  },
  quantityButton: {
    padding: 6,
    width: 32,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600',
    width: 32,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
    height: 36,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 6,
  },
});

export default MenuItem;

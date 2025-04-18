import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { firebaseService } from '../../services/firebaseService';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Promotion } from '../../types/businessTypes';
import PromoCard from '../../components/promotions/PromoCard';
import PromotionForm from '../../components/promotions/PromotionForm';
import { useStore } from '../../context/StoreContext';

// Definir explícitamente los parámetros que espera esta pantalla
type PromotionsScreenParams = {
  businessId: string;
  businessName: string;
  isNewBusiness?: boolean;
};

// Corregir el tipo para la ruta
type PromotionsRouteProp = RouteProp<{ params: PromotionsScreenParams }, 'params'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const PromotionsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PromotionsRouteProp>();
  const { businessId, businessName } = route.params;
  const { setTempData, getTempData } = useStore();

  // Estados
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);

  // Check if this is a temporary business
  const isTempBusiness = businessId.toString().startsWith('temp_') || businessId === 'new_business';

  // Cargar promociones
  const loadPromotions = useCallback(async () => {
    try {
      setLoading(true);

      // For temporary businesses, get promotions from StoreContext
      if (isTempBusiness) {
        console.log(`Loading temporary promotions for ${businessId}`);
        const tempPromotions = getTempData(`promotions_${businessId}`) || [];
        console.log(`Found ${tempPromotions.length} temporary promotions`);
        
        // CAMBIO: Solo actualizar si es necesario
        setPromotions(tempPromotions);
        
        // CAMBIO: Solo actualizar si es nuevo negocio Y hay promociones
        if (businessId === 'new_business' && tempPromotions.length > 0) {
          // Actualizar solo si es necesario para evitar bucles
          const existingData = getTempData('promotions_new_business') || [];
          if (JSON.stringify(existingData) !== JSON.stringify(tempPromotions)) {
            setTempData('promotions_new_business', tempPromotions);
            setTempData('tempPromotions', true);
          }
        }
        
        setLoading(false);
        return;
      }

      const result = await firebaseService.promotions.getByBusinessId(businessId);

      if (result.success && result.data) {
        setPromotions(result.data);
      } else {
        console.error('Error cargando promociones:', result.error);
        Alert.alert('Error', 'No se pudieron cargar las promociones');
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      Alert.alert('Error', 'Ocurrió un error al cargar las promociones');
    } finally {
      setLoading(false);
    }
  }, [businessId, isTempBusiness, getTempData, setTempData]);

  // Cargar al montar el componente
  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  // Refrescar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPromotions();
    setRefreshing(false);
  };

  // Abrir formulario para editar
  const handleEdit = (promotion: Promotion) => {
    setSelectedPromotion(promotion);
    setShowForm(true);
  };

  // Eliminar promoción
  const handleDelete = (promotion: Promotion) => {
    Alert.alert(
      'Eliminar Promoción',
      '¿Está seguro de que desea eliminar esta promoción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isTempBusiness) {
                // For temporary businesses, delete from StoreContext
                const currentPromotions = getTempData(`promotions_${businessId}`) || [];
                const updatedPromotions = currentPromotions.filter((p: Promotion) => p.id !== promotion.id);
                // Actualizar ambas claves para reactividad
                setTempData(`promotions_${businessId}`, updatedPromotions);
                setTempData('promotions_new_business', updatedPromotions);

                // Actualizar el indicador si no quedan promociones
                if (businessId === 'new_business' && updatedPromotions.length === 0) {
                  setTempData('tempPromotions', false);
                }

                setPromotions(updatedPromotions);
                Alert.alert('Éxito', 'Promoción eliminada correctamente');
                return;
              }

              // Regular delete for non-temporary businesses
              const result = await firebaseService.promotions.delete(promotion.id);
              if (result.success) {
                // Actualizar lista localmente
                setPromotions(prev => prev.filter(p => p.id !== promotion.id));
                Alert.alert('Éxito', 'Promoción eliminada correctamente');
              } else {
                throw new Error(result.error?.message || 'Error eliminando promoción');
              }
            } catch (error) {
              console.error('Error al eliminar:', error);
              Alert.alert('Error', 'No se pudo eliminar la promoción');
            }
          }
        }
      ]
    );
  };

  // Guardar promoción (nueva o editada)
  const handleSave = async (promotionData: any) => {
    try {
      // For temporary businesses, store in StoreContext
      if (isTempBusiness) {
        console.log(`Saving temporary promotion for ${businessId}`);
        const currentPromotions = getTempData(`promotions_${businessId}`) || [];
        let updatedPromotions = [...currentPromotions];

        if (selectedPromotion) {
          // Update existing
          updatedPromotions = updatedPromotions.map(p =>
            p.id === selectedPromotion.id ? { ...p, ...promotionData } : p
          );
          console.log(`Updated existing temporary promotion: ${selectedPromotion.id}`);
        } else {
          // Add new with temp ID
          const tempPromotion = {
            ...promotionData,
            id: 'temp_promo_' + Date.now(),
            businessId,
            isActive: true,
          };
          updatedPromotions.push(tempPromotion);
          console.log(`Created new temporary promotion: ${tempPromotion.id}`);
        }

        // Save to StoreContext and update local state
        setTempData(`promotions_${businessId}`, updatedPromotions);
        setTempData('promotions_new_business', updatedPromotions);

        // Actualizar indicador para AddBusinessScreen
        if (businessId === 'new_business') {
          setTempData('tempPromotions', true);
        }

        setPromotions(updatedPromotions);

        setShowForm(false);
        setSelectedPromotion(null);
        Alert.alert('Éxito', 'Promoción guardada localmente. Se creará cuando registre el negocio.');
        return;
      }

      let result;

      if (selectedPromotion) {
        // Actualizar existente
        result = await firebaseService.promotions.update(selectedPromotion.id, promotionData);
        if (result.success) {
          // Actualizar en la lista local
          setPromotions(prev =>
            prev.map(p => p.id === selectedPromotion.id ? { ...p, ...promotionData } : p)
          );
        }
      } else {
        // Crear nueva
        const newPromotion = {
          ...promotionData,
          businessId,
          isActive: true,
        };

        result = await firebaseService.promotions.create(newPromotion);

        if (result.success && result.data) {
          // Recargar para obtener la nueva promoción
          await loadPromotions();
        }
      }

      if (result?.success) {
        setShowForm(false);
        setSelectedPromotion(null);
        Alert.alert('Éxito', 'Promoción guardada correctamente');
      } else {
        throw new Error(result?.error?.message || 'Error guardando promoción');
      }
    } catch (error) {
      console.error('Error guardando promoción:', error);
      Alert.alert('Error', 'No se pudo guardar la promoción');
    }
  };

  // Renderizar cada promoción
  const renderPromotion = ({ item }: { item: Promotion }) => (
    <View style={styles.promoItemContainer}>
      <PromoCard promotion={item} />
      <View style={styles.promoActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEdit(item)}
        >
          <MaterialIcons name="edit" size={22} color="#007AFF" />
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
        >
          <MaterialIcons name="delete" size={22} color="#FF3B30" />
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promociones</Text>
        <TouchableOpacity
          onPress={() => {
            setSelectedPromotion(null);
            setShowForm(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="add-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Información del negocio */}
      <View style={styles.businessInfo}>
        <Text style={styles.businessName}>{businessName}</Text>
      </View>

      {/* Add info banner for new businesses */}
      {isTempBusiness && (
        <View style={styles.infoBanner}>
          <MaterialIcons name="info" size={20} color="#007AFF" />
          <Text style={styles.infoBannerText}>
            Las promociones se guardarán cuando el negocio sea creado.
          </Text>
        </View>
      )}

      {/* Lista de promociones */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando promociones...</Text>
        </View>
      ) : (
        <FlatList
          data={promotions}
          renderItem={renderPromotion}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#007AFF"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="local-offer" size={64} color="#E5E5EA" />
              <Text style={styles.emptyText}>
                No hay promociones disponibles
              </Text>
              <Text style={styles.emptySubtext}>
                Las promociones atraen más clientes. ¡Crea una ahora!
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => {
                  setSelectedPromotion(null);
                  setShowForm(true);
                }}
              >
                <MaterialIcons name="add" size={20} color="white" />
                <Text style={styles.createButtonText}>Crear Promoción</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal para formulario */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          Alert.alert(
            "Descartar cambios",
            "¿Estás seguro que deseas cerrar sin guardar?",
            [
              { text: "Continuar editando", style: "cancel" },
              { text: "Descartar", onPress: () => setShowForm(false) }
            ]
          );
        }}
      >
        <PromotionForm
          businessId={businessId}
          initialValues={selectedPromotion || undefined}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setSelectedPromotion(null);
          }}
        />
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  businessInfo: {
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  businessName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  listContent: {
    padding: 16,
  },
  promoItemContainer: {
    marginBottom: 24,
  },
  promoActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  editButtonText: {
    color: '#007AFF',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    margin: 16,
    alignItems: 'center',
  },
  infoBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
  },
});

export default PromotionsScreen;
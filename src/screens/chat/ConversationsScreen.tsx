import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Alert,
  TextInput,
  Keyboard,
  Animated,
  Platform
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import ConversationItem from '../../components/chat/ConversationItem';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Conversation } from '../../../models/chatTypes';
import * as Haptics from 'expo-haptics';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NotificationService from '../../../services/NotificationService';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Conversations'>;

const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { 
    conversations: contextConversations, 
    loading: contextLoading, 
    error: contextError, 
    refreshConversations: contextRefreshConversations, 
    setActiveConversationId,
    unreadTotal,
    deleteConversation,
    isOffline
  } = useChat();
  
  // Enhanced local state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  
  // Estado para selección múltiple
  const [isMultiSelectActive, setIsMultiSelectActive] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const searchWidth = useRef(new Animated.Value(0)).current;
  const actionBarSlideAnim = useRef(new Animated.Value(100)).current;
  
  // Track swipeable rows for proper handling
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const prevOpenedRow = useRef<string | null>(null);
  
  // Utilizamos un ref para controlar si ya se hizo la carga inicial
  const initialLoadDone = useRef(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Añadir un bloqueo de tiempo para evitar refrescos demasiado frecuentes
  const lastRefreshTimestamp = useRef<number>(0);
  const REFRESH_COOLDOWN = 3000; // Mínimo 3 segundos entre refrescos
  
  // Añadir un nuevo estado para mostrar la guía de uso
  const [showSelectionHelp, setShowSelectionHelp] = useState(false);
  
  // Filter conversations based on search query
  const filterConversations = useCallback((query: string, conversationsToFilter = conversations) => {
    if (!query.trim()) {
      setFilteredConversations(conversationsToFilter);
      return;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    const filtered = conversationsToFilter.filter(conv => {
      // Check for matches in participant names
      const participantMatch = Object.values(conv.participantNames).some(
        name => name.toLowerCase().includes(lowerQuery)
      );
      
      // Check for matches in business name
      const businessMatch = conv.businessName 
        ? conv.businessName.toLowerCase().includes(lowerQuery)
        : false;
        
      // Check for matches in last message
      const messageMatch = conv.lastMessage?.text 
        ? conv.lastMessage.text.toLowerCase().includes(lowerQuery)
        : false;
        
      return participantMatch || businessMatch || messageMatch;
    });
    
    setFilteredConversations(filtered);
  }, [conversations]);
  
  // Handle search query changes
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    filterConversations(text);
  }, [filterConversations]);
  
  // Toggle search bar visibility
  const toggleSearch = useCallback(() => {
    if (isSearchActive) {
      // Hide search bar
      Animated.timing(searchWidth, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }).start(() => {
        setIsSearchActive(false);
        setSearchQuery('');
        filterConversations('');
        Keyboard.dismiss();
      });
    } else {
      // Show search bar
      setIsSearchActive(true);
      Animated.timing(searchWidth, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false
      }).start();
    }
  }, [isSearchActive, searchWidth, filterConversations]);
  
  // Enhanced refresh function - sin desactivar la multiseleción
  const refreshConversations = useCallback(async () => {
    if (!user) {
      return;
    }
    
    if (isOffline) {
      setError('No hay conexión a internet. Conéctate para actualizar.');
      return;
    }
    
    // Comprobar si ya hay un refresco en curso
    if (refreshing) {
      console.log('[ConversationsScreen] Evitando refresco múltiple - ya en progreso');
      return;
    }
    
    // Comprobar si ha pasado suficiente tiempo desde el último refresco
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimestamp.current;
    if (timeSinceLastRefresh < REFRESH_COOLDOWN) {
      console.log(`[ConversationsScreen] Evitando refresco demasiado frecuente - último hace ${timeSinceLastRefresh}ms`);
      return;
    }
    
    try {
      lastRefreshTimestamp.current = now;
      setRefreshing(true);
      
      // Close any opened swipeable rows
      if (prevOpenedRow.current) {
        const swipeable = swipeableRefs.current.get(prevOpenedRow.current);
        if (swipeable) {
          swipeable.close();
        }
        prevOpenedRow.current = null;
      }
      
      // IMPORTANTE: Ya no desactivamos el modo multi-selección durante refrescos
      // Guardar las conversaciones seleccionadas antes de refrescar
      const selectedIds = Array.from(selectedConversations);
      
      // Execute the context's refresh function
      console.log('[ConversationsScreen] Ejecutando refresco real de conversaciones');
      await contextRefreshConversations();
      
      // Restaurar selecciones después del refresco
      if (isMultiSelectActive && selectedIds.length > 0) {
        // Verificar que las conversaciones seleccionadas todavía existen
        const newSelectedIds = selectedIds.filter(id => 
          contextConversations.some(conv => conv.id === id)
        );
        setSelectedConversations(new Set(newSelectedIds));
      }
      
      console.log('[ConversationsScreen] Refresco completado');
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      setError('Error al actualizar. Intenta de nuevo.');
    } finally {
      // Uso de setTimeout para evitar actualizar estado si el componente se desmontó
      setTimeout(() => {
        setRefreshing(false);
      }, 300);
    }
  }, [user, contextRefreshConversations, isOffline, refreshing, isMultiSelectActive, selectedConversations, contextConversations]);
  
  // Mostrar guía de ayuda al activar el modo selección por primera vez
  const toggleMultiSelect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Si está activo, lo desactivamos y limpiamos selecciones
    if (isMultiSelectActive) {
      setIsMultiSelectActive(false);
      setSelectedConversations(new Set());
      
      // Animación para ocultar barra de acciones
      Animated.timing(actionBarSlideAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true
      }).start();
    } else {
      // Activamos modo selección
      setIsMultiSelectActive(true);
      
      // Mostrar ayuda la primera vez
      AsyncStorage.getItem('multiselect_help_shown').then(value => {
        if (!value) {
          setShowSelectionHelp(true);
          AsyncStorage.setItem('multiselect_help_shown', 'true');
        }
      }).catch(err => {
        console.error('[ConversationsScreen] Error comprobando estado de ayuda:', err);
      });
      
      // Cerrar búsqueda si está activa
      if (isSearchActive) {
        toggleSearch();
      }
      
      // Cerrar cualquier swipeable abierto
      if (prevOpenedRow.current) {
        const swipeable = swipeableRefs.current.get(prevOpenedRow.current);
        if (swipeable) {
          swipeable.close();
        }
        prevOpenedRow.current = null;
      }
      
      // Animación para mostrar barra de acciones
      Animated.timing(actionBarSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [isMultiSelectActive, isSearchActive, toggleSearch, actionBarSlideAnim]);

  // Seleccionar/deseleccionar una conversación
  const toggleConversationSelection = useCallback((conversationId: string) => {
    if (!isMultiSelectActive) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setSelectedConversations(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(conversationId)) {
        newSelection.delete(conversationId);
      } else {
        newSelection.add(conversationId);
      }
      return newSelection;
    });
  }, [isMultiSelectActive]);

  // Seleccionar todas las conversaciones
  const selectAllConversations = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const displayConvs = isSearchActive ? filteredConversations : conversations;
    const allIds = new Set(displayConvs.map(conv => conv.id));
    
    if (selectedConversations.size === allIds.size) {
      // Si todas están seleccionadas, deseleccionar todas
      setSelectedConversations(new Set());
    } else {
      // Seleccionar todas
      setSelectedConversations(allIds);
    }
  }, [conversations, filteredConversations, isSearchActive, selectedConversations]);

  // Eliminar las conversaciones seleccionadas
  const deleteSelectedConversations = useCallback(async () => {
    if (selectedConversations.size === 0 || isDeleting) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const count = selectedConversations.size;
    
    Alert.alert(
      `Eliminar ${count} conversación${count > 1 ? 'es' : ''}`,
      `¿Estás seguro de que quieres eliminar ${count === 1 ? 'esta conversación' : 'estas ' + count + ' conversaciones'}? Esta acción no se puede deshacer.`,
      [
        { 
          text: "Cancelar", 
          style: "cancel" 
        },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            try {
              setIsDeleting(true);
              
              // 1. Primero eliminamos los elementos de la UI para feedback inmediato
              const selectedIds = Array.from(selectedConversations);
              setConversations(prev => prev.filter(conv => !selectedIds.includes(conv.id)));
              setFilteredConversations(prev => prev.filter(conv => !selectedIds.includes(conv.id)));
              
              // 2. Ejecutar eliminación en Firestore (secuencial para mayor fiabilidad)
              let successCount = 0;
              let failCount = 0;
              
              for (const convId of selectedIds) {
                try {
                  const success = await deleteConversation(convId);
                  if (success) {
                    successCount++;
                  } else {
                    failCount++;
                  }
                } catch (err) {
                  console.error(`Error eliminando conversación ${convId}:`, err);
                  failCount++;
                }
              }
              
              // 3. Informar resultados
              if (failCount > 0) {
                Alert.alert(
                  "Eliminación parcial",
                  `${successCount} conversación(es) eliminada(s) correctamente.\n${failCount} no pudieron eliminarse.\n\nLos errores pueden deberse a problemas de conexión.`,
                  [{ text: "Entendido" }]
                );
                
                // Refrescar para sincronizar el estado
                refreshConversations();
              } else if (successCount > 0) {
                // Éxito completo
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                if (successCount > 3) {
                  Alert.alert(
                    "Eliminación completada",
                    `${successCount} conversaciones eliminadas con éxito.`,
                    [{ text: "OK" }]
                  );
                }
                
                // 4. Salir del modo selección automáticamente solo si se eliminaron todas
                if (successCount === count) {
                  toggleMultiSelect();
                } else {
                  // Si solo se eliminaron algunas, actualizamos la selección
                  setSelectedConversations(new Set());
                }
              }
            } catch (error) {
              console.error('Error eliminando conversaciones:', error);
              Alert.alert(
                "Error", 
                "Ocurrió un error inesperado al eliminar las conversaciones. Inténtalo de nuevo.",
                [{ text: "OK" }]
              );
              refreshConversations();
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  }, [selectedConversations, isDeleting, deleteConversation, refreshConversations, toggleMultiSelect]);
  
  // Navigate back
  const handleBackPress = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  }, [navigation]);
  
  // Confirm deletion
  const confirmDelete = useCallback((conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      "Eliminar conversación",
      "¿Estás seguro de que quieres eliminar esta conversación?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            try {
              setLoading(true);
              
              // Close any opened swipeable
              if (prevOpenedRow.current) {
                const swipeable = swipeableRefs.current.get(prevOpenedRow.current);
                if (swipeable) {
                  swipeable.close();
                }
                prevOpenedRow.current = null;
              }
              
              // 1. Remove from UI immediately for feedback
              setConversations(prev => prev.filter(conv => conv.id !== conversationId));
              setFilteredConversations(prev => prev.filter(conv => conv.id !== conversationId));
              
              // 2. Execute deletion in Firestore
              const success = await deleteConversation(conversationId);
              
              if (!success) {
                console.error(`Failed to delete conversation ${conversationId}`);
                // Restore the conversation if failed and refresh from Firestore
                refreshConversations();
                Alert.alert("Error", "No se pudo eliminar la conversación. Inténtalo de nuevo.");
              } else {
                console.log(`Successfully deleted conversation ${conversationId}`);
                // Success feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              console.error('Error al eliminar conversación:', error);
              refreshConversations(); // Restore state
              Alert.alert("Error", "Ocurrió un error inesperado. Inténtalo de nuevo.");
            } finally {
              setLoading(false);
            }
          } 
        }
      ]
    );
  }, [deleteConversation, refreshConversations]);

  // Render right actions (delete button)
  const renderRightActions = useCallback((conversationId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          // Close swipeable before confirming
          const swipeable = swipeableRefs.current.get(conversationId);
          if (swipeable) {
            swipeable.close();
          }
          // Show confirmation
          confirmDelete(conversationId);
        }}
        activeOpacity={0.9}
      >
        <View style={styles.deleteActionContent}>
          <MaterialIcons name="delete-outline" size={32} color="#E53935" />
          <Text style={styles.deleteActionText}>Eliminar</Text>
        </View>
      </TouchableOpacity>
    );
  }, [confirmDelete]);
  
  // Function to close other rows
  const closeOtherRows = useCallback((conversationId: string) => {
    if (prevOpenedRow.current && prevOpenedRow.current !== conversationId) {
      const prevSwipeable = swipeableRefs.current.get(prevOpenedRow.current);
      if (prevSwipeable) {
        prevSwipeable.close();
      }
    }
    prevOpenedRow.current = conversationId;
  }, []);
  
  // Navigate to a specific conversation - con protección contra navegación rápida repetida
  const handleConversationPress = useCallback((conversationId: string) => {
    // Si el modo de selección múltiple está activo, seleccionar/deseleccionar
    if (isMultiSelectActive) {
      toggleConversationSelection(conversationId);
      return;
    }
    
    console.log(`Navigating to conversation: ${conversationId}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Update active conversation to provide immediate visual feedback
    setActiveConversation(conversationId);
    
    // Navegar primero, luego establecer la conversación activa
    // Esta secuencia evita problemas con el montaje/desmontaje del componente
    navigation.navigate('Chat', { conversationId });
    
    // Pequeño delay para evitar problemas de timing
    setTimeout(() => {
      // Establecer la conversación activa en el contexto después de la navegación
      setActiveConversationId(conversationId);
    }, 50);
  }, [navigation, setActiveConversationId, isMultiSelectActive, toggleConversationSelection]);

  // Long press para iniciar selección múltiple
  const handleConversationLongPress = useCallback((conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Si ya está en modo selección, seleccionar/deseleccionar
    if (isMultiSelectActive) {
      toggleConversationSelection(conversationId);
    } else {
      // Activar modo selección y seleccionar el elemento
      setIsMultiSelectActive(true);
      setSelectedConversations(new Set([conversationId]));
      
      // Animación para mostrar barra de acciones
      Animated.timing(actionBarSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [isMultiSelectActive, toggleConversationSelection, actionBarSlideAnim]);
  
  // Determine which conversations to show
  const displayedConversations = useMemo(() => {
    const convList = isSearchActive ? filteredConversations : conversations;
    
    // Eliminar conversaciones duplicadas
    const conversationIds = new Set<string>();
    const uniqueConversations = convList.filter((conv: Conversation) => {
      if (conversationIds.has(conv.id)) {
        return false;
      }
      conversationIds.add(conv.id);
      return true;
    });
    
    return uniqueConversations;
  }, [isSearchActive, filteredConversations, conversations]);
  
  // Animation on component mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Update conversations when context conversations change
  useEffect(() => {
    if (contextConversations.length > 0) {
      setConversations(contextConversations);
      setError(null);
      
      // Also update filtered conversations if search is active
      if (searchQuery.length > 0) {
        filterConversations(searchQuery, contextConversations);
      } else {
        setFilteredConversations(contextConversations);
      }
    } else if (contextConversations.length === 0 && !contextLoading) {
      setConversations([]);
      setFilteredConversations([]);
    }
  }, [contextConversations, contextLoading, searchQuery, filterConversations]);

  // Update error state when context error changes
  useEffect(() => {
    if (contextError) {
      setError(contextError);
    }
  }, [contextError]);

  // Función para actualizar fotos de perfil de negocios (opcional)
  const updateBusinessAvatars = useCallback(async () => {
    if (!user || conversations.length === 0 || isOffline) return;
    
    try {
      console.log('[ConversationsScreen] Verificando avatares de negocios en conversaciones...');
      const db = firebase.firestore();
      let updatedCount = 0;
      
      // Solo procesar conversaciones con businessId
      const businessConversations = conversations.filter(
        conv => conv.businessId && conv.participants.length >= 2
      );
      
      console.log(`[ConversationsScreen] Encontradas ${businessConversations.length} conversaciones de negocios`);
      
      for (const conv of businessConversations) {
        try {
          // Identificar el ID del propietario del negocio
          let businessOwnerId = '';
          for (const participantId of conv.participants) {
            if (participantId.includes('business_owner_') || participantId === conv.businessId) {
              businessOwnerId = participantId;
              break;
            }
          }
          
          // Si no lo encontramos, asumimos que es el otro participante que no es el usuario actual
          if (!businessOwnerId) {
            businessOwnerId = conv.participants.find(id => id !== user.uid) || '';
          }
          
          // Verificar si ya tiene una foto de perfil
          if (!businessOwnerId || 
              (conv.participantPhotos && conv.participantPhotos[businessOwnerId])) {
            continue;
          }
          
          // Buscar la imagen principal del negocio
          const businessDoc = await db.collection('businesses').doc(conv.businessId).get();
          if (!businessDoc.exists) continue;
          
          const businessData = businessDoc.data();
          if (!businessData?.images || !Array.isArray(businessData.images) || 
              businessData.images.length === 0) continue;
          
          // Buscar la imagen principal o usar la primera disponible
          let businessImageUrl = null;
          const mainImage = businessData.images.find(img => img && img.isMain);
          
          if (mainImage && mainImage.url) {
            businessImageUrl = mainImage.url;
          } else if (businessData.images[0].url) {
            businessImageUrl = businessData.images[0].url;
          }
          
          if (!businessImageUrl) continue;
          
          // Actualizar la conversación con la imagen del negocio
          const participantPhotos = conv.participantPhotos || {};
          const updatedPhotos = { ...participantPhotos };
          updatedPhotos[businessOwnerId] = businessImageUrl;
          
          // Actualizar en Firestore
          await db.collection('conversations').doc(conv.id).update({
            participantPhotos: updatedPhotos,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          updatedCount++;
        } catch (convError) {
          console.error(`[ConversationsScreen] Error procesando conversación ${conv.id}:`, convError);
        }
      }
      
      if (updatedCount > 0) {
        console.log(`[ConversationsScreen] Actualizadas ${updatedCount} fotos de perfil de negocios`);
        // Refrescar conversaciones para ver los cambios
        refreshConversations();
      }
    } catch (error) {
      console.error('[ConversationsScreen] Error actualizando avatares:', error);
    }
  }, [user, conversations, isOffline, refreshConversations]);

  // Cargar datos cuando el componente se monta (una sola vez)
  useEffect(() => {
    // Evitar múltiples cargas y ejecutar solo una vez
    if (initialLoadDone.current) {
      console.log('[ConversationsScreen] Carga inicial ya realizada, omitiendo');
      return;
    }
    
    console.log('[ConversationsScreen] Iniciando carga inicial de conversaciones');
    // Marcar inmediatamente como cargado para evitar múltiples intentos
    initialLoadDone.current = true;
    
    const loadInitialData = async () => {
      try {
        // Asegurar que no hay otro refresco en curso y que no estamos en modo multiselección
        if (!refreshing && !isMultiSelectActive) {
          // Primer refresco de conversaciones
          console.log('[ConversationsScreen] Ejecutando primer refresco de conversaciones');
          await refreshConversations();
          console.log('[ConversationsScreen] Primer refresco completado');
        }
        
        // Sincronizar badge count al iniciar la pantalla - solo si tenemos usuario
        if (user) {
          try {
            setTimeout(async () => {
              try {
                // Usar el módulo importado correctamente
                const result = await NotificationService.syncBadgeCount(user.uid);
                if (result.success) {
                  console.log('[ConversationsScreen] Badge count sincronizado correctamente:', result.data);
                } else {
                  console.warn('[ConversationsScreen] Error sincronizando badge count:', result.error);
                }
              } catch (badgeErr) {
                console.error('[ConversationsScreen] Error sincronizando badge count:', badgeErr);
              }
            }, 1000); // Retrasar para evitar bloqueos
          } catch (badgeErr) {
            console.error('[ConversationsScreen] Error en proceso de badge:', badgeErr);
          }
        }
        
        // Verificamos si necesitamos actualizar avatares (máximo una vez al día) - en segundo plano
        setTimeout(async () => {
          try {
            const lastAvatarUpdateStr = await AsyncStorage.getItem('last_avatar_update');
            const lastUpdate = lastAvatarUpdateStr ? new Date(lastAvatarUpdateStr) : null;
            const now = new Date();
            
            // Solo actualizar si han pasado más de 24 horas desde la última vez
            if (!lastUpdate || (now.getTime() - lastUpdate.getTime() > 24 * 60 * 60 * 1000)) {
              console.log('[ConversationsScreen] Primera actualización de avatares del día');
              await updateBusinessAvatars();
              await AsyncStorage.setItem('last_avatar_update', now.toISOString());
            } else {
              console.log('[ConversationsScreen] No es necesario actualizar avatares hoy');
            }
          } catch (avatarErr) {
            console.error('[ConversationsScreen] Error en actualización de avatares:', avatarErr);
          }
        }, 3000); // Retrasar para no bloquear la UI inicial
      } catch (err) {
        console.error('[ConversationsScreen] Error en carga inicial:', err);
      }
    };
    
    loadInitialData();
    
    // Limpiar cualquier timeout al desmontar
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [refreshConversations, updateBusinessAvatars, user, refreshing, isMultiSelectActive]);

  // Modificada para evitar refrescos durante el modo de multiselección
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      let focusTimeoutRef: NodeJS.Timeout | null = null;
      let didInitialRefresh = false;
      
      // Evitar logs excesivos, solo registrar la primera vez
      console.log('[ConversationsScreen] Screen focused');
      
      // IMPORTANTE: No refrescar si estamos en modo multiselección
      if (initialLoadDone.current && !didInitialRefresh && !refreshing && !isMultiSelectActive) {
        didInitialRefresh = true; // Marcar que ya hicimos el refresco inicial para este ciclo de foco
        
        // Usar un timeout único con un valor mayor para evitar refrescos en cadena
        focusTimeoutRef = setTimeout(async () => {
          if (!isMounted) return;
          
          try {
            // Doble verificación para asegurar que no estamos en modo multiselección
            if (!refreshing && !isMultiSelectActive) {
              console.log('[ConversationsScreen] Ejecutando refresco por foco (único)');
              await refreshConversations();
              
              // Sincronizar badge count cuando la pantalla recibe foco (DENTRO del bloque async)
              if (isMounted && user) {
                try {
                  const result = await NotificationService.syncBadgeCount(user.uid);
                  if (result.success) {
                    console.log('[ConversationsScreen] Badge count sincronizado al recibir foco:', result.data);
                  } else {
                    console.warn('[ConversationsScreen] Error sincronizando badge count al recibir foco:', result.error);
                  }
                } catch (err) {
                  console.error('[ConversationsScreen] Error sincronizando badge count en foco:', err);
                }
              }
            }
          } catch (err) {
            console.error('[ConversationsScreen] Error en refresh por foco:', err);
          }
        }, 1500); // Tiempo mayor para evitar colisiones con otros eventos
      }
      
      return () => {
        // Evitar logs excesivos, solo registrar la primera vez
        console.log('[ConversationsScreen] Screen unfocused');
        isMounted = false;
        
        // Limpiar el timeout específico del foco
        if (focusTimeoutRef) {
          clearTimeout(focusTimeoutRef);
          focusTimeoutRef = null;
        }
        
        // No limpiamos la conversación activa si estamos en modo multiselección
        if (!isMultiSelectActive) {
          setActiveConversation(null);
        }
      };
    }, [refreshConversations, refreshing, isMultiSelectActive, user]) // Añadir user a las dependencias
  );
  
  // Renderizar mensaje de ayuda para selección múltiple
  const renderSelectionHelp = () => {
    if (!showSelectionHelp) return null;
    
    return (
      <View style={styles.helpOverlay}>
        <View style={styles.helpCard}>
          <View style={styles.helpHeader}>
            <MaterialIcons name="info-outline" size={24} color="#007AFF" />
            <Text style={styles.helpTitle}>Modo selección múltiple</Text>
            <TouchableOpacity 
              onPress={() => setShowSelectionHelp(false)}
              hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
            >
              <MaterialIcons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.helpContent}>
            <Text style={styles.helpText}>• Toca para seleccionar/deseleccionar una conversación</Text>
            <Text style={styles.helpText}>• Usa el botón "Eliminar seleccionados" para borrar varias conversaciones a la vez</Text>
            <Text style={styles.helpText}>• Toca en "Seleccionar todo" para marcar todas las conversaciones</Text>
            <Text style={styles.helpText}>• Presiona "X" para salir del modo selección</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => setShowSelectionHelp(false)}
          >
            <Text style={styles.helpButtonText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Main render conditionals
  
  // No user logged in
  if (!user) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <LinearGradient
          colors={['#F5F7FF', '#E5EFFF']}
          style={styles.gradientBackground}
        >
          <MaterialIcons name="error-outline" size={64} color="#8E8E93" />
          <Text style={styles.errorText}>Debe iniciar sesión para ver los mensajes</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Home')}
          >
            <LinearGradient
              colors={['#007AFF', '#00C2FF']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.actionButtonText}>Volver al inicio</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header with search and multi-select */}
      <View style={styles.header}>
        {!isMultiSelectActive ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.backButton}
            onPress={toggleMultiSelect}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}
        
        <View style={styles.headerTitleContainer}>
          {!isSearchActive && !isMultiSelectActive && (
            <Text style={styles.headerTitle}>
              Mensajes
              {unreadTotal > 0 && <Text style={styles.unreadBadgeText}> ({unreadTotal})</Text>}
            </Text>
          )}
          
          {isMultiSelectActive && (
            <Text style={styles.headerTitle}>
              {selectedConversations.size} seleccionado(s)
            </Text>
          )}
          
          <Animated.View 
            style={[
              styles.searchBar,
              {
                width: searchWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                }),
                backgroundColor: searchWidth.interpolate({
                  inputRange: [0, 0.1, 1],
                  outputRange: ['transparent', '#F0F7FF', '#F0F7FF']
                }),
                borderWidth: searchWidth.interpolate({
                  inputRange: [0, 0.1, 1],
                  outputRange: [0, 1, 1]
                })
              }
            ]}
          >
            {isSearchActive && (
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar conversaciones..."
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus={true}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            )}
          </Animated.View>
        </View>
        
        {isMultiSelectActive ? (
        <TouchableOpacity
            style={styles.selectAllButton}
            onPress={selectAllConversations}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons 
              name={selectedConversations.size === (isSearchActive ? filteredConversations.length : conversations.length) ? "deselect" : "select-all"} 
            size={24} 
            color="#007AFF" 
          />
          </TouchableOpacity>
        ) : (
          <>
            {isSearchActive ? (
              <TouchableOpacity
                style={styles.searchButton}
                onPress={toggleSearch}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={24} color="#007AFF" />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={toggleSearch}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="search" size={24} color="#007AFF" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.selectButton, {marginLeft: 8}]}
                  onPress={toggleMultiSelect}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="checklist" size={24} color="#007AFF" />
        </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
      
      {/* Offline indicator */}
      {isOffline && (
        <View style={styles.offlineBar}>
          <MaterialIcons name="wifi-off" size={18} color="#E53935" />
          <Text style={styles.offlineText}>Sin conexión a internet</Text>
        </View>
      )}
      
      {/* Content */}
      <Animated.View 
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {loading && conversations.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Cargando conversaciones...</Text>
          </View>
        ) : error && conversations.length === 0 ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="error-outline" size={64} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={refreshConversations}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : displayedConversations.length === 0 ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="chat-bubble-outline" size={80} color="#E5E5EA" />
            
            {isSearchActive ? (
              <>
                <Text style={styles.emptyText}>No se encontraron resultados</Text>
                <Text style={styles.emptySubtext}>
                  No hay conversaciones que coincidan con "{searchQuery}"
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>No tienes conversaciones</Text>
                <Text style={styles.emptySubtext}>
                  Tus mensajes con negocios y otros usuarios aparecerán aquí
                </Text>
                <Text style={styles.emptySubtext}>
                  Para iniciar una conversación, visita un negocio y pulsa el botón "Chatear"
                </Text>
              </>
            )}
          </View>
        ) : (
          <FlatList
            data={displayedConversations}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={({ item }) => (
              <Swipeable
                ref={(ref) => {
                  if (ref && !swipeableRefs.current.has(item.id)) {
                    swipeableRefs.current.set(item.id, ref);
                  }
                }}
                renderRightActions={() => !isMultiSelectActive && renderRightActions(item.id)}
                onSwipeableOpen={() => !isMultiSelectActive && closeOtherRows(item.id)}
                friction={2}
                rightThreshold={40}
                overshootRight={false}
                enabled={!isMultiSelectActive} // Desactivar swipe cuando está en modo selección
              >
                <ConversationItem 
                  conversation={item} 
                  userId={user.uid}
                  onPress={handleConversationPress}
                  onLongPress={handleConversationLongPress}
                  isActive={item.id === activeConversation}
                  isSelected={selectedConversations.has(item.id)}
                  isMultiSelectMode={isMultiSelectActive}
                />
              </Swipeable>
            )}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={refreshConversations}
                colors={['#007AFF']}
                tintColor="#007AFF"
                progressBackgroundColor="#FFFFFF"
              />
            }
            contentContainerStyle={
              displayedConversations.length === 0 ? { flex: 1 } : undefined
            }
          />
        )}
      </Animated.View>
      
      {/* Barra de acciones para eliminación múltiple */}
      <Animated.View 
        style={[
          styles.actionBar,
          {
            transform: [{ translateY: actionBarSlideAnim }]
          }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.deleteActionButton,
            {opacity: selectedConversations.size > 0 ? 1 : 0.5}
          ]}
          onPress={deleteSelectedConversations}
          disabled={selectedConversations.size === 0 || isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="delete" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Eliminar seleccionados ({selectedConversations.size})</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
      
      {/* Añadimos un indicador en la parte superior cuando estamos en modo selección */}
      {isMultiSelectActive && (
        <View style={styles.selectionModeBar}>
          <MaterialIcons name="check-circle" size={18} color="#007AFF" />
          <Text style={styles.selectionModeText}>
            Modo selección activo - {selectedConversations.size} elemento(s) seleccionado(s)
          </Text>
        </View>
      )}
      
      {/* En el return, antes del cierre del SafeAreaView, agregamos el componente de ayuda */}
      {renderSelectionHelp()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    height: 75,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 45,
    overflow: 'hidden',
  },
  backButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A1629',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  searchButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  searchBar: {
    position: 'absolute',
    height: 45,
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
    overflow: 'hidden',
    borderColor: '#DBEAFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    fontSize: 16,
    color: '#0A1629',
    padding: 0,
    width: '100%',
  },
  unreadBadgeText: {
    color: '#0A84FF',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    paddingTop: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#EFF6FF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#0A84FF',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#E53935',
    textAlign: 'center',
    fontWeight: '600',
    maxWidth: '90%',
    lineHeight: 24,
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#0A84FF',
    borderRadius: 16,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyText: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0A1629',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: '90%',
    lineHeight: 24,
  },
  deleteAction: {
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: '#FFCDD2',
  },
  deleteActionContent: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFECEC',
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  deleteActionText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 6,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  offlineBar: {
    backgroundColor: '#FFF5F5',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFCDD2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  offlineText: {
    color: '#E53935',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 15,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  selectAllButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  actionBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 85 : 75, // Ajustamos para que esté por encima de la navegación
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#E5EAFC',
  },
  buttonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  selectionModeText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  helpOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: 24,
  },
  helpCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    flex: 1,
    marginLeft: 8,
  },
  helpContent: {
    marginBottom: 20,
  },
  helpText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  helpButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  helpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConversationsScreen;
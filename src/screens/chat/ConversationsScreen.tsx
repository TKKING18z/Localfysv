import React, { useEffect, useCallback, useState, useRef } from 'react';
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
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const searchWidth = useRef(new Animated.Value(0)).current;
  
  // Track swipeable rows for proper handling
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const prevOpenedRow = useRef<string | null>(null);
  
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
  }, [contextConversations, contextLoading, searchQuery]);
  
  // Update error state when context error changes
  useEffect(() => {
    if (contextError) {
      setError(contextError);
    }
  }, [contextError]);
  
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
  
  // Enhanced refresh function
  const refreshConversations = useCallback(async () => {
    if (!user) {
      return;
    }
    
    if (isOffline) {
      setError('No hay conexión a internet. Conéctate para actualizar.');
      return;
    }
    
    try {
      setRefreshing(true);
      
      // Close any opened swipeable rows
      if (prevOpenedRow.current) {
        const swipeable = swipeableRefs.current.get(prevOpenedRow.current);
        if (swipeable) {
          swipeable.close();
        }
        prevOpenedRow.current = null;
      }
      
      // Execute the context's refresh function
      await contextRefreshConversations();
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      setError('Error al actualizar. Intenta de nuevo.');
    } finally {
      setRefreshing(false);
    }
  }, [user, contextRefreshConversations, isOffline]);
  
  // Función para actualizar fotos de perfil de negocios
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
  
  // Utilizamos un ref para controlar si ya se hizo la carga inicial
  const initialLoadDone = useRef(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cargar datos cuando el componente se monta (una sola vez)
  useEffect(() => {
    // Solo cargar si no se ha hecho ya
    if (!initialLoadDone.current) {
      console.log('[ConversationsScreen] Carga inicial de conversaciones');
      
      const loadInitialData = async () => {
        try {
          // Primero cargamos las conversaciones
          await refreshConversations();
          
          // Sincronizar badge count al iniciar la pantalla
          if (user) {
            try {
              const { notificationService } = require('../../../services/NotificationService');
              await notificationService.syncBadgeCount(user.uid);
              console.log('[ConversationsScreen] Badge count sincronizado correctamente');
            } catch (badgeErr) {
              console.error('[ConversationsScreen] Error sincronizando badge count:', badgeErr);
            }
          }
          
          // Verificamos si necesitamos actualizar avatares (máximo una vez al día)
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
          
          // Marcar como completada la carga inicial
          initialLoadDone.current = true;
        } catch (err) {
          console.error('[ConversationsScreen] Error en carga inicial:', err);
        }
      };
      
      loadInitialData();
    }
    
    // Limpiar cualquier timeout al desmontar
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [refreshConversations, updateBusinessAvatars, user]);
  
  // Implementamos useFocusEffect pero con protecciones estrictas
  useFocusEffect(
    useCallback(() => {
      // Evitamos la primera carga, ya que eso lo maneja el useEffect
      if (initialLoadDone.current) {
        console.log('[ConversationsScreen] Actualización por foco (no es la primera vez)');
        
        // Usamos un timeout para evitar múltiples refrescos en secuencia rápida
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        
        // Esperar un poco antes de actualizar para asegurar que no hay múltiples refrescos
        refreshTimeoutRef.current = setTimeout(async () => {
          try {
            await refreshConversations();
            
            // Sincronizar badge count cuando la pantalla recibe foco
            if (user) {
              const { notificationService } = require('../../../services/NotificationService');
              await notificationService.syncBadgeCount(user.uid);
              console.log('[ConversationsScreen] Badge count sincronizado al recibir foco');
            }
          } catch (err) {
            console.error('[ConversationsScreen] Error en refresh por foco:', err);
          }
        }, 500);
      }
      
      return () => {
        // Limpieza al perder el foco
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
        }
        setActiveConversation(null);
      };
    }, [refreshConversations, user])
  );
  
  // Navigate to a specific conversation - con protección contra navegación rápida repetida
  const handleConversationPress = useCallback((conversationId: string) => {
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
  }, [navigation, setActiveConversationId]);
  
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
  
  // Función para probar notificaciones locales
  const testNotification = useCallback(async () => {
    try {
      const notificationService = require('../../services/NotificationService').notificationService;
      
      // Mostrar una notificación de prueba
      await notificationService.sendLocalNotification(
        "Notificación de prueba",
        "Esta es una notificación local de prueba para Localfy",
        { type: 'test' }
      );
      
      // Vibración para confirmar
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      console.log('[ConversationsScreen] Notificación de prueba enviada');
    } catch (error: any) {
      console.error('[ConversationsScreen] Error enviando notificación de prueba:', error);
      Alert.alert("Error", "No se pudo enviar la notificación de prueba");
    }
  }, []);
  
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
              style={styles.actionButtonGradient}
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
  
  // Determine which conversations to show
  const displayedConversations = isSearchActive ? filteredConversations : conversations;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header with search */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          {!isSearchActive && (
            <Text style={styles.headerTitle}>
              Mensajes
              {unreadTotal > 0 && <Text style={styles.unreadBadgeText}> ({unreadTotal})</Text>}
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
        
        <TouchableOpacity
          style={styles.searchButton}
          onPress={toggleSearch}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons 
            name={isSearchActive ? "close" : "search"} 
            size={24} 
            color="#007AFF" 
          />
        </TouchableOpacity>
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
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Swipeable
                ref={(ref) => {
                  if (ref && !swipeableRefs.current.has(item.id)) {
                    swipeableRefs.current.set(item.id, ref);
                  }
                }}
                renderRightActions={() => renderRightActions(item.id)}
                onSwipeableOpen={() => closeOtherRows(item.id)}
                friction={2}
                rightThreshold={40}
                overshootRight={false}
              >
                <ConversationItem 
                  conversation={item} 
                  userId={user.uid}
                  onPress={handleConversationPress}
                  onLongPress={confirmDelete}
                  isActive={item.id === activeConversation}
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
      
      {/* Botón flotante para probar notificaciones (solo en desarrollo) */}
      {__DEV__ && (
        <TouchableOpacity 
          style={styles.testNotificationButton}
          onPress={testNotification}
          activeOpacity={0.8}
        >
          <MaterialIcons name="notifications" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
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
  testNotificationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 999,
  }
});

export default ConversationsScreen;
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
  Alert
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import ConversationItem from '../../components/chat/ConversationItem';
import { RootStackParamList } from '../../navigation/AppNavigator';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Conversation } from '../../../models/chatTypes';

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
    unreadTotal: contextUnreadTotal,
    deleteConversation
  } = useChat();
  
  // Add local state for enhanced refresh capability
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(contextConversations);
  const [unreadTotal, setUnreadTotal] = useState(contextUnreadTotal);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(0); // Counter for force refresh
  
  // Ref para trackear Swipeable abiertos
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  // Ref para la última fila abierta
  const prevOpenedRow = useRef<string | null>(null);
  
  // Mejorar la función refreshConversations para garantizar actualizaciones
  const refreshConversations = useCallback(async () => {
    try {
      if (!user) {
        console.error('[ConversationsScreen] refreshConversations: No hay usuario logueado');
        return;
      }
      
      setLoading(true);
      setRefreshing(true);
      
      // Intentar obtener datos más recientes desde Firestore
      const conversationsRef = firebase.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', user.uid)
        .orderBy('updatedAt', 'desc');
      
      const snapshot = await conversationsRef.get();
      
      if (snapshot.empty) {
        console.log('[ConversationsScreen] No se encontraron conversaciones');
        setConversations([]);
      } else {
        // Filtrar aquí también las conversaciones eliminadas
        const conversationsData = snapshot.docs
          .filter(doc => {
            const data = doc.data();
            return !(data.deletedFor && data.deletedFor[user.uid] === true);
          })
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Conversation[];
        
        console.log(`[ConversationsScreen] Actualizadas ${conversationsData.length} conversaciones (filtradas por eliminación)`);
        setConversations(conversationsData);
        
        // Actualizar contador de no leídos
        const unreadTotal = conversationsData.reduce((sum, conv) => {
          return sum + (conv.unreadCount?.[user.uid] || 0);
        }, 0);
        
        setUnreadTotal(unreadTotal);
      }
      
      // Forzar la actualización del contexto también
      contextRefreshConversations();
      setError(null);
    } catch (error) {
      console.error('[ConversationsScreen] Error actualizando conversaciones:', error);
      setError('No se pudieron cargar las conversaciones');
      
      Alert.alert(
        'Error',
        'No se pudieron cargar las conversaciones. Intente nuevamente.',
        [
          { text: 'Cancelar' },
          { 
            text: 'Reintentar', 
            onPress: () => {
              // Incrementar contador para forzar actualización
              setManualRefresh(prev => prev + 1);
            }
          }
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, contextRefreshConversations]);
  
  // Efecto para recargar cuando cambia el contador manual
  useEffect(() => {
    if (manualRefresh > 0) {
      refreshConversations().catch(error => {
        console.error('[ConversationsScreen] Error in manual refresh:', error);
      });
    }
  }, [manualRefresh, refreshConversations]);
  
  // Update conversations when context conversations change
  useEffect(() => {
    if (contextConversations.length > 0) {
      setConversations(contextConversations);
      setError(null);
    }
  }, [contextConversations]);
  
  // Update error state when context error changes
  useEffect(() => {
    if (contextError) {
      setError(contextError);
    }
  }, [contextError]);
  
  // Update unread total when context value changes
  useEffect(() => {
    setUnreadTotal(contextUnreadTotal);
  }, [contextUnreadTotal]);
  
  // Actualizar al montar y cuando vuelve a enfocarse con fuerza adicional
  useEffect(() => {
    console.log('[ConversationsScreen] mounted - forcing refresh');
    
    // Limpiar estado y forzar recarga completa
    setConversations([]);
    refreshConversations();
    
    return () => {
      console.log('[ConversationsScreen] unmounting');
    };
  }, [refreshConversations]);
  
  // Add useFocusEffect to force refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('[ConversationsScreen] Screen focused - forcing full refresh');
      
      // SOLUCIÓN CRÍTICA: Función que realiza una carga completa
      const forceFreshLoad = async () => {
        try {
          setRefreshing(true);
          
          if (!user) {
            console.error('No hay usuario para cargar conversaciones');
            return;
          }
          
          // SOLUCIÓN CRÍTICA: Consulta directa a Firestore para evitar problemas de caché
          const snapshot = await firebase.firestore()
            .collection('conversations')
            .where('participants', 'array-contains', user.uid)
            .orderBy('updatedAt', 'desc')
            .get();
          
          console.log(`[ConversationsScreen] Forzando carga completa. Encontradas ${snapshot.docs.length} conversaciones en Firestore`);
          
          // Si no hay conversaciones en el estado pero sí en Firestore, forzar refresco
          if (conversations.length === 0 && snapshot.docs.length > 0) {
            console.log('[ConversationsScreen] Detectada discrepancia, forzando actualización');
            await refreshConversations();
          } else {
            // Siempre hacer un refresco para asegurar
            await refreshConversations();
          }
        } catch (error) {
          console.error('[ConversationsScreen] Error en carga forzada:', error);
        } finally {
          setRefreshing(false);
        }
      };
      
      forceFreshLoad();
      
      return () => {
        console.log('[ConversationsScreen] Screen unfocused');
      };
    }, [user, refreshConversations, conversations])
  );
  
  // Navegar a una conversación específica con comprobación de validez
  const handleConversationPress = useCallback(async (conversationId: string) => {
    console.log(`[ConversationsScreen] Navigating to conversation: ${conversationId}`);
    
    try {
      // Verificar que la conversación existe
      const convExists = conversations.some(conv => conv.id === conversationId);
      
      if (!convExists) {
        console.log(`[ConversationsScreen] Conversation ${conversationId} not found in local state, refreshing...`);
        await refreshConversations();
      }
      
      // Activar la conversación en el contexto
      setActiveConversationId(conversationId);
      
      // Navegar a la pantalla de chat
      navigation.navigate('Chat', { conversationId });
    } catch (error) {
      console.error('[ConversationsScreen] Error navigating to conversation:', error);
      Alert.alert('Error', 'No se pudo abrir la conversación. Intente nuevamente.');
    }
  }, [conversations, setActiveConversationId, navigation, refreshConversations]);
  
  // Volver a la pantalla anterior - corregido para manejar diferentes contextos de navegación
  const handleBackPress = useCallback(() => {
    // Check if we can go back in navigation history
    const canGoBack = navigation.canGoBack();

    if (canGoBack) {
      // If we can go back, just go to the previous screen
      navigation.goBack();
    } else {
      // If we can't go back (direct navigation to this screen)
      // Try to reset to the main tab navigator
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  }, [navigation]);
  
  // Función para confirmar eliminación
  const confirmDelete = useCallback((conversationId: string) => {
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
              
              // 1. Eliminar de la UI inmediatamente para feedback
              setConversations(prev => prev.filter(conv => conv.id !== conversationId));
              
              // 2. Ejecutar eliminación en Firestore
              const success = await deleteConversation(conversationId);
              
              if (!success) {
                console.error(`[ConversationsScreen] Failed to delete conversation ${conversationId}`);
                // Restaurar la conversación si falló y refrescar de Firestore
                refreshConversations();
                Alert.alert("Error", "No se pudo eliminar la conversación. Inténtalo de nuevo.");
              } else {
                console.log(`[ConversationsScreen] Successfully deleted conversation ${conversationId}`);
                // Refrescar la lista para sincronizar con firestore (opcional)
                // Esto asegura que la lista local siempre refleje el estado en el servidor
                await refreshConversations();
              }
            } catch (error) {
              console.error('[ConversationsScreen] Error al eliminar conversación:', error);
              refreshConversations(); // Restaurar estado
              Alert.alert("Error", "Ocurrió un error inesperado. Inténtalo de nuevo.");
            } finally {
              setLoading(false);
            }
          } 
        }
      ]
    );
  }, [deleteConversation, refreshConversations]);

  // Render de las acciones de deslizamiento (eliminar)
  const renderRightActions = useCallback((conversationId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          // Cerrar el swipeable antes de confirmar
          const swipeable = swipeableRefs.current.get(conversationId);
          if (swipeable) {
            swipeable.close();
          }
          // Mostrar confirmación
          confirmDelete(conversationId);
        }}
      >
        <MaterialIcons name="delete" size={24} color="white" />
        <Text style={styles.deleteActionText}>Eliminar</Text>
      </TouchableOpacity>
    );
  }, [confirmDelete]);
  
  // Función para cerrar otras filas abiertas
  const closeOtherRows = useCallback((conversationId: string) => {
    if (prevOpenedRow.current && prevOpenedRow.current !== conversationId) {
      const prevSwipeable = swipeableRefs.current.get(prevOpenedRow.current);
      if (prevSwipeable) {
        prevSwipeable.close();
      }
    }
    prevOpenedRow.current = conversationId;
  }, []);
  
  if (!user) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Debe iniciar sesión para ver los mensajes</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.retryButtonText}>Volver al inicio</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Mensajes
          {unreadTotal > 0 && <Text style={styles.unreadBadgeText}> ({unreadTotal})</Text>}
        </Text>
        <View style={styles.placeholder} />
      </View>
      
      {/* Contenido principal */}
      {(loading && conversations.length === 0) || refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando conversaciones...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => setManualRefresh(prev => prev + 1)}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="chat-bubble-outline" size={64} color="#E5E5EA" />
          <Text style={styles.emptyText}>No tienes conversaciones</Text>
          <Text style={styles.emptySubtext}>
            Tus mensajes con negocios y otros usuarios aparecerán aquí
          </Text>
          <Text style={styles.emptySubtext}>
            Para iniciar una conversación, visita un negocio y pulsa el botón "Chatear"
          </Text>
        </View>
      ) : (
        <FlatList
          key={`conversations-${conversations.length}-${manualRefresh}`}
          data={conversations}
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
            >
              <ConversationItem 
                conversation={item} 
                userId={user.uid}
                onPress={handleConversationPress}
              />
            </Swipeable>
          )}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={refreshConversations}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  unreadBadgeText: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333333',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    maxWidth: '80%',
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
});

export default ConversationsScreen;
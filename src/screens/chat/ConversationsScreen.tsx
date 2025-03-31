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
  
  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[ConversationsScreen] Screen focused - refreshing data');
      
      refreshConversations().catch(err => {
        console.error('Error during focus refresh:', err);
      });
      
      return () => {
        // Cleanup when screen loses focus
        setActiveConversation(null);
      };
    }, [refreshConversations])
  );
  
  // Navigate to a specific conversation
  const handleConversationPress = useCallback((conversationId: string) => {
    console.log(`Navigating to conversation: ${conversationId}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Update active conversation to provide immediate visual feedback
    setActiveConversation(conversationId);
    
    // Set the active conversation in the context
    setActiveConversationId(conversationId);
    
    // Navigate to the Chat screen
    navigation.navigate('Chat', { conversationId });
  }, [navigation, setActiveConversationId]);
  
  // Navigate back
  const handleBackPress = useCallback(() => {
    navigation.navigate('Home');
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
        activeOpacity={0.8}
      >
        <View style={styles.deleteActionContent}>
          <MaterialIcons name="delete" size={24} color="white" />
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
          <MaterialIcons name="cloud-off" size={16} color="#FFF" />
          <Text style={styles.offlineText}>Sin conexión</Text>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    height: 60,
    zIndex: 10,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 40,
    overflow: 'hidden',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  searchButton: {
    padding: 8,
    borderRadius: 20,
  },
  searchBar: {
    position: 'absolute',
    height: 36,
    backgroundColor: '#F0F0F5',
    borderRadius: 18,
    paddingHorizontal: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  searchInput: {
    fontSize: 16,
    color: '#000',
    padding: 0,
    width: '100%',
  },
  unreadBadgeText: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyText: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  emptySubtext: {
    marginTop: 12,
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    maxWidth: '90%',
    lineHeight: 22,
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    height: '100%',
  },
  deleteActionContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 4,
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
    backgroundColor: '#FF3B30',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  }
});

export default ConversationsScreen;
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  ScrollView, 
  LayoutAnimation, 
  Platform, 
  UIManager,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { PendingActions } from '../../types/analyticsTypes';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ActionCenterProps {
  pendingActions: PendingActions;
  onActionPress: (type: string, id: string) => void;
  maxVisible?: number;
  isLoading?: boolean;
}

const ActionCenter: React.FC<ActionCenterProps> = ({
  pendingActions,
  onActionPress,
  maxVisible = 3,
  isLoading = false
}) => {
  const { reservations = [], messages = [], reviews = [] } = pendingActions;
  const [expanded, setExpanded] = useState(false);
  
  // Determinar si hay acciones pendientes
  const hasActions = reservations.length > 0 || messages.length > 0 || reviews.length > 0;
  
  // Contar el total de acciones pendientes
  const totalActions = reservations.length + messages.length + reviews.length;
  
  // Expandir o contraer la lista
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };
  
  // Si está cargando, mostrar el indicador
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Acciones Pendientes</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando acciones pendientes...</Text>
        </View>
      </View>
    );
  }
  
  // Si no hay acciones y no está cargando, mostrar un mensaje
  if (!hasActions && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Acciones Pendientes</Text>
          <View style={[styles.totalBadge, { backgroundColor: '#34C759' }]}>
            <Text style={styles.totalBadgeText}>0</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="check-circle" size={32} color="#34C759" />
          <Text style={styles.emptyText}>¡No tienes acciones pendientes!</Text>
        </View>
      </View>
    );
  }
  
  // Para determinar cuántas acciones mostrar
  const visibleItems = expanded ? totalActions : Math.min(maxVisible, totalActions);
  
  // Calcular qué acciones mostrar en base a la visibilidad
  const getVisibleActions = () => {
    const visible: { type: string, data: any }[] = [];
    
    // Agregar reservaciones
    reservations.forEach(reservation => {
      if (visible.length < visibleItems || expanded) {
        visible.push({ type: 'reservation', data: reservation });
      }
    });
    
    // Agregar mensajes
    if (visible.length < visibleItems || expanded) {
      messages.slice(0, expanded ? messages.length : visibleItems - visible.length).forEach(message => {
        visible.push({ type: 'message', data: message });
      });
    }
    
    // Agregar reseñas
    if (visible.length < visibleItems || expanded) {
      reviews.slice(0, expanded ? reviews.length : visibleItems - visible.length).forEach(review => {
        visible.push({ type: 'review', data: review });
      });
    }
    
    return visible;
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Acciones Pendientes</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{totalActions}</Text>
        </View>
      </View>
      
      {/* Lista de acciones */}
      <View style={styles.actionsList}>
        {getVisibleActions().map((action, index) => {
          // Determinar tipo de acción para renderización
          const { type, data } = action;
          let icon = 'event-available';
          let iconColor = '#007AFF';
          let title = '';
          let description = '';
          
          switch (type) {
            case 'reservation':
              icon = 'event';
              iconColor = '#007AFF';
              title = 'Reserva por confirmar';
              description = `${formatDate(data.date)}`;
              if (data.customerName) {
                description += ` - ${data.customerName}`;
              }
              if (data.partySize) {
                description += ` (${data.partySize} personas)`;
              }
              break;
            case 'message':
              icon = 'chat';
              iconColor = '#34C759';
              title = 'Mensaje sin leer';
              description = `De: ${data.from}`;
              if (data.preview) {
                description += ` - "${data.preview.substring(0, 30)}${data.preview.length > 30 ? '...' : ''}"`;
              }
              break;
            case 'review':
              icon = 'star';
              iconColor = '#FFCC00';
              title = 'Reseña sin responder';
              description = `Calificación: ${data.rating} estrellas`;
              if (data.preview) {
                description += ` - "${data.preview.substring(0, 30)}${data.preview.length > 30 ? '...' : ''}"`;
              }
              break;
          }
          
          return (
            <TouchableOpacity
              key={`${type}-${data.id}-${index}`}
              style={styles.actionItem}
              onPress={() => onActionPress(type, data.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: iconColor }]}>
                <MaterialIcons name={icon as any} size={20} color="white" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>{title}</Text>
                <Text style={styles.actionDescription} numberOfLines={2}>{description}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Botón Ver más/menos si hay más acciones que el límite visible */}
      {totalActions > maxVisible && (
        <TouchableOpacity style={styles.expandButton} onPress={toggleExpand}>
          <Text style={styles.expandButtonText}>
            {expanded ? 'Ver menos' : `Ver todas (${totalActions})`}
          </Text>
          <MaterialIcons 
            name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
            size={18} 
            color="#007AFF" 
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Función auxiliar para formatear fecha
const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  totalBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  totalBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionsList: {
    marginBottom: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  actionDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  expandButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  loadingContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 8,
  },
  emptyContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  }
});

export default ActionCenter;
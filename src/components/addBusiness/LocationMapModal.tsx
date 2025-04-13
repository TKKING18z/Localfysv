import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Region } from 'react-native-maps';
import { BusinessLocation } from '../../types/businessTypes';

interface LocationMapModalProps {
  visible: boolean;
  mapRegion: Region;
  markerLocation: BusinessLocation | null;
  handleMapPress: (event: any) => void;
  confirmLocationSelection: () => Promise<void>;
  centerMapOnCurrentLocation: () => Promise<void>;
  closeModal: () => void;
}

const LocationMapModal: React.FC<LocationMapModalProps> = ({
  visible,
  mapRegion,
  markerLocation,
  handleMapPress,
  confirmLocationSelection,
  centerMapOnCurrentLocation,
  closeModal
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={closeModal}
      transparent={false}
    >
      <SafeAreaView style={styles.mapModalContainer}>
        <View style={styles.mapHeader}>
          <TouchableOpacity 
            onPress={closeModal}
            style={styles.mapCloseButton}
            accessibilityLabel="Volver atrás"
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.mapHeaderTitle}>Seleccionar Ubicación</Text>
          <View style={styles.mapHeaderRight}></View>
        </View>
        
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={mapRegion}
            onPress={handleMapPress}
          >
            {markerLocation && (
              <Marker
                coordinate={{
                  latitude: markerLocation.latitude,
                  longitude: markerLocation.longitude,
                }}
              />
            )}
          </MapView>
          
          <TouchableOpacity 
            style={styles.currentLocationMapButton}
            onPress={centerMapOnCurrentLocation}
            accessibilityLabel="Mi ubicación actual"
            accessibilityRole="button"
          >
            <MaterialIcons name="my-location" size={24} color="#007aff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.confirmLocationButton,
              !markerLocation && styles.disabledButton
            ]}
            onPress={confirmLocationSelection}
            disabled={!markerLocation}
            accessibilityLabel="Confirmar ubicación"
            accessibilityRole="button"
          >
            <Text style={styles.confirmLocationButtonText}>Confirmar Ubicación</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#007aff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mapHeaderRight: {
    width: 40,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  currentLocationMapButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  confirmLocationButton: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: '#007aff',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 16,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#A2D1FF',
    shadowOpacity: 0.1,
  },
  confirmLocationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LocationMapModal; 
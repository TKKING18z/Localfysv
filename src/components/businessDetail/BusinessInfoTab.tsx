import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, Alert, ScrollView } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Business } from '../../context/BusinessContext';
import BusinessHoursView from '../BusinessHoursView';
import PaymentMethodsView from '../PaymentMethodsView';
import SocialLinks from '../SocialLinks';

interface BusinessInfoTabProps {
  business: Business;
  handleCallBusiness: () => void;
  handleEmailBusiness: () => void;
  navigation: any;
}

const BusinessInfoTab: React.FC<BusinessInfoTabProps> = ({
  business,
  handleCallBusiness,
  handleEmailBusiness,
  navigation,
}) => {
  
  // Function to open address in Google Maps
  const openInGoogleMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `https://maps.apple.com/?q=${encodedAddress}`,
      android: `https://maps.google.com/maps?q=${encodedAddress}`,
      default: `https://maps.google.com/maps?q=${encodedAddress}`
    });
    
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Error', 'No se pudo abrir Google Maps');
        }
      })
      .catch(error => {
        console.error('Error al abrir Google Maps:', error);
        Alert.alert('Error', 'No se pudo abrir Google Maps');
      });
  };
  
  return (
    <View style={styles.container}>
      {/* Overview section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="info-outline" size={22} color="#007aff" />
          <Text style={styles.sectionTitle}>Información General</Text>
        </View>
        
        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>{business.description || "No hay descripción disponible."}</Text>
        </View>
        
        {business.address && (
          <View style={styles.quickInfoItem}>
            <MaterialIcons name="place" size={20} color="#FF2D55" style={styles.quickInfoIcon} />
            <View style={styles.addressContainer}>
              <Text style={styles.quickInfoText}>{business.address}</Text>
              <TouchableOpacity
                onPress={() => openInGoogleMaps(business.address || '')}
                style={styles.mapsButton}
              >
                <Text style={styles.mapsButtonText}>Abrir dirección con Google Maps</Text>
                <MaterialIcons name="directions" size={14} color="#007aff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {isOpenNow(business) !== null && (
          <View style={styles.quickInfoItem}>
            <MaterialIcons 
              name="access-time" 
              size={20} 
              color={isOpenNow(business) ? "#34C759" : "#FF3B30"} 
              style={styles.quickInfoIcon} 
            />
            <Text style={[
              styles.quickInfoText, 
              {color: isOpenNow(business) ? "#34C759" : "#FF3B30", fontWeight: '600'}
            ]}>
              {isOpenNow(business) ? "Abierto ahora" : "Cerrado"}
            </Text>
          </View>
        )}
      </View>
      
      {/* Contact section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="contact-phone" size={22} color="#007aff" />
          <Text style={styles.sectionTitle}>Contacto</Text>
        </View>
        
        <View style={styles.contactGrid}>
          {business.phone && (
            <TouchableOpacity 
              style={styles.contactCard}
              onPress={handleCallBusiness}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIconContainer, {backgroundColor: '#007aff'}]}>
                <MaterialIcons name="phone" size={24} color="white" />
              </View>
              <Text style={styles.contactLabel}>Teléfono</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{business.phone}</Text>
            </TouchableOpacity>
          )}
          
          {business.email && (
            <TouchableOpacity 
              style={styles.contactCard}
              onPress={handleEmailBusiness}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIconContainer, {backgroundColor: '#5AC8FA'}]}>
                <MaterialIcons name="email" size={24} color="white" />
              </View>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{business.email}</Text>
            </TouchableOpacity>
          )}
          
          {business.website && (
            <TouchableOpacity 
              style={styles.contactCard}
              onPress={() => {
                let url = business.website || '';
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                  url = 'https://' + url;
                }
                Linking.openURL(url);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIconContainer, {backgroundColor: '#FF9500'}]}>
                <MaterialIcons name="public" size={24} color="white" />
              </View>
              <Text style={styles.contactLabel}>Sitio web</Text>
              <Text style={[styles.contactValue, styles.websiteText]} numberOfLines={1}>
                {formatWebsite(business.website)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {!business.phone && !business.email && !business.website && (
          <Text style={styles.noInfoText}>No hay información de contacto disponible</Text>
        )}
      </View>
      
      {/* Business hours section */}
      {business.businessHours && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="schedule" size={22} color="#007aff" />
            <Text style={styles.sectionTitle}>Horario de Atención</Text>
          </View>
          <BusinessHoursView hours={business.businessHours} />
        </View>
      )}
      
      {/* Payment methods section */}
      {business.paymentMethods && business.paymentMethods.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="payment" size={22} color="#007aff" />
            <Text style={styles.sectionTitle}>Métodos de Pago</Text>
          </View>
          <PaymentMethodsView methods={business.paymentMethods} />
        </View>
      )}
      
      {/* Social links section */}
      {business.socialLinks && Object.keys(business.socialLinks).length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="share" size={22} color="#007aff" />
            <Text style={styles.sectionTitle}>Redes Sociales</Text>
          </View>
          <SocialLinks links={business.socialLinks} />
        </View>
      )}
    </View>
  );
};

// Helper functions
const isOpenNow = (business: Business) => {
  if (!business?.businessHours) return null;
  
  const now = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentHours = business.businessHours[dayOfWeek as keyof typeof business.businessHours];
  
  if (!currentHours || currentHours.closed) return false;
  
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  return currentTimeStr >= currentHours.open && currentTimeStr <= currentHours.close;
};

const formatWebsite = (website: string | undefined) => {
  if (!website) return '';
  return website.replace(/^https?:\/\/(www\.)?/i, '');
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,122,255,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  descriptionContainer: {
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 10,
    borderRadius: 8,
  },
  quickInfoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  quickInfoText: {
    fontSize: 15,
    color: '#444',
    flex: 1,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -5,
  },
  contactCard: {
    width: '48%',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  contactIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  contactLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 5,
  },
  contactValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
  websiteText: {
    color: '#007aff',
  },
  noInfoText: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
    backgroundColor: 'rgba(142,142,147,0.05)',
    borderRadius: 8,
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  mapsButtonText: {
    fontSize: 13,
    color: '#007aff',
    marginRight: 5,
  },
});

export default BusinessInfoTab; 
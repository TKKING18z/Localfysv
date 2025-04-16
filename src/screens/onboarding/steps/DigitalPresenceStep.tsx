import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Animated,
  Keyboard,
  Platform,
  ImageBackground,
  Dimensions
} from 'react-native';
import { MaterialIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { useBusinessOnboarding } from '../../../context/BusinessOnboardingContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const { width } = Dimensions.get('window');

const DigitalPresenceStep: React.FC = () => {
  const { formState, setField, markStepComplete } = useBusinessOnboarding();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const initialized = useRef(false);
  const isUpdatingFromContext = useRef(false);
  
  // Default social media structure
  const defaultSocialLinks = {
    facebook: '',
    instagram: '',
    tiktok: '',
    whatsapp: '',
    website: ''
  };
  
  // Local state for social links
  const [socialLinks, setSocialLinks] = useState(
    formState.socialLinks || defaultSocialLinks
  );
  
  // Local state for notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState(
    formState.notificationPreferences || {
      email: true,
      sms: false,
      push: true,
      whatsapp: false
    }
  );

  // Focus state for inputs
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  // Initialize once on component mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // Initialize socialLinks if not present in context
    if (!formState.socialLinks) {
      setField('socialLinks', defaultSocialLinks);
    }
    
    // Initialize notification preferences if not present in context
    if (!formState.notificationPreferences) {
      setField('notificationPreferences', {
        email: true,
        sms: false,
        push: true,
        whatsapp: false
      });
    }
    
    // Run animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Safely sync from context to local state
  // ONLY when we know context has been updated from elsewhere
  useEffect(() => {
    // Skip if we're in the middle of updating the context ourselves
    if (isUpdatingFromContext.current) return;
    
    const contextSocialLinks = formState.socialLinks || defaultSocialLinks;
    const contextNotificationPrefs = formState.notificationPreferences || {
      email: true,
      sms: false,
      push: true,
      whatsapp: false
    };
    
    // Only update if the values are actually different to prevent loops
    const socialLinksChanged = JSON.stringify(contextSocialLinks) !== JSON.stringify(socialLinks);
    const notificationPrefsChanged = JSON.stringify(contextNotificationPrefs) !== JSON.stringify(notificationPrefs);
    
    if (socialLinksChanged) {
      setSocialLinks(contextSocialLinks);
    }
    
    if (notificationPrefsChanged) {
      setNotificationPrefs(contextNotificationPrefs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState]);
  
  // Effect to mark step as complete if needed
  useEffect(() => {
    const hasAnySocialLink = Object.values(socialLinks).some(
      link => link && link.trim() !== ''
    );
    
    const notificationPrefsModified = 
      notificationPrefs.email !== true || 
      notificationPrefs.sms !== false || 
      notificationPrefs.push !== true || 
      notificationPrefs.whatsapp !== false;
    
    if (hasAnySocialLink || notificationPrefsModified) {
      markStepComplete('digitalPresence');
    }
  }, [socialLinks, notificationPrefs, markStepComplete]);
  
  // Handle social link change - safely update both local and context
  const handleSocialLinkChange = useCallback((platform: keyof typeof socialLinks, value: string) => {
    const updatedLinks = { ...socialLinks, [platform]: value };
    // Update local state first
    setSocialLinks(updatedLinks);
    
    // Flag that we're intentionally updating context, to prevent sync loop
    isUpdatingFromContext.current = true;
    setField('socialLinks', updatedLinks);
    // Reset the flag after a short delay to allow state to settle
    setTimeout(() => {
      isUpdatingFromContext.current = false;
    }, 0);
  }, [socialLinks, setField]);
  
  // Format input based on platform
  const formatSocialInput = useCallback((platform: keyof typeof socialLinks, value: string) => {
    let formattedValue = value;
    
    switch (platform) {
      case 'facebook':
        if (value.includes('facebook.com/')) {
          formattedValue = value.split('facebook.com/')[1];
        }
        break;
        
      case 'instagram':
        formattedValue = value.replace('@', '');
        if (value.includes('instagram.com/')) {
          formattedValue = value.split('instagram.com/')[1];
        }
        break;
        
      case 'tiktok':
        formattedValue = value.replace('@', '');
        if (value.includes('tiktok.com/')) {
          formattedValue = value.split('tiktok.com/')[1];
        }
        break;
        
      case 'whatsapp':
        formattedValue = value.replace(/\D/g, '');
        break;
        
      case 'website':
        if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
          formattedValue = `https://${value}`;
        }
        break;
    }
    
    return formattedValue;
  }, []);
  
  // Get platform icon
  const getPlatformIcon = useCallback((platform: keyof typeof socialLinks) => {
    switch (platform) {
      case 'facebook': return { icon: <FontAwesome name="facebook" size={22} color={focusedInput === platform ? "#4267B2" : "#8A9AA9"} />, color: '#4267B2' };
      case 'instagram': return { icon: <FontAwesome name="instagram" size={22} color={focusedInput === platform ? "#E1306C" : "#8A9AA9"} />, color: '#E1306C' };
      case 'tiktok': return { icon: <FontAwesome5 name="tiktok" size={22} color={focusedInput === platform ? "#000000" : "#8A9AA9"} />, color: '#000000' };
      case 'whatsapp': return { icon: <FontAwesome name="whatsapp" size={22} color={focusedInput === platform ? "#25D366" : "#8A9AA9"} />, color: '#25D366' };
      case 'website': return { icon: <MaterialIcons name="language" size={22} color={focusedInput === platform ? "#0077B5" : "#8A9AA9"} />, color: '#0077B5' };
      default: return { icon: <MaterialIcons name="link" size={22} color={focusedInput === platform ? "#0077B5" : "#8A9AA9"} />, color: '#0077B5' };
    }
  }, [focusedInput]);
  
  // Get platform display name
  const getPlatformName = useCallback((platform: keyof typeof socialLinks) => {
    switch (platform) {
      case 'facebook': return 'Facebook';
      case 'instagram': return 'Instagram';
      case 'tiktok': return 'TikTok';
      case 'whatsapp': return 'WhatsApp Business';
      case 'website': return 'Sitio Web';
      default: return platform;
    }
  }, []);
  
  // Get platform placeholder
  const getPlaceholder = useCallback((platform: keyof typeof socialLinks) => {
    switch (platform) {
      case 'facebook': return 'tu.pagina';
      case 'instagram': return 'tu_perfil';
      case 'tiktok': return 'tu_perfil';
      case 'whatsapp': return '+503 7777 7777';
      case 'website': return 'www.tusitio.com';
      default: return '';
    }
  }, []);
  
  // Toggle notification preference - safely update both local and context
  const toggleNotificationPref = useCallback((channel: keyof typeof notificationPrefs) => {
    // Create new object to avoid reference issues
    const updatedPrefs = { 
      ...notificationPrefs, 
      [channel]: !notificationPrefs[channel] 
    };
    
    // Update local state first
    setNotificationPrefs(updatedPrefs);
    
    // Flag that we're intentionally updating context, to prevent sync loop
    isUpdatingFromContext.current = true;
    setField('notificationPreferences', updatedPrefs);
    // Reset the flag after a short delay to allow state to settle
    setTimeout(() => {
      isUpdatingFromContext.current = false;
    }, 0);
  }, [notificationPrefs, setField]);
  
  // Helper to autoconnect social media
  const handleAutoConnect = useCallback(() => {
    // In a real app, this would trigger OAuth flows
    alert('Esta función conectaría automáticamente tus redes sociales mediante OAuth.');
  }, []);

  // Handle input focus
  const handleFocus = useCallback((platform: string) => {
    setFocusedInput(platform);
  }, []);

  // Handle input blur
  const handleBlur = useCallback(() => {
    setFocusedInput(null);
  }, []);
  
  // Save all data to ensure nothing is lost
  const saveAllData = useCallback(() => {
    // Flag that we're intentionally updating context
    isUpdatingFromContext.current = true;
    
    // Ensure socialLinks are saved
    setField('socialLinks', socialLinks);
    
    // Ensure notification preferences are saved
    setField('notificationPreferences', notificationPrefs);
    
    // Mark step as complete if we have any data
    const hasAnySocialLink = Object.values(socialLinks).some(link => link && link.trim() !== '');
    if (hasAnySocialLink) {
      markStepComplete('digitalPresence');
    }
    
    // Reset the flag after a short delay
    setTimeout(() => {
      isUpdatingFromContext.current = false;
    }, 0);
  }, [socialLinks, notificationPrefs, setField, markStepComplete]);
  
  // Save on component unmount
  useEffect(() => {
    return () => {
      saveAllData();
    };
  }, [saveAllData]);
  
  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[
        styles.headerSection,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        <Text style={styles.sectionTitle}>Conecta tu ecosistema digital</Text>
        <Text style={styles.sectionSubtitle}>
          Vincula tus redes sociales para crear una experiencia omnicanal y llegar a más clientes.
        </Text>
      </Animated.View>
      
      {/* Social Media Links */}
      <Animated.View style={[
        styles.card,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="link" size={22} color="#0077B5" />
          <Text style={styles.cardTitle}>Redes sociales y web</Text>
        </View>
        
        {/* Auto-connect button */}
        <TouchableOpacity 
          style={styles.autoConnectButton}
          onPress={handleAutoConnect}
          activeOpacity={0.7}
        >
          <MaterialIcons name="bolt" size={20} color="#FFFFFF" />
          <Text style={styles.autoConnectText}>Conectar automáticamente</Text>
        </TouchableOpacity>
        
        {/* Individual platforms */}
        {Object.keys(socialLinks).map((platform, index) => {
          const { icon, color } = getPlatformIcon(platform as keyof typeof socialLinks);
          const isFocused = focusedInput === platform;
          
          return (
            <Animated.View 
              key={platform} 
              style={[
                styles.socialInputContainer,
                { 
                  borderColor: isFocused ? color : '#E9ECF0',
                  transform: [{ 
                    translateY: new Animated.Value(0).interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 10 * (index + 1)]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.socialIconContainer}>
                {icon}
              </View>
              <View style={styles.socialInputWrapper}>
                <Text style={[
                  styles.socialLabel,
                  { color: isFocused ? color : '#5E6A81' }
                ]}>
                  {getPlatformName(platform as keyof typeof socialLinks)}
                </Text>
                <TextInput
                  style={[
                    styles.socialInput,
                    isFocused && { borderColor: color }
                  ]}
                  value={socialLinks[platform as keyof typeof socialLinks]}
                  onChangeText={(text) => 
                    handleSocialLinkChange(
                      platform as keyof typeof socialLinks,
                      formatSocialInput(platform as keyof typeof socialLinks, text)
                    )
                  }
                  placeholder={getPlaceholder(platform as keyof typeof socialLinks)}
                  placeholderTextColor="#AEAEB2"
                  autoCapitalize={platform === 'website' ? 'none' : 'words'}
                  keyboardType={platform === 'whatsapp' ? 'phone-pad' : 'default'}
                  onFocus={() => handleFocus(platform)}
                  onBlur={handleBlur}
                />
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>
      
      {/* Notification Preferences */}
      <Animated.View style={[
        styles.card,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="notifications" size={22} color="#0077B5" />
          <Text style={styles.cardTitle}>Notificaciones</Text>
        </View>
        <Text style={styles.notificationSubtitle}>
          ¿Cómo prefieres recibir alertas sobre pedidos, reservas y mensajes?
        </Text>
        
        {/* Notification toggles */}
        <View style={styles.togglesContainer}>
          {/* Email notifications */}
          <View style={styles.prefItem}>
            <View style={styles.prefInfo}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(229, 57, 53, 0.1)' }]}>
                <MaterialIcons name="email" size={20} color="#E53935" />
              </View>
              <Text style={styles.prefText}>Correo electrónico</Text>
            </View>
            <Switch
              value={notificationPrefs.email}
              onValueChange={() => toggleNotificationPref('email')}
              trackColor={{ false: '#E1E8F0', true: '#0077B5' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E1E8F0"
            />
          </View>
          
          {/* SMS notifications */}
          <View style={styles.prefItem}>
            <View style={styles.prefInfo}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(0, 150, 136, 0.1)' }]}>
                <MaterialIcons name="sms" size={20} color="#009688" />
              </View>
              <Text style={styles.prefText}>SMS</Text>
            </View>
            <Switch
              value={notificationPrefs.sms}
              onValueChange={() => toggleNotificationPref('sms')}
              trackColor={{ false: '#E1E8F0', true: '#0077B5' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E1E8F0"
            />
          </View>
          
          {/* Push notifications */}
          <View style={styles.prefItem}>
            <View style={styles.prefInfo}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(3, 169, 244, 0.1)' }]}>
                <MaterialIcons name="notifications" size={20} color="#03A9F4" />
              </View>
              <Text style={styles.prefText}>Notificaciones push</Text>
            </View>
            <Switch
              value={notificationPrefs.push}
              onValueChange={() => toggleNotificationPref('push')}
              trackColor={{ false: '#E1E8F0', true: '#0077B5' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E1E8F0"
            />
          </View>
          
          {/* WhatsApp notifications */}
          <View style={styles.prefItem}>
            <View style={styles.prefInfo}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(37, 211, 102, 0.1)' }]}>
                <FontAwesome name="whatsapp" size={20} color="#25D366" />
              </View>
              <Text style={styles.prefText}>WhatsApp</Text>
            </View>
            <Switch
              value={notificationPrefs.whatsapp}
              onValueChange={() => toggleNotificationPref('whatsapp')}
              trackColor={{ false: '#E1E8F0', true: '#0077B5' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E1E8F0"
            />
          </View>
        </View>
      </Animated.View>
      
      {/* Tip Section */}
      <Animated.View
        style={[
          styles.tipCard,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' }}
          style={styles.tipBackground}
          imageStyle={styles.tipBackgroundImage}
        >
          <View style={styles.tipContent}>
            <MaterialIcons name="lightbulb" size={28} color="#FFFFFF" />
            <Text style={styles.tipTitle}>PRO TIP</Text>
            <Text style={styles.tipText}>
              Los negocios con presencia en múltiples canales digitales tienen un 80% más de visibilidad y mejores resultados de venta.
            </Text>
          </View>
        </ImageBackground>
      </Animated.View>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0A2463',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#5E6A81',
    marginBottom: 10,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A2463',
    marginLeft: 10,
  },
  autoConnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0077B5',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  autoConnectText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  socialInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E9ECF0',
    alignItems: 'center',
  },
  socialIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F8FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialInputWrapper: {
    flex: 1,
    marginLeft: 15,
  },
  socialLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
  },
  socialInput: {
    fontSize: 16,
    color: '#2C3E50',
    padding: 0,
    height: 25,
  },
  notificationSubtitle: {
    fontSize: 14,
    color: '#5E6A81',
    marginBottom: 20,
    lineHeight: 20,
  },
  togglesContainer: {
    backgroundColor: '#F5F8FA',
    borderRadius: 12,
    overflow: 'hidden',
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECF0',
  },
  prefInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 12,
    fontWeight: '500',
  },
  tipCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 10,
  },
  tipBackground: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  tipBackgroundImage: {
    borderRadius: 16,
  },
  tipContent: {
    padding: 20,
    backgroundColor: 'rgba(0, 119, 181, 0.85)',
    borderRadius: 16,
  },
  tipTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 10,
  },
  tipText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    fontWeight: '500',
  },
});

export default DigitalPresenceStep; 
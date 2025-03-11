import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SocialLinks as SocialLinksType } from '../context/BusinessContext';

interface SocialLinksProps {
  links: SocialLinksType;
}

const SocialLinks: React.FC<SocialLinksProps> = ({ links }) => {
  if (!links || Object.keys(links).filter(key => !!links[key as keyof SocialLinksType]).length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No hay enlaces a redes sociales</Text>
      </View>
    );
  }
  
  const openLink = (url: string) => {
    // Asegurarse de que la URL tenga el prefijo correcto
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    Linking.openURL(url).catch(err => {
      console.error('Error al abrir el enlace:', err);
    });
  };
  
  // Iconos y colores para redes sociales
  const socialIcons: Record<string, {icon: string, color: string}> = {
    facebook: { icon: 'facebook', color: '#1877F2' },
    instagram: { icon: 'camera-alt', color: '#E1306C' },
    twitter: { icon: 'chat', color: '#1DA1F2' },
    tiktok: { icon: 'music-video', color: '#000000' },
    website: { icon: 'public', color: '#007AFF' }
  };
  
  // Nombres para mostrar
  const socialNames: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'Twitter',
    tiktok: 'TikTok',
    website: 'Sitio Web'
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialIcons name="link" size={20} color="#007AFF" />
        <Text style={styles.headerText}>Redes Sociales</Text>
      </View>
      
      <View style={styles.linksContainer}>
        {Object.entries(links).map(([key, url]) => {
          if (!url) return null;
          
          const { icon, color } = socialIcons[key] || { icon: 'link', color: '#007AFF' };
          const name = socialNames[key] || key;
          
          return (
            <TouchableOpacity
              key={key}
              style={styles.linkButton}
              onPress={() => openLink(url)}
            >
              <View style={[styles.iconContainer, { backgroundColor: color }]}>
                <MaterialIcons name={icon as any} size={20} color="white" />
              </View>
              <Text style={styles.linkText}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333333',
  },
  linksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    margin: 6,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#333333',
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  }
});

export default SocialLinks;
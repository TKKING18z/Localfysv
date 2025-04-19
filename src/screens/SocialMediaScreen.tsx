import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Share,
  Linking,
  StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProps = StackNavigationProp<RootStackParamList>;

const SocialMediaScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Redes Sociales</Text>
        <View style={styles.placeholderButton} />
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Social Media Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>¡Síguenos en nuestras redes sociales!</Text>
          <Text style={styles.sectionDescription}>
            Mantente al día con las últimas noticias, promociones, actualizaciones y eventos exclusivos de Localfy.
          </Text>
          
          <View style={styles.socialGrid}>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => Linking.openURL('https://facebook.com/localfy')}
            >
              <View style={[styles.socialIconCircle, { backgroundColor: '#1877F2' }]}>
                <MaterialIcons name="facebook" size={26} color="white" />
              </View>
              <Text style={styles.socialButtonText}>Facebook</Text>
              <Text style={styles.socialUsername}>@localfy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => Linking.openURL('https://instagram.com/localfy')}
            >
              <View style={[styles.socialIconCircle, { backgroundColor: '#C13584' }]}>
                <MaterialIcons name="camera-alt" size={26} color="white" />
              </View>
              <Text style={styles.socialButtonText}>Instagram</Text>
              <Text style={styles.socialUsername}>@localfy</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.socialGrid}>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => Linking.openURL('https://twitter.com/localfy')}
            >
              <View style={[styles.socialIconCircle, { backgroundColor: '#1DA1F2' }]}>
                <MaterialIcons name="alternate-email" size={26} color="white" />
              </View>
              <Text style={styles.socialButtonText}>X</Text>
              <Text style={styles.socialUsername}>@localfy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => Linking.openURL('https://youtube.com/c/localfy')}
            >
              <View style={[styles.socialIconCircle, { backgroundColor: '#FF0000' }]}>
                <MaterialIcons name="smart-display" size={26} color="white" />
              </View>
              <Text style={styles.socialButtonText}>YouTube</Text>
              <Text style={styles.socialUsername}>Localfy Oficial</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.socialGrid}>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => Linking.openURL('https://tiktok.com/@localfy')}
            >
              <View style={[styles.socialIconCircle, { backgroundColor: '#000000' }]}>
                <MaterialIcons name="music-note" size={26} color="white" />
              </View>
              <Text style={styles.socialButtonText}>TikTok</Text>
              <Text style={styles.socialUsername}>@localfy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => Linking.openURL('https://getlocalfy.com')}
            >
              <View style={[styles.socialIconCircle, { backgroundColor: '#007AFF' }]}>
                <MaterialIcons name="public" size={26} color="white" />
              </View>
              <Text style={styles.socialButtonText}>Sitio Web</Text>
              <Text style={styles.socialUsername}>localfy.app</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Community Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Comunidad Localfy</Text>
          <Text style={styles.sectionDescription}>
            Forma parte de nuestra comunidad y comparte tus experiencias con otros usuarios.
          </Text>
          
          <View style={styles.communityCard}>
            <View style={styles.communityImagePlaceholder}>
              <MaterialIcons name="groups" size={48} color="#007AFF" />
            </View>
            <Text style={styles.communityCardTitle}>
              Únete a nuestros grupos de la comunidad
            </Text>
            <Text style={styles.communityCardDescription}>
              Conecta con otros usuarios, comparte recomendaciones y descubre negocios locales favoritos.
            </Text>
            <TouchableOpacity 
              style={styles.communityButton}
              onPress={() => Linking.openURL('https://facebook.com/groups/localfy')}
            >
              <Text style={styles.communityButtonText}>Unirse Ahora</Text>
              <MaterialIcons name="arrow-forward" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Share App Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Comparte Localfy</Text>
          <Text style={styles.sectionDescription}>
            ¿Te gusta nuestra app? ¡Compártela con tus amigos y familiares!
          </Text>
          
          <TouchableOpacity 
            style={styles.shareAppButton}
            onPress={() => {
              Share.share({
                message: '¡Descubre Localfy! La mejor app para encontrar negocios locales en tu área o subir tu propio neogcio. Descárgala ahora: https://localfy.app/download',
                title: 'Localfy App'
              });
            }}
          >
            <MaterialIcons name="share" size={24} color="white" />
            <Text style={styles.shareAppButtonText}>Compartir Localfy</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.footer} />
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  placeholderButton: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    lineHeight: 20,
  },
  socialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  socialButton: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#F0F0F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  socialIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  socialUsername: {
    fontSize: 14,
    color: '#8E8E93',
  },
  communityCard: {
    backgroundColor: '#F8F9FF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E5FF',
  },
  communityImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E1E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  communityCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 12,
  },
  communityCardDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  communityButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  communityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginRight: 8,
  },
  shareAppButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  shareAppButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginLeft: 12,
  },
  footer: {
    height: 40,
  },
});

export default SocialMediaScreen; 
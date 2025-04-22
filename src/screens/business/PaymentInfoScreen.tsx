import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

const PaymentInfoScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proceso de Pagos</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.contentContainer}>
          <Image 
            source={{ uri: 'https://via.placeholder.com/400x200?text=Proceso+de+Pagos' }} 
            style={styles.illustration}
            resizeMode="contain"
          />
          
          <Text style={styles.title}>¿Cómo funciona el proceso de pagos en Localfy?</Text>
          
          <View style={styles.section}>
            <View style={styles.stepContainer}>
              <View style={styles.stepNumberContainer}>
                <Text style={styles.stepNumber}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Recepción de pagos</Text>
                <Text style={styles.stepDescription}>
                  Cuando un cliente realiza un pedido a través de Localfy, puede pagar de dos maneras:
                </Text>
                <View style={styles.bulletContainer}>
                  <MaterialIcons name="circle" size={8} color="#007AFF" style={styles.bullet} />
                  <Text style={styles.bulletText}>Pago digital: El cliente paga directamente en la app con tarjeta o billetera electrónica.</Text>
                </View>
                <View style={styles.bulletContainer}>
                  <MaterialIcons name="circle" size={8} color="#007AFF" style={styles.bullet} />
                  <Text style={styles.bulletText}>Pago en efectivo: El cliente paga al recibir el pedido.</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumberContainer}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Procesamiento de transacciones</Text>
                <Text style={styles.stepDescription}>
                  Localfy procesa todas las transacciones de manera segura, actuando como intermediario entre el cliente y tu negocio.
                </Text>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumberContainer}>
                <Text style={styles.stepNumber}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Liquidación semanal</Text>
                <Text style={styles.stepDescription}>
                  Cada semana, Localfy realiza una liquidación de todas tus ventas:
                </Text>
                <View style={styles.bulletContainer}>
                  <MaterialIcons name="circle" size={8} color="#007AFF" style={styles.bullet} />
                  <Text style={styles.bulletText}>Ciclo semanal: ventas de lunes a domingo.</Text>
                </View>
                <View style={styles.bulletContainer}>
                  <MaterialIcons name="circle" size={8} color="#007AFF" style={styles.bullet} />
                  <Text style={styles.bulletText}>Miércoles: recibes el estado de cuenta detallado.</Text>
                </View>
                <View style={styles.bulletContainer}>
                  <MaterialIcons name="circle" size={8} color="#007AFF" style={styles.bullet} />
                  <Text style={styles.bulletText}>Jueves: recepción automática de fondos por transferencia bancaria.</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumberContainer}>
                <Text style={styles.stepNumber}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Comisiones transparentes</Text>
                <Text style={styles.stepDescription}>
                  Localfy cobra una comisión competitiva del 15-25% por cada venta procesada. Esta comisión cubre:
                </Text>
                <View style={styles.bulletContainer}>
                  <MaterialIcons name="circle" size={8} color="#007AFF" style={styles.bullet} />
                  <Text style={styles.bulletText}>Procesamiento de pagos</Text>
                </View>
                <View style={styles.bulletContainer}>
                  <MaterialIcons name="circle" size={8} color="#007AFF" style={styles.bullet} />
                  <Text style={styles.bulletText}>Marketing y promoción de tu negocio</Text>
                </View>
                <View style={styles.bulletContainer}>
                  <MaterialIcons name="circle" size={8} color="#007AFF" style={styles.bullet} />
                  <Text style={styles.bulletText}>Soporte técnico y atención al cliente</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.infoContainer}>
            <MaterialIcons name="info-outline" size={24} color="#007AFF" />
            <View style={styles.infoContentContainer}>
              <Text style={styles.infoText}>
                Para recibir pagos, necesitarás proporcionar tu información bancaria en la sección de "Perfil de Negocio".
              </Text>
              <TouchableOpacity 
                style={styles.bankInfoButton}
                onPress={() => navigation.navigate('BusinessBankAccount')}
              >
                <Text style={styles.bankInfoButtonText}>Configurar cuenta bancaria</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A2463',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  illustration: {
    width: '100%',
    height: 200,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0A2463',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepNumberContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#5E6A81',
    marginBottom: 8,
    lineHeight: 22,
  },
  bulletContainer: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  bullet: {
    marginTop: 6,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: '#5E6A81',
    lineHeight: 20,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,122,255,0.1)',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  infoContentContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#2C3E50',
    lineHeight: 22,
    marginBottom: 12,
  },
  bankInfoButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  bankInfoButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default PaymentInfoScreen; 
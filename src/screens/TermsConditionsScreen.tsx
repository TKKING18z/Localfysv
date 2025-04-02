import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProps = StackNavigationProp<RootStackParamList>;

const TermsConditionsScreen: React.FC = () => {
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
        <Text style={styles.title}>Términos y Condiciones</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          {/* Introduction */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Introducción</Text>
            <Text style={styles.paragraph}>
              Bienvenido a Localfy. Estos Términos y Condiciones rigen el uso de la aplicación Localfy y todos los servicios relacionados. Al acceder o utilizar nuestra aplicación, usted acepta estos términos en su totalidad. Si no está de acuerdo con estos términos, por favor no utilice nuestra aplicación.
            </Text>
          </View>

          {/* User Accounts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Cuentas de Usuario</Text>
            <Text style={styles.paragraph}>
              Para utilizar algunas funciones de Localfy, es posible que deba crear una cuenta de usuario. Usted es responsable de mantener la confidencialidad de su cuenta y contraseña, y acepta responsabilidad por todas las actividades que ocurran bajo su cuenta.
            </Text>
          </View>

          {/* Business Listings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Listados de Negocios</Text>
            <Text style={styles.paragraph}>
              Los propietarios de negocios son responsables de la precisión y legalidad del contenido que publican en Localfy. No permitimos contenido falso, engañoso, ofensivo o que infrinja derechos de propiedad intelectual.
            </Text>
          </View>

          {/* Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Privacidad y Datos</Text>
            <Text style={styles.paragraph}>
              Nuestra Política de Privacidad describe cómo recopilamos, usamos y compartimos su información personal. Al utilizar Localfy, usted acepta nuestras prácticas de datos como se describe en nuestra Política de Privacidad.
            </Text>
          </View>

          {/* Limitations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Limitación de Responsabilidad</Text>
            <Text style={styles.paragraph}>
              Localfy se proporciona "tal cual" y "según disponibilidad". No garantizamos que la aplicación sea siempre segura, libre de errores o que funcione sin interrupciones. En la medida permitida por la ley, no seremos responsables por cualquier daño indirecto, consecuente, especial, incidental o punitivo.
            </Text>
          </View>

          {/* Changes to Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Cambios en los Términos</Text>
            <Text style={styles.paragraph}>
              Podemos modificar estos Términos en cualquier momento. Los cambios se harán efectivos después de la publicación de los Términos revisados. El uso continuado de Localfy después de dichos cambios constituye su aceptación de los nuevos términos.
            </Text>
          </View>

          {/* Termination */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Terminación</Text>
            <Text style={styles.paragraph}>
              Podemos suspender o terminar su acceso a Localfy en cualquier momento y por cualquier motivo, incluyendo pero no limitado a una violación de estos Términos. Usted también puede terminar su relación con nosotros eliminando su cuenta. Al terminar, su derecho a usar la aplicación cesará inmediatamente.
            </Text>
          </View>

          {/* Intellectual Property */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Propiedad Intelectual</Text>
            <Text style={styles.paragraph}>
              Localfy y todo su contenido, características y funcionalidades son propiedad de nuestra empresa y están protegidos por leyes de propiedad intelectual. No puede reproducir, distribuir, modificar, crear obras derivadas, exhibir públicamente o usar nuestro contenido sin nuestro permiso expreso.
            </Text>
          </View>

          {/* User Content */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Contenido del Usuario</Text>
            <Text style={styles.paragraph}>
              Al publicar contenido en Localfy, usted nos otorga una licencia mundial, no exclusiva, libre de regalías para usar, reproducir, modificar y mostrar dicho contenido en relación con el servicio. Usted declara y garantiza que tiene todos los derechos necesarios para otorgarnos esta licencia.
            </Text>
          </View>

          {/* Prohibited Activities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Actividades Prohibidas</Text>
            <Text style={styles.paragraph}>
              Está prohibido utilizar Localfy para cualquier propósito ilegal o no autorizado. No puede: (a) violar leyes o regulaciones, (b) infringir derechos de terceros, (c) enviar contenido ofensivo o inapropiado, (d) interferir con la seguridad o funcionamiento de la aplicación, (e) involucrarse en actividades fraudulentas o engañosas.
            </Text>
          </View>

          {/* Reviews and Ratings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Reseñas y Calificaciones</Text>
            <Text style={styles.paragraph}>
              Las reseñas y calificaciones deben basarse en experiencias reales y no deben contener lenguaje abusivo, ofensivo o ilegal. Nos reservamos el derecho de eliminar reseñas que no cumplan con nuestras políticas o que consideremos inapropiadas.
            </Text>
          </View>

          {/* Payments and Transactions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>12. Pagos y Transacciones</Text>
            <Text style={styles.paragraph}>
              Para compras realizadas a través de Localfy, usted acepta pagar todos los cargos correspondientes. No somos responsables de disputas entre usuarios y negocios relacionadas con productos, servicios o pagos. Las transacciones son entre usted y el negocio, actuando nosotros solo como intermediarios.
            </Text>
          </View>

          {/* Governing Law */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>13. Ley Aplicable</Text>
            <Text style={styles.paragraph}>
              Estos Términos se regirán e interpretarán de acuerdo con las leyes de El Salvador, sin tener en cuenta sus principios de conflicto de leyes. Cualquier disputa que surja en relación con estos Términos estará sujeta a la jurisdicción exclusiva de los tribunales de El Salvador.
            </Text>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>14. Información de Contacto</Text>
            <Text style={styles.paragraph}>
              Si tiene preguntas o comentarios sobre estos Términos, por favor contáctenos a través de nuestro formulario de contacto en la aplicación o envíenos un correo electrónico a soporte@localfy.com.
            </Text>
          </View>

          {/* Acceptance */}
          <View style={styles.section}>
            <Text style={[styles.paragraph, styles.finalParagraph]}>
              Al usar Localfy, usted reconoce que ha leído y entendido estos Términos y Condiciones y acepta estar legalmente obligado por ellos.
            </Text>
            <Text style={styles.lastUpdated}>Última actualización: 1 de abril de 2025</Text>
          </View>
        </View>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666666',
  },
  finalParagraph: {
    fontWeight: '500',
    marginTop: 24,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 16,
    fontStyle: 'italic',
  },
});

export default TermsConditionsScreen;
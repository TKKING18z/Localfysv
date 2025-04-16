quiero crear esta implementacion de onboardingaddbusiness, para hacer mas facil el proceso de crear negocios, quiero mejorar mi sistema actual de crear los negocios(carpeta addbusiness puedes ver los archivos y addbusinessscreen.tsx)sigue adecuadamente los pasos, y la implemetnacion que quiero. Pantalla de Bienvenida

[Animación de logo Localfy]

# Haz crecer tu negocio con Localfy

Únete a la mayor comunidad de negocios locales de El Salvador.
Configuremos tu perfil para maximizar tu visibilidad y atraer más clientes.

[Botón principal] Comenzar
[Enlace secundario] Ya tengo un negocio registrado
Flujo Principal - Diseño minimalista con progreso visual
Paso 1: Información Básica
[Barra de progreso: 1/5]

# Lo básico primero

Solo necesitamos algunos datos esenciales para empezar. Podrás completar el resto cuando lo desees.

[Campo] Nombre del negocio*
[Campo] Categoría principal* [Menú desplegable con categorías]
[Campo] Subcategoría [Menú desplegable dinámico basado en categoría]
[Campo] Ubicación* [Integración con mapa para seleccionar punto exacto]
[Campo] Teléfono de contacto*
[Campo] Correo electrónico de negocio*

* Campos requeridos

[Botón] Continuar →
Paso 2: Perfil Visual
[Barra de progreso: 2/5]

# Dale identidad a tu negocio

Las empresas con imágenes de calidad reciben 2.5 veces más interacciones.

[Área] Logo del negocio [Con herramienta de recorte]
[Icono de información] "Puedes subir un logo de 500 x 500 píxeles para mejores resultados"

[Área] Imagen de portada [Recomendaciones de tamaño]
[Icono de información] "Recomendamos imágenes horizontales de 1200 x 630 píxeles"

[Área] Galería de imágenes
[+] Añadir más fotos (mínimo 3 recomendadas)

[Consejo] "Consejo Pro: Incluye fotos de tus productos/servicios, el espacio físico y tu equipo para generar confianza"

[Botón] Continuar →
[Enlace prominente] Completar más tarde ✓
Paso 3: Oferta de Valor
[Barra de progreso: 3/5]

# ¿Qué hace especial a tu negocio?

[Campo] Descripción corta* (máximo 120 caracteres)
[Placeholder] "Ej: Cafetería artesanal con productos orgánicos y ambiente acogedor"

[Campo para texto enriquecido] Descripción completa
- Cuéntanos sobre tu negocio
- ¿Qué servicios o productos ofreces?
- ¿Qué te diferencia de la competencia?

[Botón asistente] Ayúdame a redactar [Genera sugerencias basadas en la categoría]

[Sección] Palabras clave relevantes [Botones de etiquetas sugeridas para añadir]

[Botón] Continuar →
[Enlace prominente] Guardar borrador y continuar después
Paso 4: Operaciones del Negocio
[Barra de progreso: 4/5]

# ¿Cómo funciona tu negocio?

## Horarios de atención
[Interface intuitiva para seleccionar días y horarios]
[Botón] Usar horario estándar (L-V 8AM-5PM, S 8AM-12PM)
[Opción] Añadir horarios especiales (feriados, temporadas)

## Servicios que ofreces (selecciona los que apliquen)
□ Entrega a domicilio
  [Si se selecciona] ¿Área de cobertura? [Mapa para radio o zonas]
□ Compras en línea
  [Si se selecciona] Configurar catálogo de productos
□ Reservaciones/Citas
  [Si se selecciona] Configurar disponibilidad
□ Atención personalizada
□ Wi-Fi gratuito
□ Estacionamiento disponible
[+] Añadir servicio personalizado

## Métodos de pago aceptados
[Lista de opciones con iconos para seleccionar]

[Botón] Continuar →
[Enlace prominente] Personalizar después
Paso 5: Presencia Digital
[Barra de progreso: 5/5]

# Conecta tu ecosistema digital

Vincula tus redes sociales para crear una experiencia omnicanal.

[Campo con icono] Facebook
[Campo con icono] Instagram
[Campo con icono] TikTok
[Campo con icono] WhatsApp Business
[Campo con icono] Sitio web

[Botón] Conectar automáticamente [Usa OAuth para vincular cuentas]

## Notificaciones
¿Cómo prefieres recibir alertas sobre pedidos, reservas y mensajes?
○ Correo electrónico
○ SMS
○ Notificaciones push
○ WhatsApp

[Botón] Finalizar configuración
[Enlace] Configurar redes sociales después
Pantalla de Conclusión
[Animación de celebración/confeti]

# ¡Tu negocio está listo para brillar!

[Tarjeta de perfil con vista previa]

Nivel de perfil: [Barra de progreso] 75% Completo
Completa las siguientes acciones para alcanzar el 100% y mejorar tu visibilidad:
- Añadir menú/catálogo completo (+10%)
- Configurar tu primera promoción (+10%)
- Verificar tu negocio (+5%)

[Botón] Recibir recordatorios para completar mi perfil

## ¿Qué sigue?

[Botón con icono] Personalizar panel de control
[Botón con icono] Crear mi primera promoción
[Botón con icono] Invitar a mi equipo
[Botón con icono] Ver tutorial de uso

[Botón principal] Ir a mi perfil

toma muy en cuenta esto Aprovecha el código existente: Reutiliza componentes y lógica que ya tienes.
Experiencia mejorada: Proporciona un flujo por pasos más amigable y menos abrumador.
Flexibilidad: Permite completar partes más tarde sin perder progreso.
Gamificación: Muestra el progreso y motiva a completar el perfil.
Contextualización: Cada pantalla se enfoca en un aspecto específico del registro.

Consideraciones

Persistencia de datos: Asegúrate de guardar el progreso para que los usuarios puedan continuar donde lo dejaron si salen de la app.
**Validaciones
Continuando con la implementación del onboarding profesional en tu app Localfy:
Consideraciones adicionales

- **Validaciones por paso**: Implementa validaciones específicas para cada paso del onboarding, permitiendo avanzar solo cuando se cumplan los requisitos mínimos.

- **Integración con almacenamiento**: Asegúrate de que el estado del onboarding se guarde en tu servicio `firebaseService` para permitir la continuación entre sesiones.

- **Retroalimentación visual**: Añade animaciones sutiles y feedback visual para hacer la experiencia más agradable.

### 8. Integración con el Sistema de Recordatorios

```typescript
// En OnboardingContext.tsx, añade:
interface ReminderSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  items: string[];
}

// Y en el contexto:
const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
  enabled: false,
  frequency: 'weekly',
  items: []
});

// Función para configurar recordatorios
const setupReminders = (settings: Partial<ReminderSettings>) => {
  setReminderSettings(prev => ({ ...prev, ...settings }));
  // Implementar la lógica para guardar en Firebase
  if (settings.enabled && user?.uid) {
    firebaseService.users.updateUserSettings(user.uid, {
      businessReminders: { ...reminderSettings, ...settings }
    });
  }
};
```

### 9. Vista previa en tiempo real

Puedes implementar una vista previa del perfil de negocio que se actualice en tiempo real mientras el usuario completa la información:

```typescript
// BusinessPreviewComponent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BusinessFormState } from '../hooks/business/useAddBusiness';

interface BusinessPreviewProps {
  formState: BusinessFormState;
  previewType?: 'card' | 'detail' | 'search';
}

const BusinessPreviewComponent: React.FC<BusinessPreviewProps> = ({
  formState,
  previewType = 'card'
}) => {
  const getImageSource = () => {
    if (formState.image) {
      return { uri: formState.image };
    }
    return require('../assets/images/placeholder-business.png');
  };

  // Diferentes estilos de vista previa según el tipo
  if (previewType === 'card') {
    return (
      <View style={styles.cardContainer}>
        <Image source={getImageSource()} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            {formState.name || 'Nombre del Negocio'}
          </Text>
          <Text style={styles.cardCategory}>
            {formState.category || 'Categoría'}
          </Text>
          <View style={styles.ratingContainer}>
            <MaterialIcons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>Nueva</Text>
          </View>
        </View>
      </View>
    );
  }

  // Implementar otros tipos de vista previa...

  return (
    <View style={styles.detailContainer}>
      <Image source={getImageSource()} style={styles.detailImage} />
      <View style={styles.detailHeader}>
        <Text style={styles.detailTitle}>
          {formState.name || 'Nombre del Negocio'}
        </Text>
        <Text style={styles.detailCategory}>
          {formState.category || 'Categoría'}
        </Text>
      </View>
      <Text style={styles.detailDescription}>
        {formState.description || 'Descripción del negocio...'}
      </Text>
      
      {formState.address && (
        <View style={styles.detailInfoRow}>
          <MaterialIcons name="location-on" size={20} color="#007AFF" />
          <Text style={styles.detailInfoText}>{formState.address}</Text>
        </View>
      )}
      
      {formState.phone && (
        <View style={styles.detailInfoRow}>
          <MaterialIcons name="phone" size={20} color="#007AFF" />
          <Text style={styles.detailInfoText}>{formState.phone}</Text>
        </View>
      )}
      
      <Text style={styles.previewNote}>
        Vista previa - Así verán tu negocio los usuarios
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // Estilos para diferentes tipos de vista previa...
  cardContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    margin: 8,
    width: 180,
  },
  cardImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  cardCategory: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  detailContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  detailHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F7FF',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  detailCategory: {
    fontSize: 16,
    color: '#8E8E93',
  },
  detailDescription: {
    fontSize: 16,
    color: '#2C3E50',
    lineHeight: 24,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F7FF',
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F7FF',
  },
  detailInfoText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 12,
    flex: 1,
  },
  previewNote: {
    textAlign: 'center',
    fontSize: 14,
    color: '#8E8E93',
    padding: 8,
    backgroundColor: '#F0F7FF',
  },
});

export default BusinessPreviewComponent;
```

### 10. Manejo de errores y desconexiones

Implementa un sistema para manejar errores durante el onboarding y guardar automáticamente el progreso:

```typescript
// En tu OnboardingContext.tsx
const saveProgress = async () => {
  if (!user?.uid) return;
  
  try {
    setIsSaving(true);
    
    // Guardar en Firestore
    await firebase.firestore()
      .collection('users')
      .doc(user.uid)
      .collection('business_drafts')
      .doc('onboarding_draft')
      .set({
        formState,
        stepCompleted,
        stepsForLater,
        progress,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });
      
    setIsSaving(false);
    setLastSaved(new Date());
  } catch (error) {
    console.error('Error al guardar progreso:', error);
    setIsSaving(false);
  }
};

// Usar un efecto para guardar automáticamente
useEffect(() => {
  const saveTimeout = setTimeout(saveProgress, 10000); // Guardar cada 10 segundos
  return () => clearTimeout(saveTimeout);
}, [formState, stepCompleted]);

// Recuperar progreso guardado
const recoverProgress = async () => {
  if (!user?.uid) return;
  
  try {
    const docRef = await firebase.firestore()
      .collection('users')
      .doc(user.uid)
      .collection('business_drafts')
      .doc('onboarding_draft')
      .get();
      
    if (docRef.exists) {
      const data = docRef.data();
      setFormState(data.formState);
      setStepCompleted(data.stepCompleted);
      setStepsForLater(data.stepsForLater);
      setProgress(data.progress);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error al recuperar progreso:', error);
    return false;
  }
};
```

### 11. Plantillas para Tipos de Negocio Específicos

```typescript
// businessTemplates.ts
export const BUSINESS_TEMPLATES = {
  'Restaurante': {
    description: 'Ofrecemos una experiencia culinaria única con platos preparados con ingredientes frescos y locales. Nuestro ambiente acogedor es perfecto para disfrutar en familia o con amigos.',
    suggestedFeatures: ['Wi-Fi gratuito', 'Estacionamiento', 'Reservaciones'],
    suggestedKeywords: ['comida', 'restaurante', 'gourmet', 'chef', 'local'],
    sections: ['menu', 'galeria', 'reservaciones', 'horario', 'delivery']
  },
  'Cafetería': {
    description: 'Un espacio acogedor para disfrutar de las mejores variedades de café, acompañadas de deliciosos postres y snacks. El lugar ideal para trabajar, estudiar o reunirse con amigos.',
    suggestedFeatures: ['Wi-Fi gratuito', 'Enchufes para laptop', 'Terraza'],
    suggestedKeywords: ['café', 'postres', 'espresso', 'ambiente', 'acogedor'],
    sections: ['menu', 'galeria', 'horario', 'wifi']
  },
  'Tienda': {
    description: 'Tu destino para encontrar productos de calidad con el mejor servicio. Ofrecemos variedad, buenos precios y atención personalizada para satisfacer tus necesidades.',
    suggestedFeatures: ['Envío a domicilio', 'Garantía', 'Devoluciones'],
    suggestedKeywords: ['tienda', 'productos', 'compras', 'calidad', 'servicio'],
    sections: ['catalogo', 'galeria', 'horario', 'delivery', 'pagos']
  },
  // Más plantillas...
};

// Función para aplicar plantilla
export const applyBusinessTemplate = (category: string, formState: BusinessFormState): BusinessFormState => {
  const normalizedCategory = getNormalizedCategory(category);
  const template = BUSINESS_TEMPLATES[normalizedCategory];
  
  if (!template) return formState;
  
  return {
    ...formState,
    description: formState.description || template.description,
    // Aplicar otras propiedades según la plantilla
  };
};

// Función para normalizar categoría
const getNormalizedCategory = (category: string): string => {
  // Mapear categorías similares a una plantilla existente
  if (category.includes('Restaurante') || category.includes('Comida')) {
    return 'Restaurante';
  }
  if (category.includes('Café') || category.includes('Cafetería')) {
    return 'Cafetería';
  }
  // Más mapeos...
  
  return category;
};
```

### 12. Modo Express vs. Modo Detallado

```typescript
// OnboardingModeSelectionScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOnboarding } from '../context/OnboardingContext';

const OnboardingModeSelectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { setOnboardingMode } = useOnboarding();
  
  const handleSelectExpressMode = () => {
    setOnboardingMode('express');
    navigation.navigate('OnboardingBasicInfo');
  };
  
  const handleSelectDetailedMode = () => {
    setOnboardingMode('detailed');
    navigation.navigate('OnboardingBasicInfo');
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Elige cómo configurar tu negocio</Text>
      
      <TouchableOpacity 
        style={[styles.modeCard, styles.expressCard]}
        onPress={handleSelectExpressMode}
      >
        <View style={styles.iconContainer}>
          <MaterialIcons name="flash-on" size={36} color="#007AFF" />
        </View>
        <View style={styles.modeInfo}>
          <Text style={styles.modeTitle}>Configuración Express</Text>
          <Text style={styles.modeTime}>5 minutos</Text>
          <Text style={styles.modeDescription}>
            Solo lo esencial para empezar rápidamente con tu negocio en Localfy. Podrás completar el resto después.
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.modeCard, styles.detailedCard]}
        onPress={handleSelectDetailedMode}
      >
        <View style={styles.iconContainer}>
          <MaterialIcons name="stars" size={36} color="#34C759" />
        </View>
        <View style={styles.modeInfo}>
          <Text style={styles.modeTitle}>Configuración Completa</Text>
          <Text style={styles.modeTime}>10-15 minutos</Text>
          <Text style={styles.modeDescription}>
            Todas las opciones para maximizar tu presencia desde el inicio. Configura promociones, reservaciones y más.
          </Text>
        </View>
      </TouchableOpacity>
      
      <Text style={styles.noteText}>
        Puedes cambiar de modo en cualquier momento durante la configuración
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 30,
    textAlign: 'center',
  },
  modeCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  expressCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  detailedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.1)',
    marginRight: 16,
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  modeTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 14,
    color: '#2C3E50',
    lineHeight: 20,
  },
  noteText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default OnboardingModeSelectionScreen;
```

## Proceso de Implementación Paso a Paso

1. **Crea el contexto de onboarding** para gestionar el estado compartido entre pantallas.

2. **Implementa las nuevas pantallas** de onboarding reutilizando los componentes que ya tienes.

3. **Modifica el AppNavigator** para incluir las nuevas rutas y mantener el flujo.

4. **Adapta useAddBusiness** para trabajar con el nuevo contexto de onboarding.

5. **Implementa la persistencia** para guardar el progreso automáticamente.

6. **Añade animaciones y transiciones** para mejorar la experiencia visual.

7. **Integra los recordatorios** para los usuarios que deciden completar secciones más tarde.

8. **Prueba el flujo completo** y ajusta según la retroalimentación.

## Optimizaciones adicionales

1. **Carga diferida de componentes pesados**: Para mejorar el rendimiento, puedes cargar componentes pesados (como el mapa) solo cuando sean necesarios.

2. **Precarga de información del usuario**: Si el usuario ya tiene otros negocios, puedes precargar cierta información en el onboarding.

3. **Sistema de recompensas**: Implementa un sistema de puntos o recompensas por completar el perfil de negocio al 100%.

4. **A/B Testing**: Configura diferentes variantes del onboarding para comparar cuál genera mejores tasas de finalización.

Este enfoque integral te permitirá transformar tu experiencia actual de registro de negocios en un onboarding profesional, atractivo y flexible, similar al de las aplicaciones líderes del mercado, manteniendo la compatibilidad con tu código existente y aprovechando los componentes que ya has desarrollado.
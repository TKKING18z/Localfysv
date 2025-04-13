# Solución de problemas al actualizar a Expo SDK 52

## Cambios realizados

Hemos realizado las siguientes actualizaciones para hacer que la aplicación sea compatible con Expo SDK 52:

1. Actualizado el servicio de notificaciones para trabajar con el nuevo método de obtención de tokens push
2. Mejorado el manejo de errores en App.tsx
3. Actualizado el componente OrdersListScreen para optimizar el rendimiento y compatibilidad

## Problemas comunes y soluciones

### 1. Errores con notificaciones push

**Problema**: El método `getExpoPushTokenAsync()` ahora requiere un `projectId`.

**Solución**: Hemos actualizado el servicio de notificaciones para usar Constants.expoConfig o un ID de fallback en desarrollo:

```javascript
const projectId = Constants.expoConfig?.extra?.eas?.projectId ||
                Constants.easConfig?.projectId ||
                'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'; // Fallback ID en desarrollo

tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: projectId
});
```

### 2. Problemas con SplashScreen

**Problema**: El manejo de SplashScreen ha cambiado ligeramente en Expo SDK 52.

**Solución**: Actualizado el manejo de errores al ocultar la pantalla de splash:

```javascript
try {
  SplashScreen.hideAsync();
} catch (error) {
  console.warn('Error hiding splash screen:', error);
}
```

### 3. Optimizaciones de FlatList

**Problema**: Las listas pueden tener problemas de rendimiento o mostrar advertencias.

**Solución**: Hemos actualizado el componente OrdersListScreen.tsx con mejores prácticas:

- Mejor validación de datos
- Uso de `toString()` para garantizar valores string antes de aplicar `toLowerCase()`
- Implementación de `windowSize`, `maxToRenderPerBatch` y otras optimizaciones
- Mejor manejo de errores en el renderItem

### 4. Otros posibles problemas y soluciones

#### Problema con React Navigation

Si hay problemas con React Navigation, verifica que todas las dependencias relacionadas estén actualizadas:

```bash
npx expo install @react-navigation/native @react-navigation/stack @react-navigation/native-stack react-native-screens react-native-safe-area-context
```

#### Problemas con gestos y animaciones

Si hay problemas con gestos o animaciones:

```bash
npx expo install react-native-gesture-handler react-native-reanimated
```

#### Problemas con imagen o cámara

Si hay problemas con estos componentes:

```bash
npx expo install expo-image expo-camera
```

## Pasos adicionales recomendados

1. **Limpiar caché**: A veces es necesario limpiar el caché de Metro y de la aplicación:

```bash
npx expo start --clear
```

2. **Reinstalar node_modules**: En casos extremos, puede ser útil:

```bash
rm -rf node_modules
npm install
```

3. **Actualiza el simulador**: Asegúrate de que estás usando la última versión del simulador de iOS.

4. **Cierra aplicaciones en segundo plano**: Cierra todas las aplicaciones innecesarias para liberar memoria.

## Solución de problemas específicos

Si encuentras un error específico, puedes:

1. Buscar el mensaje de error exacto en Google o Stack Overflow
2. Consultar la [documentación oficial de Expo SDK 52](https://docs.expo.dev/versions/v52.0.0/)
3. Revisar los [cambios importantes (breaking changes)](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) 
// Ensure idb polyfill is loaded first if needed
if (typeof window !== 'undefined' && !window.indexedDB) {
  console.log('Applying IndexedDB polyfill for Firebase compatibility');
}

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processPendingUploads, clearOldPendingUploads } from './ImageUploadService';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import firebase from '../../firebase.config';

// Keep splash screen visible while we initialize
SplashScreen.preventAutoHideAsync();

// Configuration for initialization
interface InitConfig {
  // Whether to prefetch images
  prefetchImages: boolean;
  // Whether to process pending uploads
  processPendingUploads: boolean;
  // Whether to clear old cache
  clearCache: boolean;
  // Cache expiration in days
  cacheExpirationDays: number;
  // Custom initialization tasks
  customTasks?: Array<() => Promise<void>>;
}

// Default configuration
const DEFAULT_CONFIG: InitConfig = {
  prefetchImages: true,
  processPendingUploads: true,
  clearCache: true,
  cacheExpirationDays: 7,
  customTasks: []
};

// Resources to prefetch for faster app rendering
const imagesToPrefetch = [
  require('../../assets/icon.png'),
  require('../../assets/icon.png'),
  require('../../assets/Iconprofile.png'),
];

// Font map for preloading fonts
const fontMap = {
  'Roboto-Regular': require('../../assets/fonts/Roboto-Regular.ttf'),
  'Roboto-Bold': require('../../assets/fonts/Roboto-Bold.ttf'),
};

// Track initialization status
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Preload assets (images, fonts, etc.)
 */
async function preloadAssets(): Promise<void> {
  const imageAssets = imagesToPrefetch.map(image => {
    if (typeof image === 'string') {
      return Asset.fromURI(image).downloadAsync();
    } else {
      return Asset.fromModule(image).downloadAsync();
    }
  });

  const fontAssets = Object.entries(fontMap).map(([name, source]) => 
    Font.loadAsync({ [name]: source })
  );

  await Promise.all([...imageAssets, ...fontAssets]);
}

/**
 * Clear old caches to free up space
 * @param days Number of days to keep files
 */
async function clearOldCaches(days: number): Promise<void> {
  try {
    // Clear old pending uploads
    await clearOldPendingUploads(days);
    
    // Clear old cached images
    const cacheDirectory = `${FileSystem.cacheDirectory}cached_images/`;
    const dirInfo = await FileSystem.getInfoAsync(cacheDirectory);
    
    if (dirInfo.exists) {
      const contents = await FileSystem.readDirectoryAsync(cacheDirectory);
      const now = Date.now();
      const maxAge = days * 24 * 60 * 60 * 1000; // days to milliseconds
      
      // Get file info for each item to check its modification time
      for (const item of contents) {
        try {
          const fileUri = `${cacheDirectory}${item}`;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          
          if (fileInfo.exists && fileInfo.modificationTime && now - fileInfo.modificationTime > maxAge) {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
          }
        } catch (e) {
          // Ignore errors for individual files
          console.warn(`Failed to delete cached file: ${item}`);
        }
      }
    }
  } catch (error: any) {
    console.error('Error clearing caches:', error.message);
  }
}

/**
 * Check if Firebase auth is initialized
 */
function isFirebaseReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const unsubscribe = firebase.auth().onAuthStateChanged(() => {
      unsubscribe();
      resolve(true);
    });
  });
}

/**
 * Process background tasks like pending uploads
 */
async function processBackgroundTasks(): Promise<void> {
  try {
    // Process any pending uploads
    const networkState = await NetInfo.fetch();
    if (networkState.isConnected && networkState.isInternetReachable) {
      await processPendingUploads();
    }
  } catch (error: any) {
    console.error('Error processing background tasks:', error.message);
  }
}

/**
 * Initialize the app
 * @param config Optional configuration object
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeApp(config: Partial<InitConfig> = {}): Promise<void> {
  // If already initializing, return the current promise
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // If already initialized, return immediately
  if (isInitialized) {
    return Promise.resolve();
  }
  
  // Merge with default config
  const finalConfig: InitConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Create initialization promise
  initializationPromise = (async () => {
    try {
      // Wait for Firebase auth to be ready
      await isFirebaseReady();
      
      // Preload assets in parallel with other tasks
      const tasks: Promise<any>[] = [];
      
      if (finalConfig.prefetchImages) {
        tasks.push(preloadAssets());
      }
      
      // Wait for all initialization tasks to complete
      await Promise.all(tasks);
      
      // Run background tasks that aren't critical for app start
      setTimeout(async () => {
        try {
          if (finalConfig.processPendingUploads) {
            await processBackgroundTasks();
          }
          
          if (finalConfig.clearCache) {
            await clearOldCaches(finalConfig.cacheExpirationDays);
          }
          
          // Run any custom tasks
          if (finalConfig.customTasks && finalConfig.customTasks.length > 0) {
            for (const task of finalConfig.customTasks) {
              await task();
            }
          }
        } catch (error: any) {
          console.error('Error in background initialization:', error.message);
        }
      }, 2000);
      
      // Mark as initialized
      isInitialized = true;
    } catch (error: any) {
      console.error('App initialization failed:', error.message);
      throw error;
    } finally {
      // Clear the promise
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
}

/**
 * Hide the splash screen
 */
export async function finishInitialization(): Promise<void> {
  try {
    await SplashScreen.hideAsync();
  } catch (error: any) {
    console.error('Error hiding splash screen:', error.message);
  }
}

/**
 * Check if initialization has completed
 */
export function isAppInitialized(): boolean {
  return isInitialized;
} 
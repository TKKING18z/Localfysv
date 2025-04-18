import firebase from '../../firebase.config';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

/**
 * Image upload result object
 */
interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  localUri?: string;
  pendingId?: string;
}

/**
 * Pending upload item structure
 */
interface PendingUpload {
  id: string;
  uri: string;
  path: string;
  timestamp: number;
  metadata?: Record<string, any>;
  retryCount: number;
}

// Constants
const STORAGE_KEY = '@localfy_pending_uploads';
const MAX_RETRIES = 3;
const CACHE_DIR = `${FileSystem.cacheDirectory}cached_images/`;
const IMAGE_QUALITY = 0.7;  // Default quality for image compression

/**
 * Ensure the cache directory exists
 */
async function ensureCacheDirectory() {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/**
 * Compress an image to reduce file size
 * @param uri Source image URI
 * @param quality Compression quality (0-1)
 */
async function compressImage(uri: string, quality: number = IMAGE_QUALITY): Promise<string> {
  try {
    const manipResult = await manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: quality, format: SaveFormat.JPEG }
    );
    
    return manipResult.uri;
  } catch (error) {
    console.error('Image compression failed:', error);
    return uri; // Return original if compression fails
  }
}

/**
 * Cache an image locally for offline use
 * @param uri Source image URI
 */
async function cacheImageLocally(uri: string): Promise<string> {
  try {
    await ensureCacheDirectory();
    
    const fileExt = uri.split('.').pop() || 'jpg';
    const fileName = `${uuidv4()}.${fileExt}`;
    const destUri = `${CACHE_DIR}${fileName}`;
    
    await FileSystem.copyAsync({
      from: uri,
      to: destUri
    });
    
    return destUri;
  } catch (error) {
    console.error('Image caching failed:', error);
    return uri; // Return original if caching fails
  }
}

/**
 * Save pending upload to AsyncStorage
 * @param upload Pending upload item
 */
async function savePendingUpload(upload: PendingUpload): Promise<void> {
  try {
    const existingUploadsString = await AsyncStorage.getItem(STORAGE_KEY);
    const existingUploads = existingUploadsString ? JSON.parse(existingUploadsString) : [];
    
    existingUploads.push(upload);
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existingUploads));
  } catch (error) {
    console.error('Failed to save pending upload:', error);
  }
}

/**
 * Remove a pending upload from AsyncStorage
 * @param id Upload ID to remove
 */
async function removePendingUpload(id: string): Promise<void> {
  try {
    const existingUploadsString = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existingUploadsString) return;
    
    const existingUploads = JSON.parse(existingUploadsString);
    const updatedUploads = existingUploads.filter((upload: PendingUpload) => upload.id !== id);
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUploads));
  } catch (error) {
    console.error('Failed to remove pending upload:', error);
  }
}

/**
 * Update retry count for a pending upload
 * @param id Upload ID
 */
async function updateRetryCount(id: string): Promise<void> {
  try {
    const existingUploadsString = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existingUploadsString) return;
    
    const existingUploads = JSON.parse(existingUploadsString);
    const updatedUploads = existingUploads.map((upload: PendingUpload) => {
      if (upload.id === id) {
        return { ...upload, retryCount: upload.retryCount + 1 };
      }
      return upload;
    });
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUploads));
  } catch (error) {
    console.error('Failed to update retry count:', error);
  }
}

/**
 * Upload an image to Firebase Storage
 * @param uri Local URI of the image
 * @param path Firebase Storage path
 * @param metadata Additional metadata for the upload
 */
async function uploadToFirebase(uri: string, path: string, metadata?: Record<string, any>): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  
  const storageRef = firebase.storage().ref().child(path);
  await storageRef.put(blob, metadata);
  
  return await storageRef.getDownloadURL();
}

/**
 * Upload image with offline support
 * @param uri Image URI to upload
 * @param path Firebase storage path
 * @param options Additional options
 */
export async function uploadImage(
  uri: string, 
  path: string, 
  options: { 
    quality?: number; 
    metadata?: Record<string, any>;
    urgent?: boolean;
  } = {}
): Promise<ImageUploadResult> {
  const { quality = IMAGE_QUALITY, metadata = {}, urgent = false } = options;
  
  try {
    // Check network connection
    const networkState = await NetInfo.fetch();
    const isConnected = networkState.isConnected && networkState.isInternetReachable;
    
    // Compress image
    const compressedUri = await compressImage(uri, quality);
    
    // Cache locally for offline access
    const cachedUri = await cacheImageLocally(compressedUri);
    
    // If offline or not urgent, save for later upload
    if (!isConnected || !urgent) {
      const pendingId = uuidv4();
      const pendingUpload: PendingUpload = {
        id: pendingId,
        uri: cachedUri,
        path,
        timestamp: Date.now(),
        metadata,
        retryCount: 0
      };
      
      await savePendingUpload(pendingUpload);
      
      // If offline, return local URI for now
      if (!isConnected) {
        return {
          success: true,
          localUri: cachedUri,
          pendingId,
          error: 'offline'
        };
      }
    }
    
    // Upload to Firebase if connected
    const url = await uploadToFirebase(compressedUri, path, metadata);
    
    return { success: true, url };
  } catch (error: any) {
    console.error('Image upload failed:', error);
    return { 
      success: false, 
      error: error.message || 'Image upload failed',
      localUri: uri
    };
  }
}

/**
 * Retry uploading a specific pending image
 * @param pendingId ID of the pending upload
 */
export async function retryPendingUpload(pendingId: string): Promise<ImageUploadResult> {
  try {
    const existingUploadsString = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existingUploadsString) {
      return { success: false, error: 'No pending uploads found' };
    }
    
    const existingUploads = JSON.parse(existingUploadsString);
    const pendingUpload = existingUploads.find((upload: PendingUpload) => upload.id === pendingId);
    
    if (!pendingUpload) {
      return { success: false, error: 'Pending upload not found' };
    }
    
    // Check if max retries reached
    if (pendingUpload.retryCount >= MAX_RETRIES) {
      return { success: false, error: 'Max retries reached' };
    }
    
    // Update retry count
    await updateRetryCount(pendingId);
    
    // Attempt upload
    const url = await uploadToFirebase(pendingUpload.uri, pendingUpload.path, pendingUpload.metadata);
    
    // On success, remove from pending uploads
    await removePendingUpload(pendingId);
    
    return { success: true, url };
  } catch (error: any) {
    console.error('Retry upload failed:', error);
    return { success: false, error: error.message || 'Retry upload failed' };
  }
}

/**
 * Process all pending uploads
 * @returns Results of all upload attempts
 */
export async function processPendingUploads(): Promise<ImageUploadResult[]> {
  try {
    // Check network connection first
    const networkState = await NetInfo.fetch();
    const isConnected = networkState.isConnected && networkState.isInternetReachable;
    
    if (!isConnected) {
      return [{ success: false, error: 'No internet connection' }];
    }
    
    const existingUploadsString = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existingUploadsString) {
      return [];
    }
    
    const pendingUploads: PendingUpload[] = JSON.parse(existingUploadsString);
    const results: ImageUploadResult[] = [];
    
    // Process each pending upload
    for (const upload of pendingUploads) {
      try {
        // Skip uploads that have reached max retries
        if (upload.retryCount >= MAX_RETRIES) {
          results.push({
            success: false,
            error: 'Max retries reached',
            pendingId: upload.id
          });
          continue;
        }
        
        // Try to upload
        const url = await uploadToFirebase(upload.uri, upload.path, upload.metadata);
        
        // On success, remove from pending uploads
        await removePendingUpload(upload.id);
        
        results.push({
          success: true,
          url,
          pendingId: upload.id
        });
      } catch (error: any) {
        // Update retry count and report failure
        await updateRetryCount(upload.id);
        
        results.push({
          success: false,
          error: error.message || 'Upload failed',
          pendingId: upload.id,
          localUri: upload.uri
        });
      }
    }
    
    return results;
  } catch (error: any) {
    console.error('Processing pending uploads failed:', error);
    return [{ success: false, error: error.message || 'Processing pending uploads failed' }];
  }
}

/**
 * Get all pending uploads
 */
export async function getPendingUploads(): Promise<PendingUpload[]> {
  try {
    const existingUploadsString = await AsyncStorage.getItem(STORAGE_KEY);
    return existingUploadsString ? JSON.parse(existingUploadsString) : [];
  } catch (error: any) {
    console.error('Failed to get pending uploads:', error);
    return [];
  }
}

/**
 * Clear pending uploads older than specified days
 * @param days Number of days
 */
export async function clearOldPendingUploads(days: number = 7): Promise<void> {
  try {
    const existingUploadsString = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existingUploadsString) return;
    
    const existingUploads = JSON.parse(existingUploadsString);
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000; // days to milliseconds
    
    const updatedUploads = existingUploads.filter(
      (upload: PendingUpload) => now - upload.timestamp < maxAge
    );
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUploads));
  } catch (error: any) {
    console.error('Failed to clear old pending uploads:', error);
  }
} 
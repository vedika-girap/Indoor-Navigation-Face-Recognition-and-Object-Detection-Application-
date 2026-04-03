/**
 * Floor Map Management Service for Expo
 * 
 * WhatsApp-Style Architecture:
 * - Actual image files stored on device using expo-file-system
 * - Only metadata synced with backend server
 * - Works offline once maps are downloaded
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { API_ENDPOINTS } from '../config/api';

// Directory for storing floor maps in Expo app
const BASE_DIR = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
const FLOOR_MAPS_DIR = `${BASE_DIR}floor_maps/`;

export interface FloorMap {
  map_id: string;
  map_name: string;
  building_name?: string;
  floor_number?: string;
  local_uri: string;
  metadata?: {
    width?: number;
    height?: number;
    file_size?: number;
    added_at?: string;
    // Processed map metadata
    is_processed?: boolean;
    original_map_id?: string;  // Links processed map to original
    labels?: any[];            // Detected room labels
    processed_at?: string;
    [key: string]: any;
  };
  added_at: string;
  last_accessed?: string;
  is_active: boolean;
  // New fields for processed maps
  is_processed?: boolean;
  original_map_id?: string;
  processed_maps?: FloorMap[];  // List of processed versions
}

export interface FloorMapStats {
  total_maps: number;
  total_deleted: number;
  unique_buildings: number;
  unique_floors: number;
  buildings: string[];
  floors: string[];
}

/**
 * Initialize floor maps directory
 */
async function ensureDirectoryExists(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(FLOOR_MAPS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FLOOR_MAPS_DIR, { intermediates: true });
    console.log('✅ Floor maps directory created:', FLOOR_MAPS_DIR);
  }
}

/**
 * Add a new floor map
 * 1. Let user pick an image
 * 2. Copy to app's permanent storage
 * 3. Register metadata with backend
 */
export async function addFloorMap(
  userId: string,
  mapName: string,
  buildingName?: string,
  floorNumber?: string
): Promise<FloorMap | null> {
  try {
    // Ensure directory exists
    await ensureDirectoryExists();

    // 1. Pick image from device
    console.log('📂 Opening document picker...');
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: false,
    });

    if (result.canceled) {
      console.log('User cancelled map selection');
      return null;
    }

    const pickedFile = result.assets[0];
    console.log('📷 File picked:', pickedFile.name);

    // 2. Copy to permanent storage
    const timestamp = Date.now();
    const fileName = `map_${timestamp}.png`;
    const destPath = `${FLOOR_MAPS_DIR}${fileName}`;

    console.log('💾 Copying file to:', destPath);
    await FileSystem.copyAsync({
      from: pickedFile.uri,
      to: destPath,
    });

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(destPath);
    const fileSize = fileInfo.exists && !fileInfo.isDirectory ? fileInfo.size : 0;
    console.log('✅ File saved successfully. Size:', fileSize);

    // 3. Register with backend
    const mapId = `map_${timestamp}`;
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('map_id', mapId);
    formData.append('map_name', mapName);
    if (buildingName) formData.append('building_name', buildingName);
    if (floorNumber) formData.append('floor_number', floorNumber);
    formData.append('local_uri', destPath);
    formData.append(
      'metadata',
      JSON.stringify({
        original_name: pickedFile.name,
        file_size: fileSize,
        added_at: new Date().toISOString(),
      })
    );

    console.log('☁️ Syncing metadata to server...');
    const response = await fetch(API_ENDPOINTS.addFloorMap, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Floor map added successfully!');
      return data.map;
    } else {
      throw new Error(data.message || 'Failed to add floor map');
    }
  } catch (error) {
    console.error('❌ Error adding floor map:', error);
    Alert.alert('Error', `Failed to add floor map: ${error}`);
    return null;
  }
}

/**
 * List all floor maps for a user
 */
export async function listFloorMaps(userId: string): Promise<FloorMap[]> {
  try {
    console.log('📋 Fetching floor maps for user:', userId);
    const response = await fetch(API_ENDPOINTS.listFloorMaps(userId));
    const data = await response.json();

    if (data.success) {
      console.log(`✅ Found ${data.maps.length} floor maps`);
      return data.maps;
    } else {
      throw new Error(data.message || 'Failed to list floor maps');
    }
  } catch (error) {
    console.error('❌ Error listing floor maps:', error);
    return [];
  }
}

/**
 * Get a specific floor map
 */
export async function getFloorMap(
  userId: string,
  mapId: string
): Promise<FloorMap | null> {
  try {
    console.log('🔍 Fetching floor map:', mapId);
    const response = await fetch(API_ENDPOINTS.getFloorMap(userId, mapId));
    const data = await response.json();

    if (data.success) {
      // Verify local file exists
      const fileInfo = await FileSystem.getInfoAsync(data.map.local_uri);
      if (!fileInfo.exists) {
        console.warn('⚠️ Map metadata exists but local file is missing');
        Alert.alert(
          'Map File Missing',
          'The map file is not on this device. Would you like to remove it from your list?',
          [
            { text: 'Keep in List', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => deleteFloorMap(userId, mapId, false),
            },
          ]
        );
        return null;
      }

      console.log('✅ Floor map loaded successfully');
      return data.map;
    } else {
      throw new Error(data.message || 'Floor map not found');
    }
  } catch (error) {
    console.error('❌ Error getting floor map:', error);
    return null;
  }
}

// Default export placeholder so Expo Router won't treat this service file as a screen route
export default function FloorMapServicePlaceholder(): null {
  return null;
}

/**
 * Update floor map metadata (name, building, floor)
 */
export async function updateFloorMapMetadata(
  userId: string,
  mapId: string,
  updates: {
    map_name?: string;
    building_name?: string;
    floor_number?: string;
    metadata?: Record<string, any>;
  }
): Promise<boolean> {
  try {
    const formData = new FormData();
    if (updates.map_name) formData.append('map_name', updates.map_name);
    if (updates.building_name) formData.append('building_name', updates.building_name);
    if (updates.floor_number) formData.append('floor_number', updates.floor_number);
    if (updates.metadata) formData.append('metadata', JSON.stringify(updates.metadata));

    console.log('🔄 Updating floor map metadata...');
    const response = await fetch(
      API_ENDPOINTS.updateFloorMapMetadata(userId, mapId),
      { method: 'POST', body: formData }
    );

    const data = await response.json();

    if (data.success) {
      console.log('✅ Metadata updated successfully');
      return true;
    } else {
      throw new Error(data.message || 'Failed to update metadata');
    }
  } catch (error) {
    console.error('❌ Error updating metadata:', error);
    Alert.alert('Error', `Failed to update map: ${error}`);
    return false;
  }
}

/**
 * Process a floor map through the backend
 * Sends the local image file to backend for processing (convert to B&W, detect rooms, label)
 * Returns processed image as base64 and detected regions
 */
export async function processFloorMap(
  userId: string,
  map: FloorMap
): Promise<{
  success: boolean;
  processed_image_base64?: string;
  labels?: Array<{ label: string; bbox: number[]; area: number }>;
  original_size?: { width: number; height: number };
  message?: string;
} | null> {
  try {
    console.log('🔄 Processing floor map:', map.map_name);

    // Verify local file exists
    const fileInfo = await FileSystem.getInfoAsync(map.local_uri);
    if (!fileInfo.exists) {
      throw new Error('Local floor map file not found on device');
    }

    console.log('📤 Uploading map to backend for processing...');
    
    // Create form data with the local file
    const formData = new FormData();
    const fileName = map.local_uri.split('/').pop() || `${map.map_id}.png`;
    
    // @ts-ignore - React Native FormData file
    formData.append('file', {
      uri: map.local_uri,
      name: fileName,
      type: 'image/png',
    });
    formData.append('user_id', userId);
    formData.append('map_id', map.map_id);

    const response = await fetch(API_ENDPOINTS.processFloorMap, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Floor map processed successfully!');
      console.log(`   Detected ${data.labels?.length || 0} regions`);
      return data;
    } else {
      throw new Error(data.message || 'Processing failed');
    }
  } catch (error) {
    console.error('❌ Error processing floor map:', error);
    Alert.alert('Processing Error', `Failed to process map: ${error}`);
    return null;
  }
}

/**
 * Delete floor map
 * @param permanent - If true, deletes from server and device. If false, only soft delete.
 */
export async function deleteFloorMap(
  userId: string,
  mapId: string,
  permanent: boolean = false
): Promise<boolean> {
  try {
    if (permanent) {
      // Get map info to find local file
      const map = await getFloorMap(userId, mapId);
      if (!map) {
        throw new Error('Floor map not found');
      }

      // Delete from server
      console.log('🗑️ Permanently deleting from server...');
      const response = await fetch(
        API_ENDPOINTS.deleteFloorMapPermanent(userId, mapId),
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        // Delete local file
        console.log('🗑️ Deleting local file...');
        const fileInfo = await FileSystem.getInfoAsync(map.local_uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(map.local_uri);
          console.log('✅ Local file deleted');
        }

        console.log('✅ Floor map completely deleted');
        return true;
      } else {
        throw new Error(data.message || 'Failed to delete from server');
      }
    } else {
      // Soft delete (mark as inactive)
      console.log('🗑️ Soft deleting floor map...');
      const response = await fetch(
        API_ENDPOINTS.deleteFloorMap(userId, mapId),
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        console.log('✅ Floor map marked as inactive');
        return true;
      } else {
        throw new Error(data.message || 'Failed to delete');
      }
    }
  } catch (error) {
    console.error('❌ Error deleting floor map:', error);
    Alert.alert('Error', `Failed to delete map: ${error}`);
    return false;
  }
}

/**
 * Get statistics about user's floor maps
 */
export async function getFloorMapStats(userId: string): Promise<FloorMapStats | null> {
  try {
    console.log('📊 Fetching floor map statistics...');
    const response = await fetch(API_ENDPOINTS.getFloorMapStats(userId));
    const data = await response.json();

    if (data.success) {
      console.log('✅ Stats retrieved:', data.stats);
      return data.stats;
    } else {
      throw new Error(data.message || 'Failed to get stats');
    }
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    return null;
  }
}

/**
 * Check if a local map file exists
 */
export async function checkMapFileExists(localUri: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    return fileInfo.exists;
  } catch {
    return false;
  }
}

/**
 * Clean up orphaned local files (files without metadata)
 */
export async function cleanupOrphanedFiles(userId: string): Promise<number> {
  try {
    console.log('🧹 Cleaning up orphaned files...');

    // Get all maps from server
    const maps = await listFloorMaps(userId);
    const validUris = new Set(maps.map((m) => m.local_uri));

    // List all local files
    const dirInfo = await FileSystem.getInfoAsync(FLOOR_MAPS_DIR);
    if (!dirInfo.exists) {
      return 0;
    }

    const localFiles = await FileSystem.readDirectoryAsync(FLOOR_MAPS_DIR);
    let deletedCount = 0;

    for (const fileName of localFiles) {
      const filePath = `${FLOOR_MAPS_DIR}${fileName}`;
      if (!validUris.has(filePath)) {
        await FileSystem.deleteAsync(filePath);
        deletedCount++;
        console.log('🗑️ Deleted orphaned file:', fileName);
      }
    }

    console.log(`✅ Cleanup complete. Deleted ${deletedCount} orphaned files`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    return 0;
  }
}

/**
 * Get all processed maps for a specific original map
 */
export async function getProcessedMapsFor(
  userId: string,
  originalMapId: string
): Promise<FloorMap[]> {
  try {
    console.log('🔍 Fetching processed maps for original:', originalMapId);
    const allMaps = await listFloorMaps(userId);
    
    // Filter for processed maps that link to this original
    const processedMaps = allMaps.filter(
      (map) => map.metadata?.original_map_id === originalMapId && map.metadata?.is_processed
    );
    
    console.log(`✅ Found ${processedMaps.length} processed maps`);
    return processedMaps;
  } catch (error) {
    console.error('❌ Error fetching processed maps:', error);
    return [];
  }
}

/**
 * Get maps with their processed versions attached
 */
export async function listMapsWithProcessed(userId: string): Promise<FloorMap[]> {
  try {
    const allMaps = await listFloorMaps(userId);
    
    // Separate original and processed maps
    const originalMaps = allMaps.filter((map) => !map.metadata?.is_processed);
    const processedMaps = allMaps.filter((map) => map.metadata?.is_processed);
    
    // Attach processed maps to their originals
    const mapsWithProcessed = originalMaps.map((original) => {
      const processed = processedMaps.filter(
        (p) => p.metadata?.original_map_id === original.map_id
      );
      return {
        ...original,
        processed_maps: processed,
      };
    });
    
    console.log(`✅ Loaded ${mapsWithProcessed.length} maps with processed versions`);
    return mapsWithProcessed;
  } catch (error) {
    console.error('❌ Error loading maps with processed:', error);
    return [];
  }
}

/**
 * Export floor maps for backup
 */
export async function exportFloorMaps(userId: string): Promise<string | null> {
  try {
    const maps = await listFloorMaps(userId);
    const exportData = {
      user_id: userId,
      exported_at: new Date().toISOString(),
      maps: maps,
    };

    const CACHE_DIR = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? '';
    const exportPath = `${CACHE_DIR}floor_maps_backup_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(exportPath, JSON.stringify(exportData, null, 2));

    console.log('✅ Floor maps exported to:', exportPath);
    return exportPath;
  } catch (error) {
    console.error('❌ Error exporting floor maps:', error);
    return null;
  }
}

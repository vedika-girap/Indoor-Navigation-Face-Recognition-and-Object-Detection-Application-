/**
 * Simple file-backed AsyncStorage replacement using expo-file-system.
 * Works on Android (and iOS) without native @react-native-async-storage dependency.
 *
 * Note: uses require inside functions to avoid import ordering/duplication issues.
 */

const STORAGE_FILENAME = 'async_storage.json';

async function getStoragePath() {
    const FileSystem = require('expo-file-system');
    return `${FileSystem.documentDirectory}${STORAGE_FILENAME}`;
}

async function readStore(): Promise<Record<string, string>> {
    try {
        const FileSystem = require('expo-file-system');
        const path = await getStoragePath();
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return {};
        const content = await FileSystem.readAsStringAsync(path);
        return content ? JSON.parse(content) : {};
    } catch (e) {
        console.warn('AsyncStorage(read) error', e);
        return {};
    }
}

async function writeStore(store: Record<string, string>) {
    try {
        const FileSystem = require('expo-file-system');
        const path = await getStoragePath();
        await FileSystem.writeAsStringAsync(path, JSON.stringify(store));
    } catch (e) {
        console.warn('AsyncStorage(write) error', e);
    }
}

const AsyncStorage = {
    async getItem(key: string): Promise<string | null> {
        const store = await readStore();
        return store.hasOwnProperty(key) ? store[key] : null;
    },

    async setItem(key: string, value: string): Promise<void> {
        const store = await readStore();
        store[key] = value;
        await writeStore(store);
    },

    async removeItem(key: string): Promise<void> {
        const store = await readStore();
        if (store.hasOwnProperty(key)) {
            delete store[key];
            await writeStore(store);
        }
    },

    async clear(): Promise<void> {
        try {
            const FileSystem = require('expo-file-system');
            const path = await getStoragePath();
            const info = await FileSystem.getInfoAsync(path);
            if (info.exists) await FileSystem.deleteAsync(path);
        } catch (e) {
            console.warn('AsyncStorage(clear) error', e);
        }
    },
};

export default AsyncStorage;
import * as FileSystem from 'expo-file-system';

const CACHE_KEY = 'cached_waypoints';
const MAX_CACHED_PATHS = 3;

export const OfflineNavigationService = {
  async cacheWaypoints(mapId: string, waypoints: any[]) {
    try {
  const cacheDir = `${(FileSystem as any).documentDirectory}offline_cache/${mapId}/`;
  await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });

      for (const waypoint of waypoints) {
        if (!waypoint.image_uri) continue;
        const localPath = `${cacheDir}${waypoint.waypoint_id}.jpg`;
        try {
          await FileSystem.downloadAsync(waypoint.image_uri, localPath);
          waypoint.cached_image_uri = localPath;
        } catch (e) {
          console.warn('Failed to cache image', waypoint.image_uri, e);
        }
      }

      const cached = await this.getCachedPaths();
      cached[mapId] = { waypoints, timestamp: Date.now() };

      // Keep only last MAX_CACHED_PATHS
      const entries = Object.entries(cached)
        .sort((a: any, b: any) => b[1].timestamp - a[1].timestamp)
        .slice(0, MAX_CACHED_PATHS);

      const trimmed = Object.fromEntries(entries);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Cache error:', error);
    }
  },

  async getCachedWaypoints(mapId: string) {
    const cached = await this.getCachedPaths();
    return cached[mapId]?.waypoints || null;
  },

  async matchPositionOffline(currentImageBase64: string, mapId: string) {
    const waypoints = await this.getCachedWaypoints(mapId);
    if (!waypoints) return null;

    let bestMatch = null;
    let highestSimilarity = 0;

    for (const waypoint of waypoints) {
      if (!waypoint.cached_image_uri) continue;
  try {
  const cachedImage = await FileSystem.readAsStringAsync(waypoint.cached_image_uri, { encoding: (FileSystem as any).EncodingType?.Base64 || 'base64' });
        const similarity = this.compareImages(currentImageBase64, cachedImage);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = waypoint;
        }
      } catch (e) {
        console.warn('Failed to read cached image', e);
      }
    }

    return {
      waypoint: bestMatch,
      confidence: highestSimilarity,
      offline: true,
    };
  },

  compareImages(img1Base64: string, img2Base64: string): number {
    // Simple placeholder comparison: compare length similarity
    const size1 = img1Base64?.length || 0;
    const size2 = img2Base64?.length || 0;
    if (Math.max(size1, size2) === 0) return 0;
    const diff = Math.abs(size1 - size2);
    return Math.max(0, 1 - diff / Math.max(size1, size2));
  },

  async getCachedPaths() {
    const data = await AsyncStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : {};
  },
};

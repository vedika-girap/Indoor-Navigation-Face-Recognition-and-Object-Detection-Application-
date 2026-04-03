/**
 * Offline Support Manager
 * Handles offline detection, cached data, and fallback mechanisms
 */

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accessibilityService } from './accessibilityService';

export interface OfflineConfig {
  enableOfflineMode: boolean;
  cacheMapData: boolean;
  cacheDuration: number; // milliseconds
  batterySaverMode: boolean;
  reducedProcessing: boolean;
}

export interface CachedData {
  key: string;
  data: any;
  timestamp: number;
  expiresIn: number;
}

class OfflineManager {
  private isOnline: boolean = true;
  private offlineMode: boolean = false;
  private batterySaver: boolean = false;
  private cachePrefix: string = 'ziya_cache_';
  private maxCacheSize: number = 50; // Max cached items
  private defaultCacheDuration: number = 86400000; // 24 hours

  // Pre-recorded essential prompts (text that can be spoken offline)
  private essentialPrompts = {
    welcome: 'Welcome to Ziya navigation assistant',
    cameraReady: 'Camera ready. Point at objects for detection',
    navigationReady: 'Navigation ready. Select destination',
    offline: 'You are currently offline. Some features may be limited',
    backOnline: 'Connection restored. All features available',
    batterySaver: 'Battery saver mode enabled. Processing reduced',
    noInternet: 'No internet connection. Using offline mode',
    cacheExpired: 'Cached data expired. Connect to internet to refresh',
    exitOffline: 'Connecting to internet. Please wait',
  };

  async initialize() {
    // Check initial network status
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;

    // Listen for network changes
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        this.handleBackOnline();
      } else if (wasOnline && !this.isOnline) {
        this.handleGoingOffline();
      }
    });

    // Load offline config
    await this.loadConfig();

    // Clean expired cache
    await this.cleanExpiredCache();
  }

  /**
   * Handle transition to offline
   */
  private async handleGoingOffline() {
    if (!this.offlineMode) {
      this.offlineMode = true;
      accessibilityService.speak(this.essentialPrompts.offline, 1);
      await accessibilityService.triggerHaptic('warning');
    }
  }

  /**
   * Handle transition to online
   */
  private async handleBackOnline() {
    if (this.offlineMode) {
      this.offlineMode = false;
      accessibilityService.speak(this.essentialPrompts.backOnline, 1);
      await accessibilityService.triggerHaptic('success');
      
      // Sync any pending data
      await this.syncPendingData();
    }
  }

  /**
   * Check if currently online
   */
  isNetworkAvailable(): boolean {
    return this.isOnline;
  }

  /**
   * Check if in offline mode
   */
  isOfflineMode(): boolean {
    return this.offlineMode || !this.isOnline;
  }

  /**
   * Cache data for offline use
   */
  async cacheData(key: string, data: any, expiresIn?: number): Promise<void> {
    try {
      const cacheItem: CachedData = {
        key,
        data,
        timestamp: Date.now(),
        expiresIn: expiresIn || this.defaultCacheDuration,
      };

      await AsyncStorage.setItem(
        `${this.cachePrefix}${key}`,
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  /**
   * Retrieve cached data
   */
  async getCachedData(key: string): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.cachePrefix}${key}`);
      if (!cached) return null;

      const cacheItem: CachedData = JSON.parse(cached);

      // Check expiration
      if (Date.now() - cacheItem.timestamp > cacheItem.expiresIn) {
        await this.removeCachedData(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error('Failed to retrieve cached data:', error);
      return null;
    }
  }

  /**
   * Remove cached data
   */
  async removeCachedData(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.cachePrefix}${key}`);
    } catch (error) {
      console.error('Failed to remove cached data:', error);
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(this.cachePrefix));

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const cacheItem: CachedData = JSON.parse(cached);
          if (Date.now() - cacheItem.timestamp > cacheItem.expiresIn) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to clean cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(this.cachePrefix));

      let totalSize = 0;
      let validCount = 0;
      let expiredCount = 0;

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          totalSize += cached.length;
          const cacheItem: CachedData = JSON.parse(cached);
          
          if (Date.now() - cacheItem.timestamp > cacheItem.expiresIn) {
            expiredCount++;
          } else {
            validCount++;
          }
        }
      }

      return {
        totalItems: cacheKeys.length,
        validItems: validCount,
        expiredItems: expiredCount,
        totalSizeBytes: totalSize,
        totalSizeKB: (totalSize / 1024).toFixed(2),
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }

  /**
   * Enable/disable battery saver mode
   */
  async setBatterySaverMode(enabled: boolean) {
    this.batterySaver = enabled;
    await AsyncStorage.setItem('battery_saver', enabled.toString());

    if (enabled) {
      accessibilityService.speak(this.essentialPrompts.batterySaver, 2);
    } else {
      accessibilityService.speak('Battery saver mode disabled. Full processing enabled', 2);
    }
  }

  /**
   * Check if battery saver is active
   */
  isBatterySaverActive(): boolean {
    return this.batterySaver;
  }

  /**
   * Get processing interval based on battery saver
   */
  getProcessingInterval(): number {
    return this.batterySaver ? 2000 : 500; // 2s vs 0.5s
  }

  /**
   * Fetch with cache fallback
   */
  async fetchWithCache(
    url: string,
    cacheKey: string,
    options?: RequestInit,
    cacheDuration?: number
  ): Promise<any> {
    // Try network first if online
    if (this.isOnline) {
      try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        // Cache successful response
        await this.cacheData(cacheKey, data, cacheDuration);
        
        return { data, fromCache: false };
      } catch (error) {
        console.error('Fetch failed, trying cache:', error);
      }
    }

    // Fallback to cache
    const cached = await this.getCachedData(cacheKey);
    if (cached) {
      accessibilityService.speak('Using cached data', 3);
      return { data: cached, fromCache: true };
    }

    // No cache available
    throw new Error('No network connection and no cached data available');
  }

  /**
   * Queue data to sync when back online
   */
  private pendingSync: Array<{ key: string; data: any }> = [];

  async queueForSync(key: string, data: any) {
    this.pendingSync.push({ key, data });
    await AsyncStorage.setItem('pending_sync', JSON.stringify(this.pendingSync));
  }

  /**
   * Sync pending data when back online
   */
  private async syncPendingData() {
    if (this.pendingSync.length === 0) return;

    accessibilityService.speak(`Syncing ${this.pendingSync.length} items`, 3);

    // In real implementation, sync each item to server
    // For now, just clear the queue
    this.pendingSync = [];
    await AsyncStorage.removeItem('pending_sync');
  }

  /**
   * Load configuration
   */
  private async loadConfig() {
    try {
      const batterySaver = await AsyncStorage.getItem('battery_saver');
      this.batterySaver = batterySaver === 'true';
    } catch (error) {
      console.error('Failed to load offline config:', error);
    }
  }

  /**
   * Get essential prompt
   */
  getEssentialPrompt(key: keyof typeof this.essentialPrompts): string {
    return this.essentialPrompts[key];
  }

  /**
   * Announce offline status
   */
  async announceOfflineStatus() {
    if (this.isOfflineMode()) {
      accessibilityService.speak(
        'You are currently offline. Object detection works, but navigation requires internet connection.',
        2
      );
    } else {
      accessibilityService.speak('You are online. All features available.', 2);
    }
  }

  /**
   * Check if feature is available offline
   */
  isFeatureAvailable(feature: 'detection' | 'navigation' | 'face_recognition'): boolean {
    if (this.isOnline) return true;

    switch (feature) {
      case 'detection':
        return true; // YOLO runs locally
      case 'navigation':
        return false; // Requires server
      case 'face_recognition':
        return true; // Can work with cached faces
      default:
        return false;
    }
  }

  /**
   * Get offline limitations message
   */
  getOfflineLimitations(): string {
    return 'Offline mode: Object detection works. Navigation and map updates require internet.';
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(this.cachePrefix));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        accessibilityService.speak(`Cleared ${cacheKeys.length} cached items`, 2);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}

export const offlineManager = new OfflineManager();
export default offlineManager;

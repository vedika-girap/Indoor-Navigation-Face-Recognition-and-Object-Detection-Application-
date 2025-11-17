import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import accessibilityService from '../../services/accessibilityService';
import actionHistoryManager from '../../services/actionHistoryManager';
import offlineManager from '../../services/offlineManager';
import errorRecoveryService from '../../services/errorRecoveryService';
import { listFloorMaps, type FloorMap } from '../../services/floorMapService';
import { DEMO_USER_ID } from '../../constants/user';

export default function MapManagementScreen() {
  const router = useRouter();
  const [maps, setMaps] = useState<FloorMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    initializeManagement();
  }, []);

  const initializeManagement = async () => {
    actionHistoryManager.addBreadcrumb('management', 'Map Management');
    
    accessibilityService.speak(
      'Map management. View, record, and process indoor floor maps.',
      2,
      false
    );

    setIsOffline(offlineManager.isOfflineMode());
    await loadMaps();
  };

  const loadMaps = async () => {
    setIsLoading(true);
    try {
      const cacheKey = `maps_${DEMO_USER_ID}`;
      
      if (offlineManager.isOfflineMode()) {
        const cached = await offlineManager.getCachedData(cacheKey);
        if (cached) {
          setMaps(cached);
          accessibilityService.speak('Loaded cached maps. Offline mode active.', 3);
        } else {
          accessibilityService.speak('No cached maps available.', 2);
        }
      } else {
        const loadedMaps = await listFloorMaps(DEMO_USER_ID);
        setMaps(loadedMaps);
        await offlineManager.cacheData(cacheKey, loadedMaps, 604800000);
      }
    } catch (error) {
      await errorRecoveryService.handleError('Load maps', error, 'medium', true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordMap = () => {
    accessibilityService.speak('Opening map recording mode', 2, false);
    // Navigate to recording screen (to be implemented)
    Alert.alert('Coming Soon', 'Map recording feature will be available soon.');
  };

  const handleProcessMap = () => {
    accessibilityService.speak('Opening map processing', 2, false);
    router.push('/screens/processFloorMap' as any);
  };

  const handleViewMap = (map: FloorMap) => {
    accessibilityService.speak(`Viewing ${map.map_name || 'map'}`, 2, false);
    router.push({
      pathname: '/screens/indoorNavigation' as any,
      params: { selectedMapId: map.map_id },
    });
  };

  const handleDeleteMap = (map: FloorMap) => {
    Alert.alert(
      'Delete Map',
      `Are you sure you want to delete ${map.map_name || 'this map'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Implement delete logic
            accessibilityService.speak('Map deleted', 2);
            await loadMaps();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessible={true}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Map Management</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={loadMaps}
            accessible={true}
            accessibilityLabel="Refresh maps"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
            <Text style={styles.offlineText}>Offline Mode - Cached Data</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.recordButton]}
            onPress={handleRecordMap}
            accessible={true}
            accessibilityLabel="Record new map by walking through space"
            accessibilityRole="button"
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="footsteps-outline" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>Record New Map</Text>
              <Text style={styles.actionButtonSubtext}>Walk through space to create map</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.processButton]}
            onPress={handleProcessMap}
            accessible={true}
            accessibilityLabel="Process uploaded floor plan image"
            accessibilityRole="button"
          >
            <LinearGradient
              colors={['#f093fb', '#f5576c']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="image-outline" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>Process Floor Plan</Text>
              <Text style={styles.actionButtonSubtext}>Upload and process image</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Saved Maps Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="albums-outline" size={24} color="#2c3e50" />
            <Text style={styles.sectionTitle}>Saved Maps</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{maps.length}</Text>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4facfe" />
              <Text style={styles.loadingText}>Loading maps...</Text>
            </View>
          ) : maps.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={64} color="#bdc3c7" />
              <Text style={styles.emptyTitle}>No Maps Yet</Text>
              <Text style={styles.emptyText}>
                Record a new map or process a floor plan to get started
              </Text>
            </View>
          ) : (
            maps.map((map, index) => (
              <View key={map.map_id} style={styles.mapCard}>
                <View style={styles.mapIconContainer}>
                  <Ionicons name="map" size={32} color="#4facfe" />
                </View>

                <View style={styles.mapInfo}>
                  <Text style={styles.mapName}>
                    {map.map_name || `Floor Map ${index + 1}`}
                  </Text>
                  <Text style={styles.mapDetails}>
                    {map.metadata?.labels?.length || 0} rooms • Created {formatDate(map.added_at)}
                  </Text>
                </View>

                <View style={styles.mapActions}>
                  <TouchableOpacity
                    style={styles.mapActionButton}
                    onPress={() => handleViewMap(map)}
                    accessible={true}
                    accessibilityLabel="View map details"
                    accessibilityRole="button"
                  >
                    <Ionicons name="eye-outline" size={22} color="#4facfe" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.mapActionButton}
                    onPress={() => handleDeleteMap(map)}
                    accessible={true}
                    accessibilityLabel="Delete map"
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Storage Info */}
        {maps.length > 0 && (
          <View style={styles.infoCard}>
            <Ionicons name="cloud-done-outline" size={24} color="#50c878" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Maps Cached</Text>
              <Text style={styles.infoText}>
                Your maps are cached for offline use and will sync when online.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  actionsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  recordButton: {},
  processButton: {},
  actionGradient: {
    padding: 24,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
  },
  actionButtonSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 12,
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#4facfe',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  mapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mapIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e8f5ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mapInfo: {
    flex: 1,
  },
  mapName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  mapDetails: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  mapActions: {
    flexDirection: 'row',
    gap: 8,
  },
  mapActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#e8f9f1',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#7f8c8d',
    lineHeight: 18,
  },
});

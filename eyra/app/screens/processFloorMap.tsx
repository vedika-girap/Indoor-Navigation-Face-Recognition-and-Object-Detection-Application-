import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, StatusBar, Platform, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { listMapsWithProcessed, FloorMap, processFloorMap, getProcessedMapsFor } from '../services/floorMapService';
import { DEMO_USER_ID } from '../constants/user';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

export default function ProcessFloorMapScreen() {
  const [maps, setMaps] = useState<FloorMap[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Use consistent user ID across the app
  const userId = DEMO_USER_ID;

  useEffect(() => {
    const initScreen = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Speech.speak(
        'Process floor map screen. Select a map to process for indoor navigation. Swipe to browse available maps.',
        { rate: 0.9 }
      );
    };
    initScreen();
    loadMaps();
    
    // Cleanup: Stop speech when leaving screen
    return () => {
      Speech.stop();
    };
  }, []);

  // Reload maps whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('ProcessFloorMap screen focused - reloading maps');
      loadMaps();
    }, [])
  );

  const loadMaps = async () => {
    setLoading(true);
    const m = await listMapsWithProcessed(userId);
    console.log('📋 ProcessFloorMap loaded', m.length, 'maps for user:', userId);
    
    // Only show original maps (not processed ones)
    const originalMaps = m.filter((map) => !map.metadata?.is_processed);
    setMaps(originalMaps);
    
    const count = originalMaps.length;
    const message = count === 0 ? 'No maps found to process.' : `${count} map${count === 1 ? '' : 's'} available.`;
    Speech.speak(message, { rate: 0.9 });
    
    setLoading(false);
  };

  const handleProcessMap = async (map: FloorMap) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Check if already has processed versions
    const processedCount = map.processed_maps?.length || 0;
    
    if (processedCount > 0) {
      Speech.speak(`${map.map_name} has ${processedCount} processed version${processedCount > 1 ? 's' : ''}.`, { rate: 0.9 });
      
      Alert.alert(
        'Processed Maps Available',
        `This map already has ${processedCount} processed version(s).\n\nWhat would you like to do?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => Speech.speak('Cancelled', { rate: 0.9 })
          },
          {
            text: 'View Processed',
            onPress: async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Speech.speak('Opening processed map', { rate: 0.9 });
              // Navigate to view the most recent processed map
              const latestProcessed = map.processed_maps![0];
              router.push({
                pathname: '/screens/processedMapViewer',
                params: {
                  processed: JSON.stringify({
                    success: true,
                    processed_image_base64: '', // Will load from file
                    labels: latestProcessed.metadata?.labels || [],
                    is_saved: true,
                    map_id: latestProcessed.map_id,
                    local_uri: latestProcessed.local_uri,
                  }),
                  original: JSON.stringify(map),
                },
              });
            },
          },
          {
            text: 'Process Again',
            onPress: async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Speech.speak('Processing map again', { rate: 0.9 });
              performProcessing(map);
            },
          },
        ]
      );
    } else {
      Speech.speak(`Processing ${map.map_name}. Please wait.`, { rate: 0.9 });
      performProcessing(map);
    }
  };

  const performProcessing = async (map: FloorMap) => {
    try {
      setLoading(true);

      // Use the floorMapService function to process the map
      const result = await processFloorMap(userId, map);
      setLoading(false);

      if (result && result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Speech.speak('Map processed successfully. Opening viewer.', { rate: 0.9 });
        // Navigate to processed viewer and pass data via query params
        router.push({
          pathname: '/screens/processedMapViewer',
          params: {
            processed: JSON.stringify(result),
            original: JSON.stringify(map),
          },
        });
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Speech.speak('Processing failed', { rate: 0.9 });
        Alert.alert('Processing failed', result?.message || 'Server returned error');
      }
    } catch (error) {
      setLoading(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Speech.speak('Error processing map', { rate: 0.9 });
      console.error('Processing error', error);
      Alert.alert('Error', `Failed to process map: ${error}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
          <Text style={styles.headerTitle}>Process Floor Map</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={['#f093fb', '#f5576c']}
            style={styles.loadingGradient}
          >
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Processing...</Text>
          </LinearGradient>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Modern Gradient Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Speech.stop();
              router.back();
            }}
            accessible={true}
            accessibilityLabel="Go back"
            accessibilityHint="Double tap to go back to previous screen"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Process Floor Map</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Speech.speak('Refreshing maps', { rate: 0.9 });
              loadMaps();
            }}
            disabled={loading}
            accessible={true}
            accessibilityLabel="Refresh map list"
            accessibilityHint="Double tap to reload all maps"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.headerSubtitle}>Select a map to process for navigation</Text>
      </LinearGradient>

      <FlatList
        data={maps}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.map_id}
        renderItem={({ item, index }) => {
          const processedCount = item.processed_maps?.length || 0;
          const mapLabel = `Map ${index + 1} of ${maps.length}. ${item.map_name}. ${processedCount > 0 ? processedCount + ' processed version' + (processedCount > 1 ? 's' : '') : 'Not yet processed'}.`;
          
          return (
            <TouchableOpacity 
              style={styles.mapCard} 
              onPress={() => handleProcessMap(item)}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel={mapLabel}
              accessibilityHint="Double tap to process this map"
              accessibilityRole="button"
            >
              <Image source={{ uri: item.local_uri }} style={styles.mapImage} />
              
              <View style={styles.mapInfo}>
                <Text style={styles.mapName}>{item.map_name}</Text>
                {(item.building_name || item.floor_number) && (
                  <Text style={styles.mapMeta}>
                    {item.building_name || ''} {item.floor_number ? `• Floor ${item.floor_number}` : ''}
                  </Text>
                )}
                
                {processedCount > 0 ? (
                  <LinearGradient
                    colors={['#50c878', '#3bb55f']}
                    style={styles.processedBadge}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.badgeText}>
                      {processedCount} processed
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.unprocessedBadge}>
                    <Ionicons name="alert-circle-outline" size={16} color="#ff9800" />
                    <Text style={styles.unprocessedText}>Not processed</Text>
                  </View>
                )}
              </View>
              
              <Ionicons name="chevron-forward" size={28} color="#bdc3c7" />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#4facfe', '#00f2fe']}
              style={styles.emptyCircle}
            >
              <Ionicons name="map-outline" size={64} color="#fff" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No Maps Found</Text>
            <Text style={styles.emptyText}>
              Add a floor map from the Indoor Navigation screen to get started
            </Text>
            <TouchableOpacity 
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Speech.stop();
                Speech.speak('Opening indoor navigation', { rate: 0.9 });
                router.push('/screens/indoorNavigation' as any);
              }}
              style={styles.emptyButtonWrapper}
              accessible={true}
              accessibilityLabel="Go to indoor navigation screen"
              accessibilityHint="Double tap to add new maps"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#f093fb', '#f5576c']}
                style={styles.emptyButton}
              >
                <Ionicons name="add-circle-outline" size={24} color="#fff" />
                <Text style={styles.emptyButtonText}>Go to Indoor Navigation</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

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
    marginBottom: 12,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingGradient: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    gap: 16,
    minWidth: 200,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  mapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    minHeight: 100,
  },
  mapImage: {
    width: 100,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: '#e0e0e0',
  },
  mapInfo: {
    flex: 1,
  },
  mapName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 6,
  },
  mapMeta: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  processedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  unprocessedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff3e0',
    alignSelf: 'flex-start',
    gap: 6,
  },
  unprocessedText: {
    color: '#ff9800',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButtonWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});

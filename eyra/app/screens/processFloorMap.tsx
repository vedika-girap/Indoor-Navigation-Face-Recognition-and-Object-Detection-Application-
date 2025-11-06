import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { listMapsWithProcessed, FloorMap, processFloorMap, getProcessedMapsFor } from '../services/floorMapService';
import { DEMO_USER_ID } from '../constants/user';

export default function ProcessFloorMapScreen() {
  const [maps, setMaps] = useState<FloorMap[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Use consistent user ID across the app
  const userId = DEMO_USER_ID;

  useEffect(() => {
    loadMaps();
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
    setLoading(false);
  };

  const handleProcessMap = async (map: FloorMap) => {
    // Check if already has processed versions
    const processedCount = map.processed_maps?.length || 0;
    
    if (processedCount > 0) {
      Alert.alert(
        'Processed Maps Available',
        `This map already has ${processedCount} processed version(s).\n\nWhat would you like to do?`,
        [
          {
            text: 'View Processed',
            onPress: () => {
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
            onPress: () => performProcessing(map),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
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
        // Navigate to processed viewer and pass data via query params
        router.push({
          pathname: '/screens/processedMapViewer',
          params: {
            processed: JSON.stringify(result),
            original: JSON.stringify(map),
          },
        });
      } else {
        Alert.alert('Processing failed', result?.message || 'Server returned error');
      }
    } catch (error) {
      setLoading(false);
      console.error('Processing error', error);
      Alert.alert('Error', `Failed to process map: ${error}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Processing / loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select a Floor Map to Process</Text>
        <TouchableOpacity 
          onPress={loadMaps} 
          style={styles.refreshButton}
          disabled={loading}
        >
          <Text style={styles.refreshText}>{loading ? '⟳' : '↻'} Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={maps}
        keyExtractor={(item) => item.map_id}
        renderItem={({ item }) => {
          const processedCount = item.processed_maps?.length || 0;
          return (
            <TouchableOpacity style={styles.item} onPress={() => handleProcessMap(item)}>
              <Image source={{ uri: item.local_uri }} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapName}>{item.map_name}</Text>
                <Text style={styles.meta}>
                  {item.building_name || ''} {item.floor_number ? `• ${item.floor_number}` : ''}
                </Text>
                {processedCount > 0 && (
                  <View style={styles.processedBadge}>
                    <Text style={styles.processedBadgeText}>
                      ✓ {processedCount} processed version{processedCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ textAlign: 'center', color: '#666', fontSize: 16 }}>No maps found</Text>
            <Text style={{ textAlign: 'center', color: '#999', fontSize: 14, marginTop: 8 }}>
              Add a floor map from the Indoor Navigation screen
            </Text>
            <TouchableOpacity 
              onPress={() => router.push('/screens/indoorNavigation' as any)}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>Go to Indoor Navigation</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  title: { fontSize: 18, fontWeight: '600' },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#A3D2CA',
    borderRadius: 16,
  },
  refreshText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  thumb: { width: 96, height: 72, borderRadius: 6, marginRight: 12, backgroundColor: '#ddd' },
  mapName: { fontSize: 16, fontWeight: '600' },
  meta: { color: '#666', marginTop: 4 },
  processedBadge: {
    backgroundColor: '#4BE6DA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  processedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  addButton: {
    marginTop: 20,
    backgroundColor: '#A3D2CA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

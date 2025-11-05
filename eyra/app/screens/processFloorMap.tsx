import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { listFloorMaps, FloorMap } from '../services/floorMapService';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 'http://10.84.28.100:8000';

export default function ProcessFloorMapScreen() {
  const [maps, setMaps] = useState<FloorMap[]>([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const userId = 'default_user';

  useEffect(() => {
    (async () => {
      setLoading(true);
      const m = await listFloorMaps(userId);
      setMaps(m);
      setLoading(false);
    })();
  }, []);

  const processMap = async (map: FloorMap) => {
    try {
      setLoading(true);

      // Read file info and create form data
      const uri = map.local_uri;
      const fileName = uri.split('/').pop() || `${map.map_id}.png`;

      const formData = new FormData();
      // @ts-ignore - React Native FormData file
      formData.append('file', {
        uri,
        name: fileName,
        type: 'image/png',
      });
      formData.append('user_id', userId);
      formData.append('map_id', map.map_id);

      const resp = await fetch(`${BACKEND_URL}/floor_maps/process`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await resp.json();
      setLoading(false);

      if (data.success) {
        // Navigate to processed viewer and pass data
        (navigation as any).navigate('ProcessedMapViewer', { processed: data, original: map });
      } else {
        Alert.alert('Processing failed', data.message || 'Server returned error');
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
      <Text style={styles.title}>Select a Floor Map to Process</Text>

      <FlatList
        data={maps}
        keyExtractor={(item) => item.map_id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => processMap(item)}>
            <Image source={{ uri: item.local_uri }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mapName}>{item.map_name}</Text>
              <Text style={styles.meta}>{item.building_name || ''} {item.floor_number ? `• ${item.floor_number}` : ''}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => <Text style={{ textAlign: 'center', marginTop: 20 }}>No maps found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  thumb: { width: 96, height: 72, borderRadius: 6, marginRight: 12, backgroundColor: '#ddd' },
  mapName: { fontSize: 16, fontWeight: '600' },
  meta: { color: '#666', marginTop: 4 }
});

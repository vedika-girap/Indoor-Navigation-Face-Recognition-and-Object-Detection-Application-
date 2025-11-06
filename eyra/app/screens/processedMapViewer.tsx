import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, Button, StyleSheet, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { addFloorMap } from '../services/floorMapService';
import { DEMO_USER_ID } from '../constants/user';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 'http://10.231.226.100:8000';

export default function ProcessedMapViewer() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const processed = params.processed ? JSON.parse(params.processed as string) : null;
  const original = params.original ? JSON.parse(params.original as string) : null;
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string>('');
  const userId = DEMO_USER_ID;

  useEffect(() => {
    console.log('ProcessedMapViewer - Processed data:', {
      is_saved: processed?.is_saved,
      has_base64: !!processed?.processed_image_base64,
      base64_length: processed?.processed_image_base64?.length || 0,
      has_local_uri: !!processed?.local_uri,
      local_uri: processed?.local_uri,
      labels_count: processed?.labels?.length || 0,
    });
    loadImage();
  }, []);

  const loadImage = async () => {
    if (processed.is_saved && processed.local_uri) {
      // Already saved, load from file
      console.log('Loading saved map from:', processed.local_uri);
      try {
        const fileInfo = await FileSystem.getInfoAsync(processed.local_uri);
        if (!fileInfo.exists) {
          console.error('File does not exist:', processed.local_uri);
          Alert.alert('Error', 'Saved map file not found on device. The file may have been deleted.');
          return;
        }
        
        const base64 = await FileSystem.readAsStringAsync(processed.local_uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log('Successfully loaded image, base64 length:', base64.length);
        setImageUri(`data:image/png;base64,${base64}`);
      } catch (error) {
        console.error('Error loading saved processed map:', error);
        Alert.alert('Error', `Failed to load saved map: ${error}`);
        // Fallback to base64 if available
        if (processed.processed_image_base64) {
          console.log('Falling back to base64 data');
          setImageUri(`data:image/png;base64,${processed.processed_image_base64}`);
        }
      }
    } else if (processed.processed_image_base64) {
      // New processed map
      console.log('Loading new processed map from base64, length:', processed.processed_image_base64.length);
      setImageUri(`data:image/png;base64,${processed.processed_image_base64}`);
    } else {
      console.error('No image data available - neither saved file nor base64');
    }
  };

  if (!processed) {
    return (
      <View style={styles.center}>
        <Text>No processed data provided</Text>
      </View>
    );
  }

  // For saved maps, we load from file. For new processed maps, we need base64
  const isSaved = processed.is_saved || false;
  const b64 = processed.processed_image_base64 as string;
  const labels = processed.labels || [];
  
  // Validate: Either must be saved (has local_uri) OR have base64 data
  if (!isSaved && !b64) {
    console.error('Missing processed_image_base64 in processed data');
    return (
      <View style={styles.center}>
        <Text>Error: Invalid processed map data (missing image)</Text>
        <Text style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
          The map must be either saved or have image data.
        </Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  const saveToDevice = async () => {
    try {
      setSaving(true);
      
      // Check if already saved
      if (isSaved) {
        Alert.alert('Already Saved', 'This processed map is already saved to your device.');
        setSaving(false);
        return;
      }
      
      // Validate base64 data for new maps
      if (!b64 || typeof b64 !== 'string') {
        throw new Error('Invalid image data: base64 string is missing or invalid');
      }

      console.log('Starting save process...');
      console.log('Base64 length:', b64.length);
      
      // Create a temporary file from base64
      const tempFileName = `temp_processed_${Date.now()}.png`;
      const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      
      if (!docDir) {
        throw new Error('No document directory available');
      }
      
      const tempPath = `${docDir}${tempFileName}`;
      console.log('Writing to temp path:', tempPath);
      
      // Write base64 to temp file
      await FileSystem.writeAsStringAsync(tempPath, b64, { 
        encoding: FileSystem.EncodingType.Base64 
      });
      
      console.log('Temp file written successfully');
      
      // Now copy this file to floor maps using addFloorMap
      // First, we need to copy it again as addFloorMap expects to pick a file
      const processedMapName = `${original?.map_name || 'Map'} (Processed)`;
      
      // Save directly to floor maps directory
      const FLOOR_MAPS_DIR = `${docDir}floor_maps/`;
      const dirInfo = await FileSystem.getInfoAsync(FLOOR_MAPS_DIR);
      if (!dirInfo.exists) {
        console.log('Creating floor maps directory...');
        await FileSystem.makeDirectoryAsync(FLOOR_MAPS_DIR, { intermediates: true });
      }
      
      const timestamp = Date.now();
      const fileName = `map_${timestamp}_processed.png`;
      const destPath = `${FLOOR_MAPS_DIR}${fileName}`;
      
      console.log('Copying to destination:', destPath);
      
      // Copy temp to permanent location
      await FileSystem.copyAsync({
        from: tempPath,
        to: destPath,
      });
      
      console.log('File copied successfully');
      
      // Register with backend
      const mapId = `map_${timestamp}`;
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('map_id', mapId);
      formData.append('map_name', processedMapName);
      formData.append('building_name', original?.building_name || '');
      formData.append('floor_number', original?.floor_number || '');
      formData.append('local_uri', destPath);
      formData.append(
        'metadata',
        JSON.stringify({
          original_map_id: original?.map_id,
          is_processed: true,
          labels: labels,
          processed_at: new Date().toISOString(),
        })
      );

      console.log('Saving to backend URL:', BACKEND_URL);
      const response = await fetch(`${BACKEND_URL}/floor_maps/add`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend response: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      
      setSaving(false);
      
      if (data.success) {
        Alert.alert(
          'Success!', 
          `Processed map saved as "${processedMapName}"\n\nYou can now see it in Indoor Navigation and Process Floor Map screens.`,
          [
            { text: 'OK', onPress: () => router.back() }
          ]
        );
      } else {
        Alert.alert('Warning', 'File saved locally but backend sync failed. The map may not appear in all screens.');
      }
    } catch (e) {
      setSaving(false);
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('Save error:', errorMessage, e);
      Alert.alert('Error', `Failed to save: ${errorMessage}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Processed Map{isSaved ? ' (Saved)' : ''}</Text>
      
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={styles.image}>
          <Text>Loading image...</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detected Regions ({labels.length})</Text>
        {labels.length === 0 ? (
          <Text style={{ color: '#666' }}>No regions detected</Text>
        ) : (
          labels.map((l: any, idx: number) => (
            <View key={idx} style={styles.labelRow}>
              <Text style={styles.labelText}>{l.label}</Text>
              <Text style={styles.meta}>{`area: ${Math.round(l.area)}`}</Text>
            </View>
          ))
        )}
      </View>

      {!isSaved && (
        <View style={{ marginVertical: 12 }}>
          <Button 
            title={saving ? 'Saving...' : 'Save Processed Map'} 
            onPress={saveToDevice} 
            disabled={saving} 
          />
        </View>
      )}

      {isSaved && (
        <View style={styles.savedInfo}>
          <Text style={styles.savedInfoText}>
            ✓ This processed map is saved and ready for indoor navigation
          </Text>
        </View>
      )}

      {isSaved && labels.length > 0 && (
        <View style={{ marginVertical: 12 }}>
          <Button 
            title="Manage Room Images & Start Navigation" 
            onPress={() => router.push({
              pathname: '/screens/roomImageManager' as any,
              params: {
                map: JSON.stringify({
                  map_id: processed.map_id || original?.map_id,
                  map_name: processed.map_name || original?.map_name,
                  metadata: {
                    labels: labels,
                  }
                })
              }
            })}
          />
        </View>
      )}

      {isSaved && labels.length > 0 && (
        <View style={{ marginVertical: 12 }}>
          <Button 
            title="🎥 Start Floor Recording Mode" 
            onPress={() => router.push({
              pathname: '/screens/mapRecordingMode' as any,
              params: {
                map: JSON.stringify({
                  map_id: processed.map_id || original?.map_id,
                  map_name: processed.map_name || original?.map_name,
                  user_id: 'user_001', // This should come from authentication
                  metadata: {
                    labels: labels,
                  }
                })
              }
            })}
          />
        </View>
      )}

      <View style={{ marginTop: 20 }}>
        <Button title="Back" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center', backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  image: { width: '100%', height: 400, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  section: { width: '100%', marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  labelText: { fontWeight: '600' },
  meta: { color: '#666' },
  savedInfo: {
    backgroundColor: '#E8F5F3',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4BE6DA',
  },
  savedInfoText: {
    color: '#2F5061',
    fontSize: 14,
    fontWeight: '500',
  },
});

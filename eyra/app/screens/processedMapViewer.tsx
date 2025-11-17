import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, Button, StyleSheet, Alert, TextInput, TouchableOpacity } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { addFloorMap } from '../services/floorMapService';
import { DEMO_USER_ID } from '../constants/user';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

const colors = {
  secondary: '#3b82f6',
  danger: '#ef4444',
  border: '#e5e7eb',
  cardBackground: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
};

export default function ProcessedMapViewer() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const processed = params.processed ? JSON.parse(params.processed as string) : null;
  const original = params.original ? JSON.parse(params.original as string) : null;
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [editedLabels, setEditedLabels] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
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
    // Initialize edited labels
    if (processed?.labels) {
      setEditedLabels(processed.labels.map((l: any) => ({ ...l })));
    }
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

      console.log('Saving to backend URL:', API_BASE_URL);
      const response = await fetch(API_ENDPOINTS.addFloorMap, {
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

  const updateLabels = async () => {
    try {
      setUpdating(true);
      
      // Build the updates array
      const updates = editedLabels.map((label, idx) => ({
        old_label: labels[idx]?.label || `room_${idx + 1}`,
        new_label: label.label,
        bbox: label.bbox,
      }));

      console.log('Updating labels:', updates);

      const mapId = processed.map_id || original?.map_id;
      if (!mapId) {
        throw new Error('No map ID available');
      }

      const formData = new FormData();
      formData.append('labels', JSON.stringify(updates));

      const response = await fetch(
        API_ENDPOINTS.updateFloorMapLabels(userId, mapId),
        {
          method: 'PUT',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setUpdating(false);

      if (data.success) {
        Alert.alert(
          'Success!',
          `Updated ${data.updated_labels?.length || updates.length} room labels`,
          [
            {
              text: 'OK',
              onPress: () => {
                setEditMode(false);
                // Update the processed labels
                if (processed) {
                  processed.labels = editedLabels;
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to update labels');
      }
    } catch (e) {
      setUpdating(false);
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('Update labels error:', errorMessage, e);
      Alert.alert('Error', `Failed to update labels: ${errorMessage}`);
    }
  };

  const handleLabelChange = (index: number, newLabel: string) => {
    const updated = [...editedLabels];
    updated[index] = { ...updated[index], label: newLabel };
    setEditedLabels(updated);
  };

  const toggleEditMode = () => {
    if (editMode) {
      // Exiting edit mode - reset to original labels
      setEditedLabels(labels.map((l: any) => ({ ...l })));
    }
    setEditMode(!editMode);
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Detected Regions ({labels.length})</Text>
          <TouchableOpacity
            onPress={toggleEditMode}
            style={[styles.editButton, editMode && styles.editButtonActive]}
          >
            <Text style={[styles.editButtonText, editMode && styles.editButtonTextActive]}>
              {editMode ? '✕ Cancel' : '✏️ Edit Labels'}
            </Text>
          </TouchableOpacity>
        </View>

        {labels.length === 0 ? (
          <Text style={{ color: '#666' }}>No regions detected</Text>
        ) : (
          <>
            {(editMode ? editedLabels : labels).map((l: any, idx: number) => (
              <View key={idx} style={styles.labelRow}>
                <View style={styles.labelInfo}>
                  {/* OCR/Auto indicator */}
                  <View
                    style={[
                      styles.labelBadge,
                      l.text_extracted ? styles.ocrBadge : styles.autoBadge,
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {l.text_extracted ? 'OCR' : 'AUTO'}
                    </Text>
                  </View>

                  {/* Label text or input */}
                  {editMode ? (
                    <TextInput
                      style={styles.labelInput}
                      value={editedLabels[idx]?.label || ''}
                      onChangeText={(text) => handleLabelChange(idx, text)}
                      placeholder={`Room ${idx + 1}`}
                      placeholderTextColor="#999"
                    />
                  ) : (
                    <Text style={styles.labelText}>{l.label}</Text>
                  )}
                </View>

                {/* Metadata */}
                <View style={styles.metaContainer}>
                  <Text style={styles.meta}>{`Area: ${Math.round(l.area)}`}</Text>
                  {l.ocr_confidence > 0 && (
                    <Text style={styles.meta}>{`Conf: ${l.ocr_confidence}%`}</Text>
                  )}
                </View>
              </View>
            ))}

            {/* Update button in edit mode */}
            {editMode && (
              <TouchableOpacity
                style={styles.updateButton}
                onPress={updateLabels}
                disabled={updating}
              >
                <Text style={styles.updateButtonText}>
                  {updating ? '⟳ Updating...' : '✓ Update Labels'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Stats section */}
            {processed?.stats && (
              <View style={styles.statsContainer}>
                <Text style={styles.statsTitle}>Detection Statistics</Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statsLabel}>Total Rooms:</Text>
                  <Text style={styles.statsValue}>{processed.stats.total_rooms}</Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.statsLabel}>OCR Labeled:</Text>
                  <Text style={[styles.statsValue, styles.ocrColor]}>
                    {processed.stats.ocr_labeled}
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.statsLabel}>Auto Labeled:</Text>
                  <Text style={[styles.statsValue, styles.autoColor]}>
                    {processed.stats.auto_labeled}
                  </Text>
                </View>
              </View>
            )}
          </>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.secondary,
    borderRadius: 16,
  },
  editButtonActive: {
    backgroundColor: colors.danger,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  editButtonTextActive: {
    color: '#fff',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
    marginBottom: 4,
    borderRadius: 6,
  },
  labelInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  ocrBadge: {
    backgroundColor: colors.secondary,
  },
  autoBadge: {
    backgroundColor: colors.secondary,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  labelInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 6,
    color: colors.text,
  },
  labelText: { fontSize: 15, fontWeight: '600', flex: 1, color: colors.text },
  metaContainer: {
    alignItems: 'flex-end',
  },
  meta: { color: '#666', fontSize: 11 },
  updateButton: {
  backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  statsContainer: {
    backgroundColor: colors.cardBackground,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statsLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  ocrColor: {
    color: colors.secondary,
  },
  autoColor: {
    color: colors.secondary,
  },
  savedInfo: {
    backgroundColor: '#E8F5F3',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  savedInfoText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});

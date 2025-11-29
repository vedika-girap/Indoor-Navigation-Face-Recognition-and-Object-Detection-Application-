import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, Button, StyleSheet, Alert, TextInput, TouchableOpacity, StatusBar, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { addFloorMap } from '../services/floorMapService';
import { DEMO_USER_ID } from '../constants/user';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

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
    const initScreen = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const labelCount = processed?.labels?.length || 0;
      const isSaved = processed?.is_saved || false;
      Speech.speak(
        `Processed map viewer. ${labelCount} room${labelCount === 1 ? '' : 's'} detected. ${isSaved ? 'Map is saved.' : 'Swipe down to save map.'} Swipe to edit room labels.`,
        { rate: 0.9 }
      );
    };
    initScreen();
    
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
    
    // Cleanup: Stop speech when leaving screen
    return () => {
      Speech.stop();
    };
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Speech.speak('Saving processed map. Please wait.', { rate: 0.9 });
      
      // Check if already saved
      if (isSaved) {
        Speech.speak('Map already saved', { rate: 0.9 });
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // If map is not saved yet, just update locally
      if (!isSaved) {
        Speech.speak(`Updated ${editedLabels.length} room label${editedLabels.length === 1 ? '' : 's'} locally`, { rate: 0.9 });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Update the processed labels locally
        if (processed) {
          processed.labels = editedLabels;
        }
        setEditMode(false);
        setUpdating(false);
        Alert.alert('Success!', 'Labels updated. Save the map to persist changes.');
        return;
      }
      
      Speech.speak('Updating room labels on server. Please wait.', { rate: 0.9 });
      
      // Build the updates array
      const updates = editedLabels.map((label, idx) => ({
        old_label: labels[idx]?.label || `room_${idx + 1}`,
        new_label: label.label,
        bbox: label.bbox,
      }));

      console.log('Updating labels for saved map:', updates);

      const mapId = processed.map_id;
      if (!mapId) {
        throw new Error('No map ID available for saved map');
      }

      const formData = new FormData();
      formData.append('labels', JSON.stringify(updates));

      console.log('Calling API:', API_ENDPOINTS.updateFloorMapLabels(userId, mapId));
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
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const count = data.updated_labels?.length || updates.length;
        Speech.speak(`Updated ${count} room label${count === 1 ? '' : 's'} successfully`, { rate: 0.9 });
        Alert.alert(
          'Success!',
          `Updated ${count} room label${count === 1 ? '' : 's'}`,
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
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Speech.speak('Failed to update labels', { rate: 0.9 });
        Alert.alert('Error', data.message || 'Failed to update labels');
      }
    } catch (e) {
      setUpdating(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage = e instanceof Error ? e.message : String(e);
      Speech.speak('Error updating labels', { rate: 0.9 });
      console.error('Update labels error:', errorMessage, e);
      Alert.alert('Error', `Failed to update labels: ${errorMessage}`);
    }
  };

  const handleLabelChange = (index: number, newLabel: string) => {
    const updated = [...editedLabels];
    updated[index] = { ...updated[index], label: newLabel };
    setEditedLabels(updated);
  };

  const toggleEditMode = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editMode) {
      // Exiting edit mode - reset to original labels
      Speech.speak('Edit mode cancelled', { rate: 0.9 });
      setEditedLabels(labels.map((l: any) => ({ ...l })));
    } else {
      Speech.speak(`Edit mode enabled. ${labels.length} room${labels.length === 1 ? '' : 's'} to edit.`, { rate: 0.9 });
    }
    setEditMode(!editMode);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Modern Gradient Header */}
      <LinearGradient colors={['#50c878', '#3bb55f']} style={styles.header}>
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
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Processed Map</Text>
            {isSaved && (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
                <Text style={styles.savedBadgeText}>Saved</Text>
              </View>
            )}
          </View>
          <View style={styles.backButton} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map Image Card */}
        <View style={styles.imageCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.loadingGradient}>
                <Ionicons name="image-outline" size={48} color="#fff" />
                <Text style={styles.loadingText}>Loading map...</Text>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Labels Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="pricetags" size={24} color="#2c3e50" />
              <Text style={styles.sectionTitle}>Room Labels</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{labels.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={toggleEditMode}
              style={styles.editButtonWrapper}
              accessible={true}
              accessibilityLabel={editMode ? 'Cancel editing' : 'Edit room labels'}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={editMode ? ['#ff6b6b', '#ee5a52'] : ['#4facfe', '#00f2fe']}
                style={styles.editButton}
              >
                <Ionicons name={editMode ? 'close-circle' : 'create'} size={18} color="#fff" />
                <Text style={styles.editButtonText}>
                  {editMode ? 'Cancel' : 'Edit'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {labels.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient colors={['#ffc371', '#ff5f6d']} style={styles.emptyCircle}>
                <Ionicons name="alert-circle-outline" size={48} color="#fff" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No Rooms Detected</Text>
              <Text style={styles.emptyText}>The map processing did not detect any rooms</Text>
            </View>
          ) : (
            <>
              {(editMode ? editedLabels : labels).map((l: any, idx: number) => {
                const labelAccessibility = `Room ${idx + 1}. ${l.label}. ${l.text_extracted ? 'Detected by text recognition' : 'Auto-labeled'}. Area: ${Math.round(l.area)}.`;
                
                return (
                <TouchableOpacity
                  key={idx}
                  style={styles.labelCard}
                  accessible={true}
                  accessibilityLabel={labelAccessibility}
                  accessibilityRole="button"
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Speech.speak(labelAccessibility, { rate: 0.9 });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.labelMain}>
                    {/* Badge */}
                    <LinearGradient
                      colors={l.text_extracted ? ['#667eea', '#764ba2'] : ['#f093fb', '#f5576c']}
                      style={styles.labelBadge}
                    >
                      <Text style={styles.badgeText}>
                        {l.text_extracted ? 'OCR' : 'AUTO'}
                      </Text>
                    </LinearGradient>

                    {/* Label text or input */}
                    {editMode ? (
                      <TextInput
                        style={styles.labelInput}
                        value={editedLabels[idx]?.label || ''}
                        onChangeText={(text) => handleLabelChange(idx, text)}
                        placeholder={`Room ${idx + 1}`}
                        placeholderTextColor="#bdc3c7"
                        accessible={true}
                        accessibilityLabel={`Edit room ${idx + 1} name`}
                        accessibilityHint="Type to change the room name"
                      />
                    ) : (
                      <Text style={styles.labelText}>{l.label}</Text>
                    )}
                  </View>

                  {/* Metadata */}
                  <View style={styles.metaContainer}>
                    <View style={styles.metaRow}>
                      <Ionicons name="resize-outline" size={14} color="#7f8c8d" />
                      <Text style={styles.meta}>{Math.round(l.area)}</Text>
                    </View>
                    {l.ocr_confidence > 0 && (
                      <View style={styles.metaRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#50c878" />
                        <Text style={styles.meta}>{l.ocr_confidence}%</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
              })}

              {/* Update button in edit mode */}
              {editMode && (
                <TouchableOpacity
                  style={styles.updateButtonWrapper}
                  onPress={updateLabels}
                  disabled={updating}
                  accessible={true}
                  accessibilityLabel={updating ? 'Updating labels' : 'Update all room labels'}
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={updating ? ['#bdc3c7', '#95a5a6'] : ['#50c878', '#3bb55f']}
                    style={styles.updateButton}
                  >
                    {updating ? (
                      <Ionicons name="sync" size={22} color="#fff" />
                    ) : (
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    )}
                    <Text style={styles.updateButtonText}>
                      {updating ? 'Updating...' : 'Update Labels'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Stats section */}
              {processed?.stats && (
                <View style={styles.statsCard}>
                  <View style={styles.statsHeader}>
                    <Ionicons name="bar-chart" size={20} color="#2c3e50" />
                    <Text style={styles.statsTitle}>Detection Stats</Text>
                  </View>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{processed.stats.total_rooms}</Text>
                      <Text style={styles.statLabel}>Total Rooms</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, styles.ocrColor]}>{processed.stats.ocr_labeled}</Text>
                      <Text style={styles.statLabel}>OCR Labeled</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, styles.autoColor]}>{processed.stats.auto_labeled}</Text>
                      <Text style={styles.statLabel}>Auto Labeled</Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
                {!isSaved ? (
                  <TouchableOpacity 
                    onPress={saveToDevice} 
                    disabled={saving}
                    style={styles.actionButtonWrapper}
                    accessibilityLabel="Save processed map for navigation"
                    accessibilityHint="Double tap to save the floor map"
                  >
                    <LinearGradient
                      colors={saving ? ['#bdc3c7', '#95a5a6'] : ['#f093fb', '#f5576c']}
                      style={styles.actionButton}
                    >
                      <Ionicons name={saving ? 'sync' : 'save-outline'} size={24} color="#fff" />
                      <Text style={styles.actionButtonText}>
                        {saving ? 'Saving...' : 'Save Processed Map'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.savedInfoCard}>
                      <Ionicons name="checkmark-circle" size={28} color="#50c878" />
                      <Text style={styles.savedInfoTitle}>Map Ready</Text>
                      <Text style={styles.savedInfoText}>
                        This floor map is saved and ready for indoor navigation
                      </Text>
                    </View>

                    {labels.length > 0 && (
                      <>
                        <TouchableOpacity 
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            Speech.speak('Opening room image manager', { rate: 0.9 });
                            router.push({
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
                            });
                          }}
                          style={styles.actionButtonWrapper}
                          accessibilityLabel="Manage room images and start navigation"
                          accessibilityHint="Double tap to manage room images"
                        >
                          <LinearGradient
                            colors={['#4facfe', '#00f2fe']}
                            style={styles.actionButton}
                          >
                            <Ionicons name="images-outline" size={24} color="#fff" />
                            <Text style={styles.actionButtonText}>Manage Room Images</Text>
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            Speech.speak('Starting floor recording mode', { rate: 0.9 });
                            router.push({
                              pathname: '/screens/mapRecordingMode' as any,
                              params: {
                                map: JSON.stringify({
                                  map_id: processed.map_id || original?.map_id,
                                  map_name: processed.map_name || original?.map_name,
                                  user_id: 'user_001',
                                  metadata: {
                                    labels: labels,
                                  }
                                })
                              }
                            });
                          }}
                          style={styles.actionButtonWrapper}
                          accessibilityLabel="Start floor recording mode"
                          accessibilityHint="Double tap to begin recording floor navigation"
                        >
                          <LinearGradient
                            colors={['#667eea', '#764ba2']}
                            style={styles.actionButton}
                          >
                            <Ionicons name="videocam-outline" size={24} color="#fff" />
                            <Text style={styles.actionButtonText}>Start Floor Recording</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        );
      }

      const styles = StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: '#f5f7fa',
        },
        header: {
          paddingTop: Platform.OS === 'ios' ? 60 : 40,
          paddingBottom: 20,
          paddingHorizontal: 20,
        },
        headerTop: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        backButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerCenter: {
          flex: 1,
          marginLeft: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        headerTitle: {
          fontSize: 24,
          fontWeight: '700',
          color: '#fff',
        },
        savedBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
        },
        savedBadgeText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '600',
        },
        scrollContent: {
          padding: 20,
        },
        imageCard: {
          backgroundColor: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 6,
          marginBottom: 24,
        },
        image: {
          width: '100%',
          height: 400,
          resizeMode: 'contain',
        },
        imagePlaceholder: {
          width: '100%',
          height: 400,
          justifyContent: 'center',
          alignItems: 'center',
        },
        loadingGradient: {
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
        },
        loadingText: {
          fontSize: 16,
          color: '#fff',
          fontWeight: '600',
        },
        section: {
          marginBottom: 24,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        },
        sectionTitleContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        sectionTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: '#2c3e50',
        },
        countBadge: {
          backgroundColor: '#4facfe',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          minWidth: 28,
          alignItems: 'center',
        },
        countText: {
          color: '#fff',
          fontSize: 14,
          fontWeight: '700',
        },
        editButtonWrapper: {
          minHeight: 44,
        },
        editButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 22,
          minHeight: 44,
        },
        editButtonText: {
          color: '#fff',
          fontSize: 14,
          fontWeight: '700',
        },
        emptyState: {
          alignItems: 'center',
          paddingVertical: 40,
          paddingHorizontal: 20,
        },
        emptyCircle: {
          width: 120,
          height: 120,
          borderRadius: 60,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 20,
        },
        emptyTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: '#2c3e50',
          marginBottom: 8,
        },
        emptyText: {
          fontSize: 16,
          color: '#7f8c8d',
          textAlign: 'center',
          lineHeight: 24,
        },
        labelCard: {
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 4,
          minHeight: 72,
        },
        labelMain: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
        },
        labelBadge: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 12,
          minWidth: 50,
          alignItems: 'center',
        },
        badgeText: {
          color: '#fff',
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.5,
        },
        labelInput: {
          flex: 1,
          fontSize: 16,
          fontWeight: '600',
          paddingVertical: 12,
          paddingHorizontal: 16,
          backgroundColor: '#f8f9fa',
          borderWidth: 2,
          borderColor: '#4facfe',
          borderRadius: 12,
          color: '#2c3e50',
          minHeight: 48,
        },
        labelText: {
          flex: 1,
          fontSize: 16,
          fontWeight: '600',
          color: '#2c3e50',
        },
        metaContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        metaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        meta: {
          color: '#7f8c8d',
          fontSize: 13,
          fontWeight: '500',
        },
        updateButtonWrapper: {
          marginTop: 16,
          minHeight: 56,
        },
        updateButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 16,
          borderRadius: 16,
          minHeight: 56,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 6,
        },
        updateButtonText: {
          color: '#fff',
          fontSize: 18,
          fontWeight: '700',
        },
        statsCard: {
          backgroundColor: '#fff',
          borderRadius: 20,
          padding: 20,
          marginBottom: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 6,
        },
        statsHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        },
        statsTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: '#2c3e50',
        },
        statsGrid: {
          flexDirection: 'row',
          justifyContent: 'space-around',
        },
        statItem: {
          alignItems: 'center',
        },
        statValue: {
          fontSize: 28,
          fontWeight: '700',
          color: '#2c3e50',
          marginBottom: 4,
        },
        statLabel: {
          fontSize: 13,
          color: '#7f8c8d',
          fontWeight: '500',
        },
        ocrColor: {
          color: '#667eea',
        },
        autoColor: {
          color: '#f093fb',
        },
        actionsSection: {
          gap: 16,
        },
        actionButtonWrapper: {
          minHeight: 60,
        },
        actionButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingVertical: 18,
          borderRadius: 16,
          minHeight: 60,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 6,
        },
        actionButtonText: {
          color: '#fff',
          fontSize: 17,
          fontWeight: '700',
        },
        savedInfoCard: {
          backgroundColor: '#E8F5F3',
          borderRadius: 16,
          padding: 20,
          alignItems: 'center',
          marginBottom: 16,
          borderLeftWidth: 4,
          borderLeftColor: '#50c878',
        },
        savedInfoTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: '#2c3e50',
          marginTop: 8,
          marginBottom: 4,
        },
        savedInfoText: {
          fontSize: 14,
          color: '#7f8c8d',
          textAlign: 'center',
          fontWeight: '500',
        },
      });

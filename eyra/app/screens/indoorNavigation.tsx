import * as ImagePicker from 'expo-image-picker';
import React, { useState, useRef, useEffect } from 'react';
import {
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Alert,
    ActivityIndicator,
    StatusBar,
    Platform,
    Dimensions,
    ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Speech from 'expo-speech';
import * as DocumentPicker from 'expo-document-picker';
import { addFloorMap, listFloorMaps, deleteFloorMap, FloorMap } from '../services/floorMapService';
import { DEMO_USER_ID } from '../constants/user';

const { width } = Dimensions.get('window');

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
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  loadingGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  carouselSection: {
    marginBottom: 30,
  },
  carouselContent: {
    paddingVertical: 10,
  },
  mapCard: {
    width: width * 0.75,
    marginRight: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  mapCardSelected: {
    borderWidth: 3,
    borderColor: '#50c878',
  },
  mapImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
  },
  mapCardFooter: {
    padding: 16,
  },
  mapCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 40,
  },
  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  previewSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 12,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
  },
  actionsSection: {
    gap: 16,
  },
  actionButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalBody: {
    padding: 20,
  },
  modalSubtext: {
    fontSize: 15,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#e0e6ed',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    paddingVertical: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  modalButtonWrapper: {
    flex: 1,
  },
  modalCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f7fa',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#e0e6ed',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default function IndoorNavigation() {
  const router = useRouter();
  const [maps, setMaps] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Use consistent user ID across the app
  const userId = DEMO_USER_ID;

  // Cleanup: Stop speech when leaving screen
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Load saved floor maps on mount and when screen gains focus
  useEffect(() => {
    loadMaps();
  }, []);

  // Reload maps whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('IndoorNavigation screen focused - reloading maps');
      loadMaps();
    }, [])
  );

  const loadMaps = async () => {
    try {
      setLoading(true);
      const savedMaps = await listFloorMaps(userId);
      console.log('📋 IndoorNavigation loaded', savedMaps.length, 'maps for user:', userId);
      
      // Convert FloorMap[] to the format used by this component
      const convertedMaps = savedMaps.map(m => ({
        id: m.map_id,
        name: m.map_name,
        image: { uri: m.local_uri },
        isStatic: false,
        floorMap: m // Store original for reference
      }));
      
      console.log('📊 Total maps:', convertedMaps.length);
      setMaps(convertedMaps);
      
      // Set first map as selected if available and no selection exists
      if (convertedMaps.length > 0 && !selected) {
        setSelected(convertedMaps[0]);
      }
    } catch (error) {
      console.error('Error loading maps:', error);
      Alert.alert('Error', 'Failed to load saved floor maps');
    } finally {
      setLoading(false);
    }
  };

  // Add Map Logic - addFloorMap handles the file picker internally
  const handleAddMap = async () => {
    if (!newMapName.trim()) {
      Alert.alert('Missing Information', 'Please provide a name for the floor map');
      return;
    }

    try {
      setSaving(true);
      setModalVisible(false); // Close modal before showing picker
      Speech.speak('Select floor map image');
      
      // addFloorMap will open the document picker
      const savedMap = await addFloorMap(
        userId,
        newMapName,
        undefined, // building name (optional)
        undefined  // floor number (optional)
      );

      if (!savedMap) {
        // User cancelled or error occurred
        Speech.speak('Cancelled');
        setNewMapName('');
        return;
      }

      console.log('Map saved:', savedMap);
      
      // Add to local state
      const newMap = {
        id: savedMap.map_id,
        name: savedMap.map_name,
        image: { uri: savedMap.local_uri },
        isStatic: false,
        floorMap: savedMap
      };
      
      const updated = [...maps, newMap];
      setMaps(updated);
      setSelected(newMap);
      
      // Reset form
      setNewMapName('');
      
      Speech.speak('Floor map added successfully');
      Alert.alert('Success', 'Floor map saved successfully');
    } catch (error) {
      console.error('Error saving map:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to save floor map: ${message}`);
      Speech.speak('Failed to save floor map');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Modern Gradient Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
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
          <Text style={styles.headerTitle}>Indoor Navigation</Text>
          <View style={styles.backButton} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.loadingGradient}
            >
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading maps...</Text>
            </LinearGradient>
          </View>
        ) : (
          <>
            {/* Floor Maps Carousel */}
            {maps.length > 0 ? (
              <View style={styles.carouselSection}>
                <FlatList
                  data={maps}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={width * 0.75 + 20}
                  decelerationRate="fast"
                  contentContainerStyle={styles.carouselContent}
                  keyExtractor={item => item.id}
                  renderItem={({ item, index }) => {
                    const isSelected = item.id === selected?.id;
                    const gradients = [
                      ['#667eea', '#764ba2'],
                      ['#f093fb', '#f5576c'],
                      ['#4facfe', '#00f2fe'],
                    ];
                    const gradient = gradients[index % gradients.length];

                    return (
                      <TouchableOpacity
                        style={[
                          styles.mapCard,
                          isSelected && styles.mapCardSelected
                        ]}
                        onPress={() => setSelected(item)}
                        activeOpacity={0.9}
                      >
                        <View style={styles.mapImageContainer}>
                          <Image 
                            source={item.image} 
                            style={styles.mapImage} 
                            resizeMode="cover" 
                          />
                          {isSelected && (
                            <View style={styles.selectedBadge}>
                              <Ionicons name="checkmark-circle" size={24} color="#50c878" />
                            </View>
                          )}
                        </View>
                        <LinearGradient
                          colors={gradient}
                          style={styles.mapCardFooter}
                        >
                          <Text style={styles.mapCardTitle} numberOfLines={2}>
                            {item.name}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={['#f093fb', '#f5576c']}
                  style={styles.emptyCircle}
                >
                  <Ionicons name="map-outline" size={48} color="#fff" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>No Maps Yet</Text>
                <Text style={styles.emptySubtext}>
                  Upload a floor map to start indoor navigation
                </Text>
              </View>
            )}

            {/* Selected Map Preview */}
            {selected && (
              <View style={styles.previewSection}>
                <Text style={styles.sectionTitle}>Selected Map</Text>
                <View style={styles.previewCard}>
                  <Image 
                    source={selected.image} 
                    style={styles.previewImage} 
                    resizeMode="contain" 
                  />
                  <Text style={styles.previewName}>{selected.name}</Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsSection}>
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={styles.actionButtonWrapper}
              >
                <LinearGradient
                  colors={['#4facfe', '#00f2fe']}
                  style={styles.actionButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add-circle-outline" size={28} color="#fff" />
                  <Text style={styles.actionButtonText}>Add Floor Map</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/screens/processFloorMap')}
                disabled={!selected}
                style={[styles.actionButtonWrapper, !selected && styles.actionButtonDisabled]}
              >
                <LinearGradient
                  colors={!selected ? ['#ccc', '#aaa'] : ['#50c878', '#3bb55f']}
                  style={styles.actionButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="construct-outline" size={28} color="#fff" />
                  <Text style={styles.actionButtonText}>Process Map</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal for Adding New Map */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <BlurView intensity={90} style={styles.modalContainer}>
          <View style={styles.modalView}>
            <LinearGradient
              colors={['#4facfe', '#00f2fe']}
              style={styles.modalHeader}
            >
              <Ionicons name="map" size={32} color="#fff" />
              <Text style={styles.modalTitle}>Add Floor Map</Text>
            </LinearGradient>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtext}>
                Enter a name for your floor map
              </Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="document-text-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 2nd Floor Building A"
                  placeholderTextColor="#999"
                  value={newMapName}
                  onChangeText={setNewMapName}
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setNewMapName('');
                }}
                disabled={saving}
                style={styles.modalButtonWrapper}
              >
                <View style={styles.modalCancelButton}>
                  <Ionicons name="close-circle-outline" size={20} color="#666" />
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddMap}
                disabled={saving || !newMapName.trim()}
                style={styles.modalButtonWrapper}
              >
                <LinearGradient
                  colors={saving || !newMapName.trim() ? ['#ccc', '#aaa'] : ['#50c878', '#3bb55f']}
                  style={styles.modalSaveButton}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.modalSaveText}>Save & Select Image</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

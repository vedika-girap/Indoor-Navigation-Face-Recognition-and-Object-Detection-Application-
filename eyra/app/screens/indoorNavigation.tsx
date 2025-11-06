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
    ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import * as DocumentPicker from 'expo-document-picker';
import { addFloorMap, listFloorMaps, deleteFloorMap, FloorMap } from '../services/floorMapService';
import { DEMO_USER_ID } from '../constants/user';

const pastelColors = {
  background: '#E8F0F2',
  cardBackground: '#F8F2F7',
  buttonBackground: '#A3D2CA',
  buttonDisabledBackground: '#c5dacf',
  textPrimary: '#20639B',
  textSecondary: '#395B64',
  placeholderBackground: '#D6DBD2',
  borderColor: '#2F5061',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
    alignItems: 'center',
    padding: 30,
  },
  header: {
    marginTop: 50,
    fontSize: 28,
    fontWeight: '700',
    color: pastelColors.textPrimary,
    marginBottom: 30,
  },
  mapPlaceholder: {
    width: 300,
    height: 200,
    backgroundColor: pastelColors.placeholderBackground,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: pastelColors.borderColor,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  mapName: {
    fontSize: 18,
    color: pastelColors.textSecondary,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  flatList: {
    height: 120,
    marginBottom: 15,
  },
  card: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: pastelColors.borderColor,
    padding: 10,
    alignItems: 'center',
    marginRight: 12,
    width: 120,
    elevation: 2,
  },
  smallImage: {
    width: 96,
    height: 64,
    borderRadius: 8,
  },
  selectedCard: {
    borderColor: pastelColors.textPrimary,
    borderWidth: 3,
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  button: {
    flex: 0.45,
    paddingVertical: 18,
    backgroundColor: pastelColors.buttonBackground,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  buttonDisabled: {
    backgroundColor: pastelColors.buttonDisabledBackground,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(55,75,75,0.2)',
  },
  modalView: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    elevation: 5,
    width: 320,
  },
  textInput: {
    width: 230,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pastelColors.borderColor,
    fontSize: 18,
    backgroundColor: '#fff',
    marginBottom: 18,
    padding: 10,
    color: pastelColors.textPrimary,
    textAlign: 'center',
  },
  modalCancel: {
    marginTop: 8,
    color: pastelColors.textSecondary,
    fontSize: 16,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
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
      <Text style={styles.header}>Indoor Navigation</Text>
      
      {loading ? (
        <View style={{ marginVertical: 20 }}>
          <ActivityIndicator size="large" color={pastelColors.buttonBackground} />
          <Text style={{ color: pastelColors.textSecondary, marginTop: 10 }}>Loading maps...</Text>
        </View>
      ) : maps.length > 0 ? (
        <>
          <FlatList
            style={styles.flatList}
            data={maps}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.card,
                  item.id === selected?.id && styles.selectedCard
                ]}
                onPress={() => setSelected(item)}
                activeOpacity={0.8}
              >
                <Image source={item.image} style={styles.smallImage} resizeMode="cover" />
                <Text numberOfLines={1} style={styles.mapName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      ) : (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: pastelColors.textSecondary, marginBottom: 10 }}>
            No floor maps available
          </Text>
          <Text style={{ color: pastelColors.textSecondary, fontSize: 12, textAlign: 'center' }}>
            Upload a floor map to get started with indoor navigation
          </Text>
        </View>
      )}
      
      <View style={styles.mapPlaceholder}>
        {selected?.image ? (
          <Image source={selected.image} style={styles.imagePreview} resizeMode="contain" />
        ) : (
          <Text style={styles.mapName}>Select or add a floor map</Text>
        )}
      </View>
      <Text style={styles.mapName}>{selected?.name || ''}</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.buttonText}>Add Floor Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !selected && styles.buttonDisabled]}
          disabled={!selected}
          onPress={() => {
            console.log('Navigating to ProcessFloorMap');
            router.push('/screens/processFloorMap');
          }}
        >
          <Text style={styles.buttonText}>Process Map</Text>
        </TouchableOpacity>
      </View>
      
      {/* Show Start Navigation button for processed maps */}
      {selected?.floorMap?.metadata?.is_processed && selected?.floorMap?.metadata?.labels && (
        <View style={{ marginTop: 10, width: '100%' }}>
          <TouchableOpacity
            style={[styles.button, { width: '100%', backgroundColor: '#50C878' }]}
            onPress={() => {
              router.push({
                pathname: '/screens/roomImageManager' as any,
                params: {
                  map: JSON.stringify({
                    map_id: selected.floorMap.map_id,
                    map_name: selected.floorMap.map_name,
                    metadata: {
                      labels: selected.floorMap.metadata.labels,
                    }
                  })
                }
              });
            }}
          >
            <Text style={styles.buttonText}>Start Navigation Setup →</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Modal for Adding New Map */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: pastelColors.textPrimary, marginBottom: 15 }}>
              Add Floor Map
            </Text>
            <Text style={{ fontSize: 14, color: pastelColors.textSecondary, marginBottom: 15, textAlign: 'center' }}>
              Enter a name, then you'll be asked to select an image file.
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Floor Name"
              placeholderTextColor={pastelColors.textSecondary}
              value={newMapName}
              onChangeText={setNewMapName}
              editable={!saving}
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.button,
                (!newMapName.trim() || saving) && styles.buttonDisabled,
                { width: 180, marginTop: 10 },
              ]}
              onPress={handleAddMap}
              disabled={!newMapName.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Continue & Select Image</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                if (!saving) {
                  setModalVisible(false);
                  setNewMapName('');
                }
              }}
              disabled={saving}
              style={{ marginTop: 15 }}
            >
              <Text style={[styles.modalCancel, saving && { opacity: 0.5 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

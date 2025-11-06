/**
 * Floor Map Management Screen
 * WhatsApp-style map management with local storage
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { FloorMap, FloorMapStats } from '../services/floorMapService';
import * as FloorMapService from '../services/floorMapService';
import { DEMO_USER_ID } from '../constants/user';

export default function FloorMapManagement() {
  const router = useRouter();
  const [maps, setMaps] = useState<FloorMap[]>([]);
  const [stats, setStats] = useState<FloorMapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedMap, setSelectedMap] = useState<FloorMap | null>(null);

  // Form state for adding/editing maps
  const [mapName, setMapName] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [floorNumber, setFloorNumber] = useState('');

  // Use consistent user ID
  const USER_ID = DEMO_USER_ID;

  useEffect(() => {
    loadMaps();
  }, []);

  // Reload maps whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('FloorMapManagement screen focused - reloading maps');
      loadMaps();
    }, [])
  );

  const loadMaps = async () => {
    setLoading(true);
    try {
      const [mapsData, statsData] = await Promise.all([
        FloorMapService.listFloorMaps(USER_ID),
        FloorMapService.getFloorMapStats(USER_ID),
      ]);
      setMaps(mapsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading maps:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMaps();
    setRefreshing(false);
  }, []);

  const handleAddMap = async () => {
    if (!mapName.trim()) {
      Alert.alert('Error', 'Please enter a map name');
      return;
    }

    setAddModalVisible(false);
    const newMap = await FloorMapService.addFloorMap(
      USER_ID,
      mapName.trim(),
      buildingName.trim() || undefined,
      floorNumber.trim() || undefined
    );

    if (newMap) {
      Alert.alert('Success', 'Floor map added successfully!');
      setMapName('');
      setBuildingName('');
      setFloorNumber('');
      await loadMaps();
    }
  };

  const handleEditMap = async () => {
    if (!selectedMap) return;

    const success = await FloorMapService.updateFloorMapMetadata(USER_ID, selectedMap.map_id, {
      map_name: mapName.trim() || undefined,
      building_name: buildingName.trim() || undefined,
      floor_number: floorNumber.trim() || undefined,
    });

    if (success) {
      Alert.alert('Success', 'Map updated successfully!');
      setEditModalVisible(false);
      setSelectedMap(null);
      setMapName('');
      setBuildingName('');
      setFloorNumber('');
      await loadMaps();
    }
  };

  const handleDeleteMap = (map: FloorMap) => {
    Alert.alert(
      'Delete Map',
      `Delete "${map.map_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Soft Delete',
          onPress: async () => {
            const success = await FloorMapService.deleteFloorMap(USER_ID, map.map_id, false);
            if (success) {
              Alert.alert('Success', 'Map hidden (can be restored later)');
              await loadMaps();
            }
          },
        },
        {
          text: 'Permanent Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await FloorMapService.deleteFloorMap(USER_ID, map.map_id, true);
            if (success) {
              Alert.alert('Success', 'Map permanently deleted from device and server');
              await loadMaps();
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleViewMap = async (map: FloorMap) => {
    const fullMap = await FloorMapService.getFloorMap(USER_ID, map.map_id);
    if (fullMap) {
      // Navigate to indoor navigation screen
      router.push('/screens/indoorNavigation' as any);
    }
  };

  const openEditModal = (map: FloorMap) => {
    setSelectedMap(map);
    setMapName(map.map_name);
    setBuildingName(map.building_name || '');
    setFloorNumber(map.floor_number || '');
    setEditModalVisible(true);
  };

  const handleCleanup = async () => {
    Alert.alert(
      'Cleanup Orphaned Files',
      'Remove map files that are no longer tracked?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clean Up',
          onPress: async () => {
            const count = await FloorMapService.cleanupOrphanedFiles(USER_ID);
            Alert.alert('Cleanup Complete', `Removed ${count} orphaned files`);
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    const exportPath = await FloorMapService.exportFloorMaps(USER_ID);
    if (exportPath) {
      Alert.alert('Success', `Maps exported to:\n${exportPath}`);
    }
  };

  const renderMap = ({ item }: { item: FloorMap }) => (
    <TouchableOpacity style={styles.mapCard} onPress={() => handleViewMap(item)}>
      <Image source={{ uri: item.local_uri }} style={styles.mapThumbnail} resizeMode="cover" />

      <View style={styles.mapInfo}>
        <Text style={styles.mapName}>{item.map_name}</Text>
        {item.building_name && (
          <Text style={styles.mapDetail}>
            🏢 {item.building_name}
            {item.floor_number ? ` - Floor ${item.floor_number}` : ''}
          </Text>
        )}
        <Text style={styles.mapDate}>Added: {new Date(item.added_at).toLocaleDateString()}</Text>
      </View>

      <View style={styles.mapActions}>
        <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionButton}>
          <Ionicons name="pencil" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteMap(item)} style={styles.actionButton}>
          <Ionicons name="trash" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Floor Maps</Text>
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total_maps}</Text>
            <Text style={styles.statLabel}>Total Maps</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.unique_buildings}</Text>
            <Text style={styles.statLabel}>Buildings</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.unique_floors}</Text>
            <Text style={styles.statLabel}>Floors</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderAddModal = () => (
    <Modal
      visible={addModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setAddModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Floor Map</Text>

          <TextInput
            style={styles.input}
            placeholder="Map Name *"
            value={mapName}
            onChangeText={setMapName}
          />

          <TextInput
            style={styles.input}
            placeholder="Building Name (optional)"
            value={buildingName}
            onChangeText={setBuildingName}
          />

          <TextInput
            style={styles.input}
            placeholder="Floor Number (optional)"
            value={floorNumber}
            onChangeText={setFloorNumber}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setAddModalVisible(false);
                setMapName('');
                setBuildingName('');
                setFloorNumber('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalButton, styles.addButton]} onPress={handleAddMap}>
              <Text style={styles.addButtonText}>Pick Image & Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Floor Map</Text>

          <TextInput
            style={styles.input}
            placeholder="Map Name"
            value={mapName}
            onChangeText={setMapName}
          />

          <TextInput
            style={styles.input}
            placeholder="Building Name"
            value={buildingName}
            onChangeText={setBuildingName}
          />

          <TextInput
            style={styles.input}
            placeholder="Floor Number"
            value={floorNumber}
            onChangeText={setFloorNumber}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setEditModalVisible(false);
                setSelectedMap(null);
                setMapName('');
                setBuildingName('');
                setFloorNumber('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.addButton]}
              onPress={handleEditMap}
            >
              <Text style={styles.addButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={maps}
        renderItem={renderMap}
        keyExtractor={(item) => item.map_id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No floor maps yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add your first map</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={maps.length === 0 ? styles.emptyList : undefined}
      />

      {/* Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.bottomButton} onPress={handleCleanup}>
          <Ionicons name="trash-bin-outline" size={20} color="#007AFF" />
          <Text style={styles.bottomButtonText}>Cleanup</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomButton} onPress={handleExport}>
          <Ionicons name="download-outline" size={20} color="#007AFF" />
          <Text style={styles.bottomButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {renderAddModal()}
      {renderEditModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  mapCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  mapInfo: {
    flex: 1,
    marginLeft: 12,
  },
  mapName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  mapDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  mapDate: {
    fontSize: 12,
    color: '#999',
  },
  mapActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  bottomActions: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    justifyContent: 'space-around',
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  bottomButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#007AFF',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { DEMO_USER_ID } from '../constants/user';
import { API_ENDPOINTS } from '../config/api';
import { colors } from '../theme';

const pastelColors = {
  background: colors.background,
  cardBackground: colors.cardBackground,
  primary: colors.primary,
  success: colors.success,
  danger: colors.danger,
  warning: colors.accent,
  text: colors.text,
  textSecondary: colors.muted,
  border: colors.border,
};

interface SavedFace {
  face_id: string;
  face_name: string;
  image_path: string;
  image_filename: string;
  added_at: string;
  last_updated: string;
  metadata?: any;
}

export default function FaceManagementScreen() {
  const router = useRouter();
  const userId = DEMO_USER_ID;

  const [faces, setFaces] = useState<SavedFace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFace, setSelectedFace] = useState<SavedFace | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [faceImage, setFaceImage] = useState<string | null>(null);

  useEffect(() => {
    Speech.speak('Face management. Swipe down to refresh the list.');
    loadFaces();
    
    // Cleanup: Stop speech when leaving screen
    return () => {
      Speech.stop();
    };
  }, []);

  const loadFaces = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.listUserFaces(userId));
      const data = await response.json();

      if (data.success) {
        setFaces(data.faces);
        Speech.speak(`${data.total_faces} saved face${data.total_faces !== 1 ? 's' : ''} found`);
      }
    } catch (error) {
      console.error('Error loading faces:', error);
      Alert.alert('Error', 'Failed to load saved faces');
      Speech.speak('Error loading faces');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Speech.speak('Refreshing face list');
    loadFaces();
  };

  const viewFaceDetails = async (face: SavedFace) => {
    try {
      Speech.speak(`Loading details for ${face.face_name}`);
      const response = await fetch(API_ENDPOINTS.getUserFace(userId, face.face_id));
      const data = await response.json();

      if (data.success) {
        setSelectedFace(face);
        setFaceImage(data.image_base64);
      }
    } catch (error) {
      console.error('Error loading face image:', error);
      Alert.alert('Error', 'Failed to load face image');
    }
  };

  const deleteFace = (face: SavedFace) => {
    Alert.alert(
      'Delete Face',
      `Are you sure you want to delete ${face.face_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                API_ENDPOINTS.deleteUserFace(userId, face.face_id),
                { method: 'DELETE' }
              );
              const data = await response.json();

              if (data.success) {
                Speech.speak(`${face.face_name} deleted`);
                loadFaces();
              } else {
                Alert.alert('Error', 'Failed to delete face');
              }
            } catch (error) {
              console.error('Error deleting face:', error);
              Alert.alert('Error', 'Failed to delete face');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (face: SavedFace) => {
    setSelectedFace(face);
    setNewName(face.face_name);
    setShowEditModal(true);
    Speech.speak(`Edit name for ${face.face_name}`);
  };

  const updateFaceName = async () => {
    if (!selectedFace || !newName.trim()) {
      Alert.alert('Error', 'Please enter a valid name');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('face_name', newName.trim());

      const response = await fetch(
        API_ENDPOINTS.updateUserFace(userId, selectedFace.face_id),
        {
          method: 'PUT',
          body: formData,
        }
      );
      const data = await response.json();

      if (data.success) {
        Speech.speak(`Name updated to ${newName}`);
        setShowEditModal(false);
        loadFaces();
      } else {
        Alert.alert('Error', 'Failed to update name');
      }
    } catch (error) {
      console.error('Error updating face name:', error);
      Alert.alert('Error', 'Failed to update name');
    }
  };

  const renderFaceCard = ({ item }: { item: SavedFace }) => (
    <View style={styles.faceCard}>
      <View style={styles.faceInfo}>
        <Text style={styles.faceName}>{item.face_name}</Text>
        <Text style={styles.faceDate}>
          Added: {new Date(item.added_at).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => viewFaceDetails(item)}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.face_name}`}
          accessibilityHint="View face image and details"
        >
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.face_name}`}
          accessibilityHint="Change person's name"
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => deleteFace(item)}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.face_name}`}
          accessibilityHint="Remove face from saved list"
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={pastelColors.primary} />
        <Text style={styles.loadingText}>Loading saved faces...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Speech.speak('Going back');
            router.back();
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Faces</Text>
      </View>

      {faces.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No saved faces yet</Text>
          <Text style={styles.emptySubtext}>
            Detected faces will appear here after you save them
          </Text>
        </View>
      ) : (
        <FlatList
          data={faces}
          renderItem={renderFaceCard}
          keyExtractor={(item) => item.face_id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={pastelColors.primary}
            />
          }
        />
      )}

      {/* View Face Modal */}
      <Modal
        visible={selectedFace !== null && !showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSelectedFace(null);
          setFaceImage(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedFace?.face_name}</Text>

            {faceImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${faceImage}` }}
                style={styles.faceImage}
                resizeMode="contain"
              />
            ) : (
              <ActivityIndicator size="large" color={pastelColors.primary} />
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setSelectedFace(null);
                setFaceImage(null);
                Speech.speak('Closed');
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Name</Text>

            <Text style={styles.inputLabel}>Person's Name:</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter name"
              autoFocus
              accessibilityLabel="Person's name"
              accessibilityHint="Enter new name for this person"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  Speech.speak('Cancelled');
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={updateFaceName}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: pastelColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: pastelColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: pastelColors.border,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 18,
    color: pastelColors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pastelColors.text,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: pastelColors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: pastelColors.text,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: pastelColors.textSecondary,
    textAlign: 'center',
  },
  listContainer: {
    padding: 15,
  },
  faceCard: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  faceInfo: {
    marginBottom: 12,
  },
  faceName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: pastelColors.text,
    marginBottom: 5,
  },
  faceDate: {
    fontSize: 14,
    color: pastelColors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: pastelColors.primary,
  },
  editButton: {
    backgroundColor: pastelColors.warning,
  },
  deleteButton: {
    backgroundColor: pastelColors.danger,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 15,
    padding: 25,
    width: '85%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pastelColors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  faceImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelColors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: pastelColors.background,
    borderWidth: 1,
    borderColor: pastelColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: pastelColors.textSecondary,
  },
  saveButton: {
    backgroundColor: pastelColors.success,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: pastelColors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

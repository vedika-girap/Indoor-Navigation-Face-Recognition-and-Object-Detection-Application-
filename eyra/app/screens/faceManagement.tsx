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
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Speech from 'expo-speech';
import { DEMO_USER_ID } from '../constants/user';
import { API_ENDPOINTS } from '../config/api';

const { width } = Dimensions.get('window');

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
        const count = data.total_faces || data.faces.length;
        Speech.speak(`${count} saved face${count !== 1 ? 's' : ''} found`);
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

  const renderFaceCard = ({ item, index }: { item: SavedFace; index: number }) => {
    const gradients = [
      ['#667eea', '#764ba2'],
      ['#f093fb', '#f5576c'],
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'],
      ['#fa709a', '#fee140'],
    ];
    const gradient = gradients[index % gradients.length];

    return (
      <View style={styles.faceCard}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardHeader}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={32} color="#fff" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.faceName}>{item.face_name}</Text>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.faceDate}>
                  {new Date(item.added_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => viewFaceDetails(item)}
              accessibilityRole="button"
              accessibilityLabel={`View ${item.face_name}`}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="eye-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>View</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openEditModal(item)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.face_name}`}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => deleteFace(item)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.face_name}`}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Delete</Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading saved faces...</Text>
        </LinearGradient>
      </View>
    );
  }

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
            onPress={() => {
              Speech.speak('Going back');
              router.back();
            }}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saved Faces</Text>
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.refreshButton}
            accessibilityRole="button"
            accessibilityLabel="Refresh list"
          >
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Ionicons name="people" size={20} color="#fff" />
            <Text style={styles.statText}>{faces.length} Faces</Text>
          </View>
        </View>
      </LinearGradient>

      {faces.length === 0 ? (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={['#f093fb', '#f5576c']}
            style={styles.emptyCircle}
          >
            <Ionicons name="person-add-outline" size={48} color="#fff" />
          </LinearGradient>
          <Text style={styles.emptyText}>No Saved Faces Yet</Text>
          <Text style={styles.emptySubtext}>
            Detected faces will appear here after you save them during object detection
          </Text>
        </View>
      ) : (
        <FlatList
          data={faces}
          renderItem={renderFaceCard}
          keyExtractor={(item) => item.face_id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#667eea"
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
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>{selectedFace?.face_name}</Text>
            </LinearGradient>

            <View style={styles.modalBody}>
              {faceImage ? (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${faceImage}` }}
                    style={styles.faceImage}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#667eea" />
                  <Text style={styles.loadingImageText}>Loading image...</Text>
                </View>
              )}

              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={18} color="#667eea" />
                  <Text style={styles.detailLabel}>Added:</Text>
                  <Text style={styles.detailValue}>
                    {selectedFace && new Date(selectedFace.added_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time" size={18} color="#667eea" />
                  <Text style={styles.detailLabel}>Time:</Text>
                  <Text style={styles.detailValue}>
                    {selectedFace && new Date(selectedFace.added_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                setSelectedFace(null);
                setFaceImage(null);
                Speech.speak('Closed');
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.closeButton}
              >
                <Ionicons name="close-circle-outline" size={24} color="#fff" />
                <Text style={styles.closeButtonText}>Close</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#f093fb', '#f5576c']}
              style={styles.modalHeader}
            >
              <Ionicons name="create-outline" size={28} color="#fff" />
              <Text style={styles.modalTitle}>Edit Name</Text>
            </LinearGradient>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Person's Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Enter name"
                  placeholderTextColor="#999"
                  autoFocus
                  accessibilityLabel="Person's name"
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  Speech.speak('Cancelled');
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.modalButtonWrapper}
              >
                <View style={styles.cancelButton}>
                  <Ionicons name="close-circle-outline" size={20} color="#666" />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={updateFaceName}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
                style={styles.modalButtonWrapper}
              >
                <LinearGradient
                  colors={['#50c878', '#3bb55f']}
                  style={styles.saveButton}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  loadingGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
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
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
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
    flex: 1,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  faceCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardGradient: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  faceName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  faceDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonContent: {
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
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
  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#f5f7fa',
  },
  faceImage: {
    width: '100%',
    height: 320,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingImageText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  detailsCard: {
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  detailValue: {
    fontSize: 15,
    color: '#7f8c8d',
    flex: 1,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
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
  cancelButton: {
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
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

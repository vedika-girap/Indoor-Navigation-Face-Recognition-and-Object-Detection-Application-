import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DEMO_USER_ID } from '../constants/user';
import { calculateRoute, getRoomImage, type RoomWaypoint } from '../services/indoorNavigationService';

const pastelColors = {
  background: '#F0F4F8',
  cardBackground: '#FFFFFF',
  primary: '#4A90E2',
  secondary: '#7B68EE',
  success: '#50C878',
  warning: '#FFB74D',
  text: '#2C3E50',
  textSecondary: '#7F8C8D',
  border: '#E0E6ED',
};

export default function NavigationScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const map = params.map ? JSON.parse(params.map as string) : null;
  const allLabels = params.labels ? JSON.parse(params.labels as string) : [];
  
  const [sourceRoom, setSourceRoom] = useState('');
  const [destinationRoom, setDestinationRoom] = useState('');
  const [route, setRoute] = useState<RoomWaypoint[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [waypointImages, setWaypointImages] = useState<{ [key: string]: string }>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);
  
  const userId = DEMO_USER_ID;

  const handleCalculateRoute = async () => {
    if (!sourceRoom || !destinationRoom) {
      Alert.alert('Selection Required', 'Please select both source and destination rooms');
      return;
    }

    if (sourceRoom === destinationRoom) {
      Alert.alert('Invalid Selection', 'Source and destination must be different');
      return;
    }

    try {
      setCalculating(true);
      const routeData = await calculateRoute(userId, map.map_id, sourceRoom, destinationRoom);
      
      if (routeData.success) {
        setRoute(routeData.route);
        setCurrentStep(0);
        
        // Load images for waypoints
        await loadWaypointImages(routeData.route);
        
        Alert.alert(
          'Route Calculated',
          `Found route with ${routeData.total_waypoints} waypoints`,
          [{ text: 'Start Navigation', onPress: () => {} }]
        );
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      Alert.alert('Error', 'Failed to calculate route. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const loadWaypointImages = async (waypoints: RoomWaypoint[]) => {
    setLoadingImages(true);
    const images: { [key: string]: string } = {};
    
    for (const waypoint of waypoints) {
      if (waypoint.has_image) {
        try {
          const imageUri = await getRoomImage(userId, map.map_id, waypoint.room_label);
          if (imageUri) {
            images[waypoint.room_label] = imageUri;
          }
        } catch (error) {
          console.log(`Failed to load image for ${waypoint.room_label}`);
        }
      }
    }
    
    setWaypointImages(images);
    setLoadingImages(false);
  };

  const handleNextStep = () => {
    if (currentStep < route.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      Alert.alert(
        'Destination Reached',
        'You have reached your destination!',
        [
          { text: 'New Route', onPress: handleReset },
          { text: 'Done', onPress: () => router.back() },
        ]
      );
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReset = () => {
    setRoute([]);
    setCurrentStep(0);
    setSourceRoom('');
    setDestinationRoom('');
    setWaypointImages({});
  };

  if (!map) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No map data provided</Text>
      </View>
    );
  }

  const currentWaypoint = route[currentStep];
  const progress = route.length > 0 ? ((currentStep + 1) / route.length) * 100 : 0;

  const RoomPickerModal = ({ 
    visible, 
    onClose, 
    onSelect, 
    selectedValue, 
    title 
  }: { 
    visible: boolean; 
    onClose: () => void; 
    onSelect: (value: string) => void; 
    selectedValue: string;
    title: string;
  }) => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={allLabels}
            keyExtractor={(item: any) => item.label}
            renderItem={({ item }: { item: any }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  selectedValue === item.label && styles.modalItemSelected
                ]}
                onPress={() => {
                  onSelect(item.label);
                  onClose();
                }}
              >
                <Text style={[
                  styles.modalItemText,
                  selectedValue === item.label && styles.modalItemTextSelected
                ]}>
                  {item.label.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <RoomPickerModal
        visible={showSourcePicker}
        onClose={() => setShowSourcePicker(false)}
        onSelect={setSourceRoom}
        selectedValue={sourceRoom}
        title="Select Starting Room"
      />
      <RoomPickerModal
        visible={showDestPicker}
        onClose={() => setShowDestPicker(false)}
        onSelect={setDestinationRoom}
        selectedValue={destinationRoom}
        title="Select Destination Room"
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Indoor Navigation</Text>
          <Text style={styles.subtitle}>{map.map_name}</Text>
        </View>

        {route.length === 0 ? (
          // Route Selection UI
          <View style={styles.selectionContainer}>
            <Text style={styles.sectionTitle}>Select Your Route</Text>

            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Starting Room:</Text>
              <TouchableOpacity 
                style={styles.pickerButton}
                onPress={() => setShowSourcePicker(true)}
              >
                <Text style={sourceRoom ? styles.pickerButtonTextSelected : styles.pickerButtonText}>
                  {sourceRoom ? sourceRoom.replace('_', ' ').toUpperCase() : 'Select starting room...'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Destination Room:</Text>
              <TouchableOpacity 
                style={styles.pickerButton}
                onPress={() => setShowDestPicker(true)}
              >
                <Text style={destinationRoom ? styles.pickerButtonTextSelected : styles.pickerButtonText}>
                  {destinationRoom ? destinationRoom.replace('_', ' ').toUpperCase() : 'Select destination room...'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.calculateButton,
                (!sourceRoom || !destinationRoom || calculating) &&
                  styles.calculateButtonDisabled,
              ]}
              onPress={handleCalculateRoute}
              disabled={!sourceRoom || !destinationRoom || calculating}
            >
              {calculating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.calculateButtonText}>Calculate Route</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.liveNavButton,
                (!sourceRoom || !destinationRoom) && styles.liveNavButtonDisabled,
              ]}
              onPress={() => {
                if (!sourceRoom || !destinationRoom) {
                  Alert.alert('Selection Required', 'Please select source and destination first');
                  return;
                }
                router.push({
                  pathname: '/screens/liveNavigationScreen' as any,
                  params: {
                    map: JSON.stringify(map),
                    source: sourceRoom,
                    destination: destinationRoom,
                  }
                });
              }}
              disabled={!sourceRoom || !destinationRoom}
            >
              <Text style={styles.liveNavButtonText}>🎥 Start Live Navigation with Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Navigation UI
          <View style={styles.navigationContainer}>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Step {currentStep + 1} of {route.length}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>

            {currentWaypoint && (
              <View style={styles.waypointCard}>
                <Text style={styles.waypointLabel}>
                  {currentWaypoint.room_label.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={styles.instruction}>{currentWaypoint.instruction}</Text>

                {loadingImages ? (
                  <View style={styles.imagePlaceholder}>
                    <ActivityIndicator size="large" color={pastelColors.primary} />
                    <Text style={styles.loadingText}>Loading image...</Text>
                  </View>
                ) : waypointImages[currentWaypoint.room_label] ? (
                  <Image
                    source={{ uri: waypointImages[currentWaypoint.room_label] }}
                    style={styles.waypointImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderText}>
                      No reference image available
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  styles.prevButton,
                  currentStep === 0 && styles.navButtonDisabled,
                ]}
                onPress={handlePreviousStep}
                disabled={currentStep === 0}
              >
                <Text style={styles.navButtonText}>← Previous</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navButton, styles.nextButton]}
                onPress={handleNextStep}
              >
                <Text style={styles.navButtonText}>
                  {currentStep === route.length - 1 ? 'Finish' : 'Next →'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>New Route</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: pastelColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: pastelColors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pastelColors.text,
  },
  subtitle: {
    fontSize: 16,
    color: pastelColors.textSecondary,
    marginTop: 5,
  },
  selectionContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: pastelColors.text,
    marginBottom: 20,
  },
  pickerContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelColors.text,
    marginBottom: 8,
  },
  pickerButton: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: pastelColors.border,
    padding: 15,
  },
  pickerButtonText: {
    color: pastelColors.textSecondary,
    fontSize: 16,
  },
  pickerButtonTextSelected: {
    color: pastelColors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: pastelColors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: pastelColors.text,
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: pastelColors.border,
    paddingHorizontal: 20,
  },
  modalItemSelected: {
    backgroundColor: pastelColors.primary + '20',
  },
  modalItemText: {
    fontSize: 16,
    color: pastelColors.text,
  },
  modalItemTextSelected: {
    color: pastelColors.primary,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 15,
    backgroundColor: pastelColors.textSecondary,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerWrapper: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: pastelColors.border,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  calculateButton: {
    backgroundColor: pastelColors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  calculateButtonDisabled: {
    backgroundColor: pastelColors.textSecondary,
    opacity: 0.5,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navigationContainer: {
    padding: 20,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    color: pastelColors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: pastelColors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: pastelColors.success,
  },
  waypointCard: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: pastelColors.border,
  },
  waypointLabel: {
    fontSize: 22,
    fontWeight: 'bold',
    color: pastelColors.text,
    marginBottom: 10,
  },
  instruction: {
    fontSize: 16,
    color: pastelColors.textSecondary,
    marginBottom: 15,
  },
  waypointImage: {
    width: '100%',
    height: 250,
    borderRadius: 10,
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
    borderRadius: 10,
    backgroundColor: pastelColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: pastelColors.textSecondary,
    fontSize: 14,
  },
  loadingText: {
    color: pastelColors.textSecondary,
    marginTop: 10,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  navButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  prevButton: {
    backgroundColor: pastelColors.textSecondary,
  },
  nextButton: {
    backgroundColor: pastelColors.success,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: pastelColors.secondary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  liveNavButton: {
    backgroundColor: '#7B68EE',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  liveNavButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#B0B0B0',
  },
  liveNavButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});

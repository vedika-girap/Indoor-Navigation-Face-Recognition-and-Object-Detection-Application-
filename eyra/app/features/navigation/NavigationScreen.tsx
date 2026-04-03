import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import accessibilityService from '../../services/accessibilityService';
import verbosityManager from '../../services/verbosityManager';
import actionHistoryManager from '../../services/actionHistoryManager';
import offlineManager from '../../services/offlineManager';
import errorRecoveryService from '../../services/errorRecoveryService';
import { calculateRoute, getRoomImage, type RoomWaypoint } from '../../services/indoorNavigationService';
import { listFloorMaps, type FloorMap } from '../../services/floorMapService';
import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';
import { DEMO_USER_ID } from '../../constants/user';

const { width, height } = Dimensions.get('window');

interface NavigationState {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentInstruction: string;
  distanceRemaining: number;
  estimatedTime: number;
}

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Navigation state
  const [selectedMap, setSelectedMap] = useState<FloorMap | null>(null);
  const [sourceRoom, setSourceRoom] = useState('');
  const [destinationRoom, setDestinationRoom] = useState('');
  const [route, setRoute] = useState<RoomWaypoint[]>([]);
  const [navState, setNavState] = useState<NavigationState>({
    isActive: false,
    currentStep: 0,
    totalSteps: 0,
    currentInstruction: '',
    distanceRemaining: 0,
    estimatedTime: 0,
  });

  // UI state
  const [availableMaps, setAvailableMaps] = useState<FloorMap[]>([]);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showRouteSetup, setShowRouteSetup] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Memoize filtered rooms for performance
  const destinationRooms = useMemo(() => {
    return availableRooms.filter((room) => room !== sourceRoom);
  }, [availableRooms, sourceRoom]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    initializeNavigation();
  }, []);

  const initializeNavigation = async () => {
    actionHistoryManager.addBreadcrumb('navigation', 'Indoor Navigation');
    
    accessibilityService.speak(
      'Indoor navigation ready. Select a map and set your destination to begin turn by turn directions.',
      2,
      false
    );

    await loadAvailableMaps();
  };

  const loadAvailableMaps = async () => {
    try {
      const cacheKey = `maps_${DEMO_USER_ID}`;
      
      if (offlineManager.isOfflineMode()) {
        const cached = await offlineManager.getCachedData(cacheKey);
        if (cached) {
          setAvailableMaps(cached);
          console.log('Loaded cached maps:', cached.length);
          accessibilityService.speak('Using cached maps. Offline mode active.', 3);
          return;
        } else {
          accessibilityService.speak('No cached maps. Connect to internet to download.', 2);
          return;
        }
      }

      const maps = await listFloorMaps(DEMO_USER_ID);
      console.log('Loaded maps from server:', maps.length, maps);
      setAvailableMaps(maps);
      await offlineManager.cacheData(cacheKey, maps, 604800000);
    } catch (error) {
      console.error('Failed to load maps:', error);
      await errorRecoveryService.handleError('Load maps', error, 'high', true);
    }
  };

  const extractRoomsFromMap = useCallback((map: FloorMap): string[] => {
    // Extract unique room labels from map data
    const rooms = new Set<string>();
    
    if (map.metadata?.labels) {
      map.metadata.labels.forEach((label: any) => {
        // Check both 'label' and 'room_label' fields (backend uses 'label')
        const roomName = label.label || label.room_label;
        if (roomName) {
          // Clean room name: remove segments, normalize
          let cleanName = roomName;
          
          // Remove segment numbers (e.g., "Room 101_seg1" -> "Room 101")
          cleanName = cleanName.replace(/_seg\d+$/i, '');
          cleanName = cleanName.replace(/segment\s*\d+/gi, '');
          
          // Normalize spaces and trim
          cleanName = cleanName.replace(/\s+/g, ' ').trim();
          
          // Only add if not empty
          if (cleanName) {
            rooms.add(cleanName);
          }
        }
      });
    }
    
    return Array.from(rooms).sort();
  }, []);

  const handleMapSelect = useCallback((map: FloorMap) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMap(map);
    setShowMapPicker(false);
    
    // Extract available rooms
    const rooms = extractRoomsFromMap(map);
    console.log('Extracted rooms:', rooms);
    console.log('Map metadata:', map.metadata);
    setAvailableRooms(rooms);
    
    if (rooms.length === 0) {
      accessibilityService.speak(
        `Selected ${map.map_name || 'map'}. Warning: No rooms found in this map. Please ensure the map has been processed with room labels.`,
        2,
        false
      );
    } else {
      accessibilityService.speak(
        `Selected ${map.map_name || 'map'}. ${rooms.length} rooms available. Now select source and destination.`,
        2,
        false
      );
    }
    accessibilityService.triggerHaptic('success');
  }, [extractRoomsFromMap]);

  const calculateNavigationRoute = async () => {
    if (!selectedMap || !sourceRoom || !destinationRoom) {
      Alert.alert('Missing Information', 'Please select map, source, and destination.');
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCalculating(true);
    
    try {
      accessibilityService.speak('Calculating optimal route...', 2, false);
      
      const calculatedRoute = await calculateRoute(
        DEMO_USER_ID,
        selectedMap.map_id,
        sourceRoom,
        destinationRoom
      );

      if (calculatedRoute && calculatedRoute.route && calculatedRoute.route.length > 0) {
        setRoute(calculatedRoute.route);
        setNavState({
          isActive: false,
          currentStep: 0,
          totalSteps: calculatedRoute.route.length,
          currentInstruction: calculatedRoute.route[0]?.instruction || 'Start navigation',
          distanceRemaining: calculatedRoute.route.length * 5, // Estimate 5m per waypoint
          estimatedTime: calculatedRoute.route.length * 30, // Estimate 30s per waypoint
        });
        
        setShowRouteSetup(false);
        
        accessibilityService.speak(
          `Route calculated. ${calculatedRoute.route.length} steps. Distance approximately ${calculatedRoute.route.length * 5} meters. Double tap to start navigation.`,
          2,
          false
        );
        accessibilityService.triggerHaptic('success');
      } else {
        accessibilityService.speak('No route found between these locations.', 2);
      }
    } catch (error) {
      await errorRecoveryService.handleError('Calculate route', error, 'high', true);
    } finally {
      setIsCalculating(false);
    }
  };

  const startNavigation = () => {
    if (route.length === 0) return;
    
    setIsNavigating(true);
    setNavState((prev) => ({ ...prev, isActive: true }));
    
    accessibilityService.speak(
      `Navigation started. ${route[0]?.instruction || 'Proceed forward'}`,
      1, // Critical priority
      false
    );
    accessibilityService.triggerHaptic('success');
    
    actionHistoryManager.recordAction({
      type: 'navigation_start',
      description: `Navigation from ${sourceRoom} to ${destinationRoom}`,
      reversible: false,
    });
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setNavState((prev) => ({ ...prev, isActive: false }));
    
    accessibilityService.speak('Navigation stopped.', 2, false);
    accessibilityService.triggerHaptic('warning');
  };

  const handleNextStep = () => {
    if (navState.currentStep >= route.length - 1) {
      // Arrived at destination
      setIsNavigating(false);
      setNavState((prev) => ({ ...prev, isActive: false }));
      
      accessibilityService.speak(
        `You have arrived at ${destinationRoom}. Navigation complete.`,
        1,
        false
      );
      accessibilityService.triggerHaptic('success');
      return;
    }

    const nextStep = navState.currentStep + 1;
    const nextWaypoint = route[nextStep];
    
    setNavState((prev) => ({
      ...prev,
      currentStep: nextStep,
      currentInstruction: nextWaypoint?.instruction || 'Continue',
      distanceRemaining: (route.length - nextStep) * 5,
    }));

    accessibilityService.speak(nextWaypoint?.instruction || 'Continue forward', 1, false);
    accessibilityService.triggerHaptic('buttonPress');
  };

  const handleBack = () => {
    if (isNavigating) {
      Alert.alert(
        'Navigation Active',
        'Stop navigation before going back?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop & Exit',
            style: 'destructive',
            onPress: () => {
              stopNavigation();
              router.back();
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="navigate-outline" size={64} color="#667eea" />
        <Text style={styles.permissionTitle}>Camera Needed for Navigation</Text>
        <Text style={styles.permissionText}>
          Visual positioning requires camera access to match your location.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#f093fb', '#f5576c']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Indoor Navigation</Text>
          <View style={styles.backButton} />
        </View>

        {isNavigating && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(navState.currentStep / navState.totalSteps) * 100}%` },
              ]}
            />
          </View>
        )}
      </LinearGradient>

      {showRouteSetup ? (
        <ScrollView style={styles.setupContainer} contentContainerStyle={styles.setupContent}>
          {/* Map Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Select Floor Map</Text>
            {selectedMap ? (
              <TouchableOpacity
                style={styles.selectedCard}
                onPress={() => setShowMapPicker(true)}
              >
                <Ionicons name="map" size={24} color="#667eea" />
                <Text style={styles.selectedText}>{selectedMap.map_name || 'Selected Map'}</Text>
                <Ionicons name="chevron-forward" size={20} color="#667eea" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowMapPicker(true)}
              >
                <Text style={styles.selectButtonText}>Choose Map</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Source Selection */}
          {selectedMap && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Select Starting Point</Text>
              {availableRooms.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="alert-circle-outline" size={32} color="#ff6b6b" />
                  <Text style={styles.emptyStateText}>
                    No rooms found in this map. Please process the map with room labels first.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {availableRooms.map((room) => (
                    <TouchableOpacity
                      key={room}
                      style={[
                        styles.roomChip,
                        sourceRoom === room && styles.roomChipSelected,
                      ]}
                      onPress={() => {
                        setSourceRoom(room);
                        accessibilityService.speak(`Starting from ${room}`, 3);
                      }}
                    >
                      <Text
                        style={[
                          styles.roomChipText,
                          sourceRoom === room && styles.roomChipTextSelected,
                        ]}
                      >
                        {room}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Destination Selection */}
          {sourceRoom && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Select Destination</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {destinationRooms.map((room) => (
                  <TouchableOpacity
                      key={room}
                      style={[
                        styles.roomChip,
                        destinationRoom === room && styles.roomChipSelected,
                      ]}
                      onPress={() => {
                        setDestinationRoom(room);
                        accessibilityService.speak(`Destination set to ${room}`, 3);
                      }}
                    >
                      <Text
                        style={[
                          styles.roomChipText,
                          destinationRoom === room && styles.roomChipTextSelected,
                        ]}
                      >
                        {room}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          )}

          {/* Calculate Button */}
          {selectedMap && sourceRoom && destinationRoom && (
            <TouchableOpacity
              style={styles.calculateButton}
              onPress={calculateNavigationRoute}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.calculateButtonText}>Calculate Route</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <View style={styles.navigationContainer}>
          {/* Route Overview */}
          <View style={styles.routeCard}>
            <View style={styles.routeHeader}>
              <View style={styles.routePoints}>
                <View style={styles.routePoint}>
                  <Ionicons name="location" size={20} color="#50c878" />
                  <Text style={styles.routeLabel}>{sourceRoom}</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#7f8c8d" />
                <View style={styles.routePoint}>
                  <Ionicons name="flag" size={20} color="#f5576c" />
                  <Text style={styles.routeLabel}>{destinationRoom}</Text>
                </View>
              </View>
            </View>

            <View style={styles.routeStats}>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatValue}>{navState.totalSteps}</Text>
                <Text style={styles.routeStatLabel}>Steps</Text>
              </View>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatValue}>
                  {navState.distanceRemaining}m
                </Text>
                <Text style={styles.routeStatLabel}>Distance</Text>
              </View>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatValue}>
                  {Math.ceil(navState.estimatedTime / 60)}min
                </Text>
                <Text style={styles.routeStatLabel}>Est. Time</Text>
              </View>
            </View>
          </View>

          {/* Current Instruction */}
          {isNavigating && (
            <BlurView intensity={80} style={styles.instructionCard}>
              <Ionicons name="navigate-circle" size={32} color="#667eea" />
              <Text style={styles.instructionText}>{navState.currentInstruction}</Text>
              <Text style={styles.stepCounter}>
                Step {navState.currentStep + 1} of {navState.totalSteps}
              </Text>
            </BlurView>
          )}

          {/* Control Buttons */}
          <View style={styles.controlsContainer}>
            {!isNavigating ? (
              <TouchableOpacity style={styles.startButton} onPress={startNavigation}>
                <Ionicons name="play" size={28} color="#fff" />
                <Text style={styles.startButtonText}>Start Navigation</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.nextButton} onPress={handleNextStep}>
                  <Ionicons name="arrow-forward-circle" size={28} color="#fff" />
                  <Text style={styles.nextButtonText}>Next Step</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopButton} onPress={stopNavigation}>
                  <Ionicons name="stop-circle" size={28} color="#fff" />
                  <Text style={styles.stopButtonText}>Stop</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Recalculate Button */}
          <TouchableOpacity
            style={styles.recalculateButton}
            onPress={() => setShowRouteSetup(true)}
          >
            <Ionicons name="refresh" size={20} color="#667eea" />
            <Text style={styles.recalculateText}>Change Route</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map Picker Modal */}
      {showMapPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Floor Map</Text>
              <TouchableOpacity onPress={() => setShowMapPicker(false)}>
                <Ionicons name="close" size={28} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {availableMaps.map((map) => (
                <TouchableOpacity
                  key={map.map_id}
                  style={styles.mapOption}
                  onPress={() => handleMapSelect(map)}
                >
                  <Ionicons name="map-outline" size={24} color="#667eea" />
                  <Text style={styles.mapOptionText}>{map.map_name || 'Unnamed Map'}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#7f8c8d" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f7fa',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 24,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  setupContainer: {
    flex: 1,
  },
  setupContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 12,
  },
  selectButton: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  roomChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#e0e6ed',
  },
  roomChipSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  roomChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  roomChipTextSelected: {
    color: '#fff',
  },
  calculateButton: {
    backgroundColor: '#50c878',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  navigationContainer: {
    flex: 1,
    padding: 20,
  },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeHeader: {
    marginBottom: 16,
  },
  routePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 8,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e6ed',
  },
  routeStat: {
    alignItems: 'center',
  },
  routeStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
  },
  routeStatLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  instructionCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  instructionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  stepCounter: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#50c878',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#667eea',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  stopButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ff6b6b',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  recalculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
  },
  recalculateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginLeft: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.7,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
  },
  mapOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  mapOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

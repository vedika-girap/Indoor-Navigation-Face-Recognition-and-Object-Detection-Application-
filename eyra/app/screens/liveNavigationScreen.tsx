import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { DEMO_USER_ID } from '../constants/user';
import { API_ENDPOINTS } from '../config/api';
import { OfflineNavigationService } from '../services/offlineNavigationService';
import { AppColors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface PositionMatch {
  waypoint_id: string;
  room_label: string;
  position_description: string;
  match_score: number;
  good_matches: number;
  total_matches: number;
}

export default function LiveNavigationScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const map = params.map ? JSON.parse(params.map as string) : null;
  const sourceRoom = params.source as string;
  const destinationRoom = params.destination as string;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [isMatching, setIsMatching] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<PositionMatch | null>(null);
  const [matchingInterval, setMatchingInterval] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineCached, setOfflineCached] = useState(false);
  const [currentWaypointId, setCurrentWaypointId] = useState<string | null>(null);
  const [navigationRoute, setNavigationRoute] = useState<any>(null);
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const announcedWaypointsRef = useRef<Set<string>>(new Set());
  
  const cameraRef = useRef<any>(null);
  const userId = DEMO_USER_ID;

  useEffect(() => {
    if (!map) {
      Alert.alert('Error', 'Map data not found');
      router.back();
    } else {
      // Check if offline cache exists
      checkOfflineCache();
      // Load available waypoints for debugging
      loadWaypointsInfo();
    }
  }, []);

  const checkOfflineCache = async () => {
    try {
      const cached = await OfflineNavigationService.getCachedWaypoints(map.map_id);
      if (cached && cached.length > 0) {
        setOfflineCached(true);
        console.log('Offline cache available:', cached.length, 'waypoints');
      }
    } catch (error) {
      console.log('No offline cache available');
    }
  };

  const loadWaypointsInfo = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.listWaypoints(userId, map.map_id));
      const result = await response.json();
      
      if (result.success) {
        console.log('=== WAYPOINTS AVAILABLE ===');
        console.log(`Total: ${result.total_waypoints} waypoints`);
        console.log('By type:', result.by_type);
        console.log('Waypoints:', result.waypoints.map((wp: any) => ({
          id: wp.waypoint_id,
          room: wp.room_label,
          images: wp.images?.length || 0
        })));
        console.log('==========================');
      } else {
        console.log('No waypoints found for this map');
      }
    } catch (error) {
      console.error('Failed to load waypoints info:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (matchingInterval) {
        clearInterval(matchingInterval);
      }
      Speech.stop();
    };
  }, [matchingInterval]);

  const speak = (text: string) => {
    Speech.speak(text, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const captureAndMatchPosition = async () => {
    if (!cameraRef.current || isMatching) return;

    try {
      setIsMatching(true);

      // Take photo with optimized quality
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,  // Reduced from 0.7 for faster upload
        base64: true,  // Enable base64 for offline matching
        skipProcessing: true,  // Skip unnecessary processing
      });

      let matchSuccess = false;

      // Try online matching first
      if (!isOfflineMode) {
        try {
          // Create FormData
          const formData = new FormData();
          formData.append('user_id', userId);
          formData.append('map_id', map.map_id);
          
          // Add expected waypoint if we have current position
          if (currentWaypointId) {
            formData.append('expected_waypoint', currentWaypointId);
          }
          
          const file = {
            uri: photo.uri,
            type: 'image/jpeg',
            name: 'current_position.jpg',
          };
          formData.append('current_image', file as any);

          // Send to backend for matching - USE ENHANCED ENDPOINT
          const response = await fetch(API_ENDPOINTS.matchPositionEnhanced, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
            },
          });

          const result = await response.json();
          
          console.log('Enhanced match result:', result);

          if (result.success && result.matched) {
            const position = result.position;
            setCurrentPosition(position);
            setCurrentWaypointId(position.waypoint_id);
            matchSuccess = true;
            
            // Only announce significant position changes
            const hasPositionChanged = !currentPosition || 
                                       currentPosition.waypoint_id !== position.waypoint_id;
            
            if (hasPositionChanged) {
              const roomName = position.room_label.replace(/_/g, ' ');
              const posDesc = position.position_description || '';
              const confidenceLevel = position.match_score >= 70 ? 'high confidence' : 
                                      position.match_score >= 50 ? 'medium confidence' : 
                                      'low confidence';
              
              // Get navigation instruction from waypoint metadata if available
              let instruction = '';
              if (position.waypoint_type === 'CORNER') {
                instruction = 'Approaching a corner.';
              } else if (position.waypoint_type === 'DOOR') {
                instruction = 'Approaching a door.';
              } else if (position.waypoint_type === 'JUNCTION') {
                instruction = 'Approaching a junction.';
              }
              
              // Only announce waypoint instructions once
              if (!announcedWaypointsRef.current.has(position.waypoint_id)) {
                const announcement = `${instruction} You are at ${roomName}. ${posDesc}. ${confidenceLevel}.`;
                speak(announcement);
                announcedWaypointsRef.current.add(position.waypoint_id);
                setCurrentInstruction(instruction || posDesc);
              }
            }
            
            console.log('Position matched (enhanced):', position);
          } else {
            console.log('No enhanced match:', result.message);
          }
        } catch (onlineError) {
          console.log('Online matching failed, trying offline...', onlineError);
          setIsOfflineMode(true);
        }
      }

      // Try offline matching if online failed or in offline mode
      if (!matchSuccess && offlineCached && photo.base64) {
        try {
          const offlineResult = await OfflineNavigationService.matchPositionOffline(
            photo.base64,
            map.map_id
          );

          if (offlineResult && offlineResult.waypoint && offlineResult.confidence > 0.3) {
            const position = {
              waypoint_id: offlineResult.waypoint.waypoint_id,
              room_label: offlineResult.waypoint.room_label,
              position_description: offlineResult.waypoint.instruction || 'Offline match',
              match_score: Math.round(offlineResult.confidence * 100),
              good_matches: 0,
              total_matches: 0,
            };
            
            setCurrentPosition(position);
            matchSuccess = true;

            const hasPositionChanged = !currentPosition || 
                                       currentPosition.room_label !== position.room_label;
            
            if (hasPositionChanged) {
              const roomName = position.room_label.replace('_', ' ');
              const announcement = `You are at ${roomName}. Offline mode.`;
              speak(announcement);
            }
            
            console.log('Position matched (offline):', position);
          }
        } catch (offlineError) {
          console.log('Offline matching failed:', offlineError);
        }
      }

      if (!matchSuccess) {
        console.log('No match found in online or offline mode');
        // Don't announce every failed match during navigation
      }

    } catch (error) {
      console.error('Error matching position:', error);
      if (!isNavigating) {
        speak('Error detecting position');
      }
    } finally {
      setIsMatching(false);
    }
  };

  const startNavigation = () => {
    if (isNavigating) {
      // Stop navigation
      if (matchingInterval) {
        clearInterval(matchingInterval);
        setMatchingInterval(null);
      }
      setIsNavigating(false);
      speak('Navigation stopped');
    } else {
      // Start navigation
      speak(`Starting navigation from ${sourceRoom.replace('_', ' ')} to ${destinationRoom.replace('_', ' ')}`);
      setIsNavigating(true);
      
      // Start periodic position matching (every 4 seconds - optimized interval)
      const interval = setInterval(() => {
        captureAndMatchPosition();
      }, 4000);
      
      setMatchingInterval(interval);
      
      // Initial position check
      captureAndMatchPosition();
    }
  };

  const manualPositionCheck = () => {
    speak('Checking your position');
    Speech.speak('Checking your current position', { rate: 0.95 });
    captureAndMatchPosition();
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required for navigation</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
          accessibilityHint="Tap to allow camera access for indoor navigation"
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        {/* Navigation Info Overlay */}
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.headerText}>{map?.map_name || 'Navigation'}</Text>
            <Text style={styles.routeText}>
              {sourceRoom} → {destinationRoom}
            </Text>
            {isOfflineMode && (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineBadgeText}>📵 Offline Mode</Text>
              </View>
            )}
            {offlineCached && !isOfflineMode && (
              <Text style={styles.cachedText}>✓ Offline cache available</Text>
            )}
          </View>

          {/* Current Instruction Display - Prominent at top */}
          {currentInstruction && (
            <View 
              style={styles.instructionCard}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={currentInstruction}
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.instructionIcon}>🧭</Text>
              <Text style={styles.instructionText}>{currentInstruction}</Text>
            </View>
          )}

          {/* Current Position Display */}
          {currentPosition && (
            <View 
              style={styles.positionCard}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`Current position: ${currentPosition.room_label.replace(/_/g, ' ')}. ${currentPosition.position_description}. Match confidence: ${currentPosition.match_score} percent${currentPosition.match_score < 50 ? '. Warning: Low confidence' : ''}`}
            >
              <Text style={styles.positionLabel}>Current Position:</Text>
              <Text style={styles.positionRoom}>{currentPosition.room_label.replace(/_/g, ' ')}</Text>
              <Text style={styles.positionDesc}>{currentPosition.position_description}</Text>
              <Text style={styles.confidence}>
                Confidence: {currentPosition.match_score}%
              </Text>
              <Text style={styles.waypointId}>
                Waypoint: {currentPosition.waypoint_id || 'Unknown'}
              </Text>
              {currentPosition.match_score < 50 && (
                <Text style={styles.warning}>⚠️ Low confidence</Text>
              )}
            </View>
          )}
          
          {/* No Position Found Message */}
          {!currentPosition && !isMatching && isNavigating && (
            <View style={styles.noPositionCard}>
              <Text style={styles.noPositionText}>
                📍 Searching for position...
              </Text>
              <Text style={styles.noPositionHint}>
                Point camera at a waypoint you captured
              </Text>
            </View>
          )}

          {/* Matching Indicator */}
          {isMatching && (
            <View 
              style={styles.matchingIndicator}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel="Detecting your position, please wait"
              accessibilityLiveRegion="polite"
            >
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.matchingText}>Detecting position...</Text>
            </View>
          )}

          {/* Controls at bottom */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[
                styles.navButton,
                isNavigating && styles.navButtonActive
              ]}
              onPress={startNavigation}
              disabled={isMatching}
              accessibilityRole="button"
              accessibilityLabel={isNavigating ? 'Stop navigation' : 'Start navigation'}
              accessibilityHint={isNavigating ? 'Tap to stop automatic position tracking' : 'Tap to begin automatic position tracking every 4 seconds'}
              accessibilityState={{ disabled: isMatching, busy: isMatching }}
            >
              <Text style={styles.navButtonText}>
                {isNavigating ? 'Stop Navigation' : 'Start Navigation'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manualButton}
              onPress={manualPositionCheck}
              disabled={isMatching || isNavigating}
              accessibilityRole="button"
              accessibilityLabel="Check current position"
              accessibilityHint="Tap to immediately detect your current location"
              accessibilityState={{ disabled: isMatching || isNavigating }}
            >
              <Text style={styles.manualButtonText}>Check Position</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (matchingInterval) clearInterval(matchingInterval);
                Speech.stop();
                Speech.speak('Returning to navigation setup');
                setTimeout(() => router.back(), 500);
              }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Return to navigation setup screen"
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.shadow,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    backgroundColor: AppColors.overlayBackground,
    padding: 20,
    paddingTop: 50,
  },
  headerText: {
    color: AppColors.textLight,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  routeText: {
    color: AppColors.textLight,
    fontSize: 16,
    opacity: 0.9,
  },
  offlineBadge: {
    backgroundColor: AppColors.warning,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  offlineBadgeText: {
    color: AppColors.textLight,
    fontSize: 12,
    fontWeight: 'bold',
  },
  cachedText: {
    color: AppColors.online,
    fontSize: 12,
    marginTop: 8,
  },
  positionCard: {
    backgroundColor: AppColors.detectionLabel,
    margin: 20,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  instructionCard: {
    backgroundColor: AppColors.navigationActive,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: AppColors.textLight,
  },
  instructionIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  instructionText: {
    color: AppColors.textLight,
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    lineHeight: 28,
  },
  positionLabel: {
    color: AppColors.textLight,
    fontSize: 14,
    marginBottom: 5,
    opacity: 0.9,
  },
  positionRoom: {
    color: AppColors.textLight,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  positionDesc: {
    color: AppColors.textLight,
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  confidence: {
    color: AppColors.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  waypointId: {
    color: AppColors.textLight,
    fontSize: 12,
    marginTop: 5,
    opacity: 0.8,
    fontFamily: 'monospace',
  },
  warning: {
    color: AppColors.warningLight,
    fontSize: 12,
    marginTop: 5,
  },
  noPositionCard: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: AppColors.warning,
  },
  noPositionText: {
    color: AppColors.textLight,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noPositionHint: {
    color: AppColors.textLight,
    fontSize: 14,
    opacity: 0.9,
    textAlign: 'center',
  },
  matchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.overlayBackground,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'center',
  },
  matchingText: {
    color: AppColors.textLight,
    fontSize: 14,
    marginLeft: 10,
  },
  controls: {
    backgroundColor: AppColors.overlayBackground,
    padding: 20,
    paddingBottom: 40,
  },
  navButton: {
    backgroundColor: AppColors.navigationActive,
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 12,
    alignItems: 'center',
  },
  navButtonActive: {
    backgroundColor: AppColors.navigationInactive,
  },
  navButtonText: {
    color: AppColors.textLight,
    fontSize: 18,
    fontWeight: 'bold',
  },
  manualButton: {
    backgroundColor: AppColors.primaryLight,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 12,
    alignItems: 'center',
  },
  manualButtonText: {
    color: AppColors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: AppColors.textLight,
    fontSize: 16,
  },
  permissionText: {
    color: AppColors.textLight,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 30,
  },
  button: {
    backgroundColor: AppColors.primaryLight,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
  },
  buttonText: {
    color: AppColors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
});

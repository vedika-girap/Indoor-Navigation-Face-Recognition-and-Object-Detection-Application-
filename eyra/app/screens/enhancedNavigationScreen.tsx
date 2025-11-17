import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { DEMO_USER_ID } from '../constants/user';
import { API_ENDPOINTS } from '../config/api';
import { colors } from '../theme';

interface NavigationSession {
  session_id: string;
  planned_route: string[];
  instructions: string[];
  total_distance_steps: number;
  current_waypoint_index: number;
  status: string;
}

interface PositionMatch {
  waypoint_id: string;
  waypoint_type: string;
  room_label: string;
  position_description: string;
  match_score: number;
  matched_orientation: number;
  confidence: string;
}

export default function EnhancedNavigationScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const map = params.map ? JSON.parse(params.map as string) : null;
  const sourceRoom = params.source as string;
  const destinationRoom = params.destination as string;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [session, setSession] = useState<NavigationSession | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<PositionMatch | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [lastInstruction, setLastInstruction] = useState('');
  const [navigationStarted, setNavigationStarted] = useState(false);
  
  const cameraRef = useRef<any>(null);
  const matchingIntervalRef = useRef<any>(null);
  const lastMatchedWaypointRef = useRef<string | null>(null);
  const userId = DEMO_USER_ID;

  useEffect(() => {
    if (!map) {
      Alert.alert('Error', 'Map data not found');
      router.back();
      return;
    }

    Speech.speak('Enhanced navigation. Tap start navigation when ready.');
    
    return () => {
      stopNavigation();
      Speech.stop();
    };
  }, []);

  const planRoute = async () => {
    try {
      Speech.speak('Planning optimal route');
      
      // For now, we'll simulate route planning
      // In production, you'd call the backend to plan the route
      // based on the source and destination rooms
      
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('map_id', map.map_id);
      formData.append('start_waypoint', `start_${sourceRoom}`);
      formData.append('destination_waypoint', `dest_${destinationRoom}`);

      // For demo, create a mock session
      const mockSession: NavigationSession = {
        session_id: `nav_${Date.now()}`,
        planned_route: ['wp_start', 'wp_mid1', 'wp_mid2', 'wp_dest'],
        instructions: [
          'Walk forward down the hallway',
          'Turn right at the corner',
          'Continue straight',
          'Destination on your left',
        ],
        total_distance_steps: 50,
        current_waypoint_index: 0,
        status: 'in_progress',
      };

      setSession(mockSession);
      
      const totalSteps = mockSession.total_distance_steps;
      const waypointCount = mockSession.planned_route.length;
      
      Speech.speak(`Route planned. ${waypointCount} waypoints, approximately ${totalSteps} steps. Starting navigation.`);
      
      return mockSession;
      
    } catch (error) {
      console.error('Error planning route:', error);
      Alert.alert('Error', 'Failed to plan route');
      return null;
    }
  };

  const startNavigation = async () => {
    // Plan route first if not already done
    let navSession = session;
    if (!navSession) {
      navSession = await planRoute();
      if (!navSession) return;
    }

    setIsNavigating(true);
    setNavigationStarted(true);
    
    // Announce first instruction
    if (navSession.instructions.length > 0) {
      const firstInstruction = navSession.instructions[0];
      setLastInstruction(firstInstruction);
      Speech.speak(firstInstruction);
      
      // Haptic feedback for start
      Vibration.vibrate(100);
    }

    // Start continuous position matching (every 2 seconds)
    matchingIntervalRef.current = setInterval(() => {
      matchPosition();
    }, 2000);
  };

  const stopNavigation = () => {
    if (matchingIntervalRef.current) {
      clearInterval(matchingIntervalRef.current);
      matchingIntervalRef.current = null;
    }

    if (isNavigating) {
      setIsNavigating(false);
      Speech.speak('Navigation stopped');
      Vibration.vibrate([100, 50, 100]);
    }
  };

  const matchPosition = async () => {
    if (!cameraRef.current || isMatching) return;

    try {
      setIsMatching(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
        skipProcessing: true,
      });

      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('map_id', map.map_id);
      
      // Include expected waypoint if we have session info
      if (session && session.current_waypoint_index < session.planned_route.length) {
        const expectedWaypoint = session.planned_route[session.current_waypoint_index];
        formData.append('expected_waypoint', expectedWaypoint);
      }

      const fileObj = {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'current_position.jpg',
      };
      formData.append('current_image', fileObj as any);

      // Use enhanced position matching
      const response = await fetch(API_ENDPOINTS.matchPositionEnhanced, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.matched) {
        const position = result.position;
        setCurrentPosition(position);

        // Check if this is a new waypoint
        const isNewWaypoint = lastMatchedWaypointRef.current !== position.waypoint_id;
        
        if (isNewWaypoint) {
          lastMatchedWaypointRef.current = position.waypoint_id;
          
          // Announce position
          const roomName = position.room_label.replace('_', ' ').replace('to', 'towards');
          const confidenceText = position.confidence === 'high' ? 'confident' : 
                                position.confidence === 'medium' ? 'fairly confident' : 'checking';
          
          Speech.speak(`I'm ${confidenceText}. ${position.position_description}`);
          
          // Haptic feedback based on confidence
          if (position.confidence === 'high') {
            Vibration.vibrate(100); // Single pulse
          } else if (position.confidence === 'medium') {
            Vibration.vibrate([100, 100, 100, 100]); // Two pulses
          }

          // Advance to next instruction if we've reached a waypoint
          if (session && session.current_waypoint_index < session.instructions.length - 1) {
            const nextIndex = session.current_waypoint_index + 1;
            const nextInstruction = session.instructions[nextIndex];
            
            // Update session
            setSession({
              ...session,
              current_waypoint_index: nextIndex,
            });
            
            // Announce next instruction after a brief pause
            setTimeout(() => {
              setLastInstruction(nextInstruction);
              Speech.speak(nextInstruction);
              
              // Check if approaching a turn
              if (nextInstruction.toLowerCase().includes('turn')) {
                Vibration.vibrate([100, 100, 100, 100, 100, 100]); // Three pulses for turn
              }
            }, 2000);
          }

          // Check if we've reached destination
          if (session && session.current_waypoint_index >= session.instructions.length - 1) {
            setTimeout(() => {
              Speech.speak('You have arrived at your destination!');
              Vibration.vibrate([200, 200, 200, 200, 200, 200, 200, 200]); // Four long pulses
              stopNavigation();
              
              Alert.alert(
                'Destination Reached!',
                'You have successfully arrived at your destination.',
                [
                  {
                    text: 'Done',
                    onPress: () => router.back(),
                  },
                ]
              );
            }, 1500);
          }
        }
        
        console.log('Position matched:', position);
      } else {
        // No match found
        console.log('No confident match found');
        
        // If we haven't matched for a while, give feedback
        if (isNavigating && Math.random() > 0.8) {
          Speech.speak('Still searching for your position');
        }
      }

    } catch (error) {
      console.error('Error matching position:', error);
    } finally {
      setIsMatching(false);
    }
  };

  const manualPositionCheck = () => {
    Speech.speak('Checking your current position');
    matchPosition();
  };

  const repeatInstruction = () => {
    if (lastInstruction) {
      Speech.speak(lastInstruction);
    } else {
      Speech.speak('No instruction available yet');
    }
  };

  if (!permission) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is required for navigation</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef}>
        {/* Status overlay */}
        <View style={styles.statusOverlay}>
          <Text style={styles.routeText}>
            {sourceRoom.replace('_', ' ')} → {destinationRoom.replace('_', ' ')}
          </Text>
          
          {isNavigating && (
            <>
              <View style={styles.navigationIndicator}>
                <View style={styles.navigationDot} />
                <Text style={styles.navigationText}>NAVIGATING</Text>
              </View>

              {session && (
                <Text style={styles.progressText}>
                  Waypoint {session.current_waypoint_index + 1} of {session.planned_route.length}
                </Text>
              )}

              {currentPosition && (
                <View style={styles.positionInfo}>
                  <Text style={styles.positionText}>
                    Confidence: {currentPosition.confidence.toUpperCase()}
                  </Text>
                  <Text style={styles.positionText}>
                    Match: {currentPosition.match_score.toFixed(1)}%
                  </Text>
                </View>
              )}
            </>
          )}

          {lastInstruction && (
            <View style={styles.instructionBox}>
              <Text style={styles.instructionText}>{lastInstruction}</Text>
            </View>
          )}
        </View>

        {/* Controls at bottom */}
        <View style={styles.controlsContainer}>
          {!navigationStarted ? (
            <>
              <TouchableOpacity
                style={[styles.largeButton, styles.startButton]}
                onPress={startNavigation}
                accessibilityRole="button"
                accessibilityLabel="Start navigation"
                accessibilityHint="Begin turn-by-turn navigation to destination"
              >
                <Text style={styles.largeButtonText}>Start Navigation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.smallButton]}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.smallButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {isNavigating ? (
                <>
                  <TouchableOpacity
                    style={[styles.mediumButton, styles.checkButton]}
                    onPress={manualPositionCheck}
                    disabled={isMatching}
                    accessibilityRole="button"
                    accessibilityLabel="Check current position"
                  >
                    <Text style={styles.mediumButtonText}>
                      {isMatching ? 'Checking...' : 'Check Position'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mediumButton, styles.repeatButton]}
                    onPress={repeatInstruction}
                    accessibilityRole="button"
                    accessibilityLabel="Repeat instruction"
                  >
                    <Text style={styles.mediumButtonText}>Repeat Instruction</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mediumButton, styles.stopButton]}
                    onPress={stopNavigation}
                    accessibilityRole="button"
                    accessibilityLabel="Stop navigation"
                  >
                    <Text style={styles.mediumButtonText}>Stop Navigation</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.largeButton, styles.resumeButton]}
                  onPress={startNavigation}
                  accessibilityRole="button"
                  accessibilityLabel="Resume navigation"
                >
                  <Text style={styles.largeButtonText}>Resume Navigation</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Matching indicator */}
        {isMatching && (
          <View style={styles.matchingIndicator}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    flex: 1,
  },
  statusOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 15,
  },
  routeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  navigationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  navigationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    marginRight: 8,
  },
  navigationText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  positionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 8,
  },
  positionText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  instructionBox: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    minWidth: '90%',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 20,
    alignItems: 'center',
  },
  largeButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    minWidth: 280,
    alignItems: 'center',
    marginBottom: 10,
  },
  startButton: {
    backgroundColor: colors.success,
  },
  resumeButton: {
    backgroundColor: colors.primary,
  },
  stopButton: {
    backgroundColor: colors.danger,
  },
  largeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mediumButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    minWidth: 250,
    alignItems: 'center',
    marginBottom: 8,
  },
  checkButton: {
    backgroundColor: colors.primary,
  },
  repeatButton: {
    backgroundColor: colors.accent,
  },
  mediumButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.muted,
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  matchingIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 20,
  },
});

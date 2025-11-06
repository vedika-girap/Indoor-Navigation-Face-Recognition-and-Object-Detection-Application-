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

const { width, height } = Dimensions.get('window');

const API_BASE_URL = 'http://10.0.2.2:8000';

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
  
  const cameraRef = useRef<any>(null);
  const userId = DEMO_USER_ID;

  useEffect(() => {
    if (!map) {
      Alert.alert('Error', 'Map data not found');
      router.back();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (matchingInterval) {
        clearInterval(matchingInterval);
      }
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
        base64: false,
        skipProcessing: true,  // Skip unnecessary processing
      });

      // Create FormData
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('map_id', map.map_id);
      
      const file = {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'current_position.jpg',
      };
      formData.append('current_image', file as any);

      // Send to backend for matching
      const response = await fetch(`${API_BASE_URL}/indoor_navigation/match_position`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success && result.matched) {
        const position = result.position;
        setCurrentPosition(position);
        
        // Only announce significant position changes
        const hasPositionChanged = !currentPosition || 
                                   currentPosition.room_label !== position.room_label;
        
        if (hasPositionChanged) {
          const roomName = position.room_label.replace('_', ' ');
          const confidenceLevel = position.match_score >= 70 ? 'high confidence' : 
                                  position.match_score >= 50 ? 'medium confidence' : 
                                  'low confidence';
          const announcement = `You are at ${roomName}. ${position.position_description}. ${confidenceLevel}.`;
          speak(announcement);
        }
        
        console.log('Position matched:', position);
      } else {
        console.log('No match found or low confidence');
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
          </View>

          {/* Current Position Display */}
          {currentPosition && (
            <View 
              style={styles.positionCard}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`Current position: ${currentPosition.room_label.replace('_', ' ')}. ${currentPosition.position_description}. Match confidence: ${currentPosition.match_score} percent${currentPosition.match_score < 50 ? '. Warning: Low confidence' : ''}`}
            >
              <Text style={styles.positionLabel}>Current Position:</Text>
              <Text style={styles.positionRoom}>{currentPosition.room_label.replace('_', ' ')}</Text>
              <Text style={styles.positionDesc}>{currentPosition.position_description}</Text>
              <Text style={styles.confidence}>
                Confidence: {currentPosition.match_score}%
              </Text>
              {currentPosition.match_score < 50 && (
                <Text style={styles.warning}>Low confidence</Text>
              )}
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
                Speech.speak('Returning to navigation setup');
                router.back();
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
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    paddingTop: 50,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  routeText: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.9,
  },
  positionCard: {
    backgroundColor: 'rgba(74, 144, 226, 0.95)',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  positionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 5,
    opacity: 0.9,
  },
  positionRoom: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  positionDesc: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  confidence: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  warning: {
    color: '#FFB74D',
    fontSize: 12,
    marginTop: 5,
  },
  matchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'center',
  },
  matchingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
  },
  controls: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    paddingBottom: 40,
  },
  navButton: {
    backgroundColor: '#50C878',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 12,
    alignItems: 'center',
  },
  navButtonActive: {
    backgroundColor: '#E74C3C',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  manualButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 12,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 16,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 30,
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

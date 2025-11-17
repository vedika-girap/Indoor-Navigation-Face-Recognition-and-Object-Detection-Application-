import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Gyroscope } from 'expo-sensors';
import { DEMO_USER_ID } from '../constants/user';
import { API_ENDPOINTS } from '../config/api';

const pastelColors = {
  background: '#F0F4F8',
  cardBackground: '#FFFFFF',
  primary: '#4A90E2',
  success: '#50C878',
  danger: '#E74C3C',
  warning: '#FFB74D',
  text: '#2C3E50',
  textSecondary: '#7F8C8D',
  border: '#E0E6ED',
};

// Waypoint types
const WAYPOINT_TYPES = {
  ENTRY_DOOR: 'Building/Floor Entrance',
  CORRIDOR_START: 'Hallway Start',
  CORNER: 'Turn/Corner',
  DOOR: 'Room Door',
  LANDMARK: 'Fixed Landmark',
  ROOM_CENTER: 'Room Center',
  JUNCTION: 'Intersection',
  INTERMEDIATE: 'Intermediate Point',
};

interface WaypointData {
  waypoint_id: string;
  type: string;
  room_label: string;
  description: string;
  images: Array<{
    uri: string;
    orientation: number;
  }>;
  connections: Array<any>;
  timestamp: number;
}

export default function EnhancedRecordingMode() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const map = params.map ? JSON.parse(params.map as string) : null;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [currentOrientation, setCurrentOrientation] = useState(0);
  const [capturedImages, setCapturedImages] = useState<Array<{ uri: string; angle: number }>>([]);
  const [waypoints, setWaypoints] = useState<WaypointData[]>([]);
  const [currentWaypointType, setCurrentWaypointType] = useState('INTERMEDIATE');
  const [isSaving, setIsSaving] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  
  const cameraRef = useRef<any>(null);
  const autoRotateTimerRef = useRef<any>(null);
  const gyroSubscription = useRef<any>(null);
  const userId = DEMO_USER_ID;

  useEffect(() => {
    // Start gyroscope for orientation tracking
    startGyroscope();
    
    return () => {
      stopGyroscope();
      if (autoRotateTimerRef.current) {
        clearInterval(autoRotateTimerRef.current);
      }
      Speech.stop();
    };
  }, []);

  const startGyroscope = () => {
    Gyroscope.setUpdateInterval(100);
    gyroSubscription.current = Gyroscope.addListener(data => {
      // Simplified orientation calculation (you may need more sophisticated algorithm)
      const { z } = data;
      const angle = Math.atan2(z, 1) * (180 / Math.PI);
      setCurrentOrientation(Math.round(angle) % 360);
    });
  };

  const stopGyroscope = () => {
    if (gyroSubscription.current) {
      gyroSubscription.current.remove();
    }
  };

  const startDenseCapture = async () => {
    Speech.speak('Starting dense waypoint capture. Hold phone steady and slowly rotate 360 degrees.');
    Vibration.vibrate(100);
    
    setRecording(true);
    setCapturedImages([]);
    
    // Capture image every 15 degrees (24 images for full rotation)
    const targetAngleStep = 15;
    let lastCapturedAngle = currentOrientation;
    let captureCount = 0;
    const maxCaptures = 24;
    
    const captureInterval = setInterval(async () => {
      const angleDiff = Math.abs(currentOrientation - lastCapturedAngle);
      
      // Capture when user has rotated ~15 degrees
      if (angleDiff >= targetAngleStep || captureCount === 0) {
        await captureImageAtAngle(currentOrientation);
        lastCapturedAngle = currentOrientation;
        captureCount++;
        
        // Haptic feedback
        Vibration.vibrate(50);
        
        // Voice progress update every 6 images
        if (captureCount % 6 === 0) {
          Speech.speak(`${captureCount} of ${maxCaptures} images captured`);
        }
        
        // Auto-stop after full rotation
        if (captureCount >= maxCaptures) {
          stopDenseCapture();
        }
      }
    }, 500);
    
    autoRotateTimerRef.current = captureInterval;
  };

  const stopDenseCapture = () => {
    if (autoRotateTimerRef.current) {
      clearInterval(autoRotateTimerRef.current);
      autoRotateTimerRef.current = null;
    }
    
    setRecording(false);
    const count = capturedImages.length;
    
    Speech.speak(`Dense capture complete. ${count} images captured. Select waypoint type to save.`);
    Vibration.vibrate([100, 50, 100]);
    
    setShowTypeSelector(true);
  };

  const captureImageAtAngle = async (angle: number) => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: true,
      });

      setCapturedImages(prev => [...prev, { uri: photo.uri, angle }]);
      
      console.log(`Captured at angle: ${angle}°`);
    } catch (error) {
      console.error('Error capturing image:', error);
    }
  };

  const saveWaypoint = async (type: string) => {
    if (capturedImages.length < 10) {
      Alert.alert('Insufficient Images', 'Please capture at least 10 images for a waypoint');
      Speech.speak('Not enough images. Please capture more.');
      return;
    }

    setIsSaving(true);
    Speech.speak('Saving waypoint. Please wait.');

    try {
      const waypointId = `wp_${Date.now()}`;
      const formData = new FormData();
      
      formData.append('user_id', userId);
      formData.append('map_id', map.map_id);
      formData.append('waypoint_id', waypointId);
      formData.append('waypoint_type', type);
      formData.append('room_label', map.name || 'unknown');
      formData.append('position_description', `${WAYPOINT_TYPES[type as keyof typeof WAYPOINT_TYPES]} with ${capturedImages.length} angle views`);
      
      // Add orientations
      const orientations = capturedImages.map(img => img.angle);
      formData.append('orientations', JSON.stringify(orientations));
      
      // Add connections (empty for now, user will connect later)
      formData.append('connections', JSON.stringify([]));
      
      // Add metadata
      formData.append('metadata', JSON.stringify({
        capture_timestamp: Date.now(),
        image_count: capturedImages.length,
        capture_method: 'dense_rotation'
      }));
      
      // Add image files
      for (const img of capturedImages) {
        const fileObj = {
          uri: img.uri,
          type: 'image/jpeg',
          name: `angle_${img.angle}.jpg`,
        };
        formData.append('files', fileObj as any);
      }

      const response = await fetch(API_ENDPOINTS.createWaypoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        Speech.speak(`Waypoint saved successfully. ${capturedImages.length} images stored.`);
        Vibration.vibrate([100, 50, 100, 50, 100]);
        
        // Add to waypoints list
        const newWaypoint: WaypointData = {
          waypoint_id: waypointId,
          type,
          room_label: map.name || 'unknown',
          description: WAYPOINT_TYPES[type as keyof typeof WAYPOINT_TYPES],
          images: capturedImages.map(img => ({ uri: img.uri, orientation: img.angle })),
          connections: [],
          timestamp: Date.now(),
        };
        
        setWaypoints(prev => [...prev, newWaypoint]);
        setCapturedImages([]);
        setShowTypeSelector(false);
        
        Alert.alert('Success', `Waypoint saved with ${capturedImages.length} images`);
      } else {
        throw new Error(result.message || 'Failed to save waypoint');
      }

    } catch (error) {
      console.error('Error saving waypoint:', error);
      Alert.alert('Error', 'Failed to save waypoint. Please try again.');
      Speech.speak('Error saving waypoint');
    } finally {
      setIsSaving(false);
    }
  };

  const finishRecording = () => {
    if (waypoints.length === 0) {
      Alert.alert('No Waypoints', 'Please capture at least one waypoint before finishing');
      return;
    }

    Alert.alert(
      'Recording Complete',
      `You have recorded ${waypoints.length} waypoints.\n\nThese waypoints will be used for navigation.`,
      [
        { text: 'Record More', style: 'cancel' },
        {
          text: 'Finish',
          onPress: () => {
            Speech.speak(`Recording complete. ${waypoints.length} waypoints saved.`);
            router.back();
          },
        },
      ]
    );
  };

  if (!permission) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef}>
        {/* Orientation indicator */}
        <View style={styles.orientationOverlay}>
          <Text style={styles.orientationText}>Orientation: {currentOrientation}°</Text>
          <Text style={styles.orientationSubtext}>
            {recording ? `Captured: ${capturedImages.length}/24` : 'Ready to capture'}
          </Text>
        </View>

        {/* Controls at bottom */}
        <View style={styles.controlsContainer}>
          {!recording ? (
            <TouchableOpacity
              style={[styles.captureButton, styles.startButton]}
              onPress={startDenseCapture}
              accessibilityRole="button"
              accessibilityLabel="Start dense waypoint capture"
              accessibilityHint="Begin capturing images while rotating 360 degrees"
            >
              <Text style={styles.captureButtonText}>Start Dense Capture</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.captureButton, styles.stopButton]}
              onPress={stopDenseCapture}
              accessibilityRole="button"
              accessibilityLabel="Stop capture"
            >
              <Text style={styles.captureButtonText}>Stop Capture</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.waypointCount}>
            Waypoints recorded: {waypoints.length}
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.finishButton]}
            onPress={finishRecording}
            disabled={waypoints.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Finish recording"
          >
            <Text style={styles.buttonText}>Finish Recording</Text>
          </TouchableOpacity>
        </View>
      </CameraView>

      {/* Waypoint type selector modal */}
      {showTypeSelector && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Waypoint Type</Text>
            <Text style={styles.modalSubtitle}>
              {capturedImages.length} images captured
            </Text>

            <ScrollView style={styles.typeList}>
              {Object.entries(WAYPOINT_TYPES).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={styles.typeOption}
                  onPress={() => saveWaypoint(key)}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Text style={styles.typeOptionText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="large" color={pastelColors.primary} />
                <Text style={styles.savingText}>Saving waypoint...</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowTypeSelector(false)}
              disabled={isSaving}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
  },
  camera: {
    flex: 1,
  },
  orientationOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
  },
  orientationText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  orientationSubtext: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 5,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    alignItems: 'center',
  },
  captureButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    minWidth: 250,
    alignItems: 'center',
    marginBottom: 10,
  },
  startButton: {
    backgroundColor: pastelColors.success,
  },
  stopButton: {
    backgroundColor: pastelColors.danger,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waypointCount: {
    color: '#FFFFFF',
    fontSize: 16,
    marginVertical: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    backgroundColor: pastelColors.primary,
    marginTop: 5,
  },
  finishButton: {
    backgroundColor: pastelColors.warning,
  },
  cancelButton: {
    backgroundColor: pastelColors.textSecondary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 18,
    color: pastelColors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
    marginBottom: 5,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: pastelColors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  typeList: {
    maxHeight: 400,
  },
  typeOption: {
    padding: 15,
    backgroundColor: pastelColors.background,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: pastelColors.border,
  },
  typeOptionText: {
    fontSize: 18,
    color: pastelColors.text,
    fontWeight: '600',
  },
  savingIndicator: {
    alignItems: 'center',
    marginVertical: 20,
  },
  savingText: {
    marginTop: 10,
    fontSize: 16,
    color: pastelColors.text,
  },
});

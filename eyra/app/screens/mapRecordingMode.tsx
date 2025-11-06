import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { DEMO_USER_ID } from '../constants/user';

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

interface CapturedWaypoint {
  id: string;
  room_label: string;
  image_uri: string;
  timestamp: number;
  position_description: string;
}

export default function MapRecordingMode() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const map = params.map ? JSON.parse(params.map as string) : null;
  const labels = params.labels ? JSON.parse(params.labels as string) : [];
  
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [capturedWaypoints, setCapturedWaypoints] = useState<CapturedWaypoint[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [autoCapture, setAutoCapture] = useState(false);
  const [captureInterval, setCaptureInterval] = useState(5); // seconds
  
  const cameraRef = useRef<any>(null);
  const autoCaptureTimerRef = useRef<any>(null);
  const userId = DEMO_USER_ID;

  useEffect(() => {
    return () => {
      // Cleanup timer on unmount
      if (autoCaptureTimerRef.current) {
        clearInterval(autoCaptureTimerRef.current);
      }
      // Stop any ongoing speech
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (recording && labels.length > 0 && currentRoomIndex < labels.length) {
      const roomName = labels[currentRoomIndex].label.replace('_', ' ');
      Speech.speak(`Current location: ${roomName}`, { rate: 0.95 });
    }
  }, [recording, currentRoomIndex]);

  if (!permission) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is required for recording</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
          accessibilityHint="Tap to allow camera access for floor map recording"
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!map || labels.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No map or room labels provided</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => {
            Speech.speak('Going back');
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Return to previous screen"
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentRoom = labels[currentRoomIndex];

  const startRecording = () => {
    setRecording(true);
    Speech.speak(`Recording mode activated. Walk through the floor and capture images at each location.`);
    
    if (autoCapture) {
      startAutoCapture();
    }
  };

  const stopRecording = () => {
    setRecording(false);
    if (autoCaptureTimerRef.current) {
      clearInterval(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
    
    Speech.speak(`Recording stopped. ${capturedWaypoints.length} images captured.`);
    
    Alert.alert(
      'Recording Complete',
      `Captured ${capturedWaypoints.length} waypoint images.\n\nWould you like to save this recording?`,
      [
        { text: 'Discard', style: 'cancel' },
        { text: 'Preview', onPress: () => setShowPreview(true) },
        { text: 'Save', onPress: saveRecording },
      ]
    );
  };

  const startAutoCapture = () => {
    autoCaptureTimerRef.current = setInterval(() => {
      captureImage('auto');
    }, captureInterval * 1000);
  };

  const captureImage = async (mode: 'manual' | 'auto' = 'manual') => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,  // Optimized quality for storage
        base64: false,
        skipProcessing: true,
      });

      const waypoint: CapturedWaypoint = {
        id: `waypoint_${Date.now()}`,
        room_label: currentRoom.label,
        image_uri: photo.uri,
        timestamp: Date.now(),
        position_description: `${currentRoom.label.replace('_', ' ')} - ${mode === 'auto' ? 'Auto' : 'Manual'} capture`,
      };

      setCapturedWaypoints(prev => [...prev, waypoint]);
      
      if (mode === 'manual') {
        const count = capturedWaypoints.length + 1;
        Speech.speak(`Image captured. Total waypoints: ${count}`, { rate: 1.0 });
      }

      console.log('Captured waypoint:', waypoint);
    } catch (error) {
      console.error('Error capturing image:', error);
      Speech.speak('Error capturing image', { rate: 0.9 });
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const moveToNextWaypoint = () => {
    if (currentRoomIndex < labels.length - 1) {
      const nextIndex = currentRoomIndex + 1;
      setCurrentRoomIndex(nextIndex);
      const roomName = labels[nextIndex].label.replace('_', ' ');
      Speech.speak(`Moving to ${roomName}. Waypoint ${nextIndex + 1} of ${labels.length}`, { rate: 0.95 });
    } else {
      Speech.speak('You have reached the last waypoint. Stop recording to save.', { rate: 0.9 });
      Alert.alert('Last Waypoint', 'You have covered all rooms. Stop recording to save.');
    }
  };

  const moveToPreviousWaypoint = () => {
    if (currentRoomIndex > 0) {
      const prevIndex = currentRoomIndex - 1;
      setCurrentRoomIndex(prevIndex);
      const roomName = labels[prevIndex].label.replace('_', ' ');
      Speech.speak(`Moving back to ${roomName}. Waypoint ${prevIndex + 1} of ${labels.length}`, { rate: 0.95 });
    } else {
      Speech.speak('Already at first waypoint', { rate: 0.9 });
    }
  };

  const saveRecording = async () => {
    try {
      // Upload all captured images to backend
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('map_id', map.map_id);
      formData.append('waypoints', JSON.stringify(capturedWaypoints.map(w => ({
        room_label: w.room_label,
        timestamp: w.timestamp,
        position_description: w.position_description,
      }))));

      // Attach all images
      for (let i = 0; i < capturedWaypoints.length; i++) {
        const waypoint = capturedWaypoints[i];
        const fileBlob = {
          uri: waypoint.image_uri,
          type: 'image/jpeg',
          name: `${waypoint.room_label}_${waypoint.timestamp}.jpg`,
        } as any;
        formData.append(`image_${i}`, fileBlob);
      }

      // TODO: Send to backend endpoint
      console.log('Saving recording with', capturedWaypoints.length, 'waypoints');
      
      Alert.alert(
        'Success',
        `Recording saved with ${capturedWaypoints.length} waypoint images!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving recording:', error);
      Alert.alert('Error', 'Failed to save recording');
    }
  };

  const deleteWaypoint = (waypointId: string) => {
    setCapturedWaypoints(prev => prev.filter(w => w.id !== waypointId));
    Speech.speak('Waypoint deleted');
  };

  return (
    <View style={styles.container}>
      {!recording ? (
        // Setup Screen
        <ScrollView contentContainerStyle={styles.setupContainer}>
          <Text style={styles.title}>Map Recording Mode</Text>
          <Text style={styles.subtitle}>{map.map_name}</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>📍 How It Works:</Text>
            <Text style={styles.infoText}>
              1. Start recording and begin walking through the floor{'\n'}
              2. Capture images at key points (corridors, turns, room entrances){'\n'}
              3. Move through all waypoints ({labels.length} rooms detected){'\n'}
              4. Stop recording when done{'\n'}
              5. Images will be saved for navigation assistance
            </Text>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingTitle}>Capture Mode:</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, !autoCapture && styles.toggleButtonActive]}
                onPress={() => setAutoCapture(false)}
              >
                <Text style={styles.toggleButtonText}>Manual</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, autoCapture && styles.toggleButtonActive]}
                onPress={() => setAutoCapture(true)}
              >
                <Text style={styles.toggleButtonText}>Auto</Text>
              </TouchableOpacity>
            </View>
            
            {autoCapture && (
              <View style={styles.intervalSelector}>
                <Text style={styles.settingLabel}>Interval: {captureInterval}s</Text>
                <View style={styles.intervalButtons}>
                  {[3, 5, 10].map(seconds => (
                    <TouchableOpacity
                      key={seconds}
                      style={[
                        styles.intervalButton,
                        captureInterval === seconds && styles.intervalButtonActive
                      ]}
                      onPress={() => setCaptureInterval(seconds)}
                    >
                      <Text style={styles.intervalButtonText}>{seconds}s</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.waypointsList}>
            <Text style={styles.waypointsTitle}>Waypoints ({labels.length}):</Text>
            {labels.map((label: any, index: number) => (
              <View key={label.label} style={styles.waypointItem}>
                <Text style={styles.waypointNumber}>{index + 1}</Text>
                <Text style={styles.waypointLabel}>{label.label.replace('_', ' ').toUpperCase()}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity 
            style={styles.startButton} 
            onPress={() => {
              startRecording();
              Speech.speak(`Starting ${autoCapture ? 'automatic' : 'manual'} recording mode`, { rate: 0.95 });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Start ${autoCapture ? 'automatic' : 'manual'} recording`}
            accessibilityHint={autoCapture ? `Camera will automatically capture images every ${captureInterval} seconds` : 'You will manually capture images by tapping the capture button'}
          >
            <Text style={styles.startButtonText}>Start Recording</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        // Recording Screen
        <View style={styles.recordingContainer}>
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            />
          </View>

          <View style={styles.recordingOverlay}>
            <View style={styles.recordingHeader}>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>RECORDING</Text>
              </View>
              <Text style={styles.captureCount}>{capturedWaypoints.length} captured</Text>
            </View>

            <View style={styles.currentWaypointCard}>
              <Text style={styles.currentWaypointLabel}>
                Current: {currentRoom.label.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.waypointProgress}>
                Waypoint {currentRoomIndex + 1} of {labels.length}
              </Text>
            </View>

            <View style={styles.controlsContainer}>
              <TouchableOpacity
                style={[styles.navButton, currentRoomIndex === 0 && styles.navButtonDisabled]}
                onPress={moveToPreviousWaypoint}
                disabled={currentRoomIndex === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous waypoint"
                accessibilityHint={`Go to waypoint ${currentRoomIndex} of ${labels.length}`}
                accessibilityState={{ disabled: currentRoomIndex === 0 }}
              >
                <Text style={styles.navButtonText}>Previous</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.captureButton} 
                onPress={() => {
                  captureImage('manual');
                  Speech.speak('Capturing image', { rate: 1.1 });
                }}
                accessibilityRole="button"
                accessibilityLabel="Capture image"
                accessibilityHint="Take a photo at current location"
              >
                <Text style={styles.captureButtonText}>Capture</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navButton, currentRoomIndex === labels.length - 1 && styles.navButtonDisabled]}
                onPress={moveToNextWaypoint}
                disabled={currentRoomIndex === labels.length - 1}
                accessibilityRole="button"
                accessibilityLabel="Next waypoint"
                accessibilityHint={`Go to waypoint ${currentRoomIndex + 2} of ${labels.length}`}
                accessibilityState={{ disabled: currentRoomIndex === labels.length - 1 }}
              >
                <Text style={styles.navButtonText}>Next</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.stopButton} 
              onPress={stopRecording}
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              accessibilityHint={`Stop recording and save ${capturedWaypoints.length} captured images`}
            >
              <Text style={styles.stopButtonText}>Stop Recording</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Preview Modal */}
      <Modal visible={showPreview} animationType="slide">
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Captured Waypoints ({capturedWaypoints.length})</Text>
            <TouchableOpacity onPress={() => setShowPreview(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.previewScroll}>
            {capturedWaypoints.map((waypoint, index) => (
              <View key={waypoint.id} style={styles.previewItem}>
                <Image source={{ uri: waypoint.image_uri }} style={styles.previewImage} />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewLabel}>
                    {index + 1}. {waypoint.room_label.replace('_', ' ').toUpperCase()}
                  </Text>
                  <Text style={styles.previewDescription}>{waypoint.position_description}</Text>
                  <Text style={styles.previewTime}>
                    {new Date(waypoint.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteWaypoint(waypoint.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.previewFooter}>
            <TouchableOpacity style={styles.saveButton} onPress={saveRecording}>
              <Text style={styles.saveButtonText}>Save Recording</Text>
            </TouchableOpacity>
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
  setupContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pastelColors.text,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: pastelColors.textSecondary,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: pastelColors.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelColors.text,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: pastelColors.textSecondary,
    lineHeight: 22,
  },
  settingsCard: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelColors.text,
    marginBottom: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: pastelColors.border,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: pastelColors.primary,
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  intervalSelector: {
    marginTop: 15,
  },
  settingLabel: {
    fontSize: 14,
    color: pastelColors.textSecondary,
    marginBottom: 8,
  },
  intervalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  intervalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: pastelColors.border,
    alignItems: 'center',
  },
  intervalButtonActive: {
    backgroundColor: pastelColors.success,
  },
  intervalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  waypointsList: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  waypointsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelColors.text,
    marginBottom: 10,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: pastelColors.border,
  },
  waypointNumber: {
    width: 30,
    fontSize: 14,
    fontWeight: 'bold',
    color: pastelColors.primary,
  },
  waypointLabel: {
    fontSize: 14,
    color: pastelColors.text,
  },
  startButton: {
    backgroundColor: pastelColors.success,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recordingContainer: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  recordingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: pastelColors.danger,
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  captureCount: {
    color: '#fff',
    fontSize: 14,
  },
  currentWaypointCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  currentWaypointLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waypointProgress: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  navButton: {
    backgroundColor: pastelColors.primary,
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: pastelColors.primary,
  },
  captureButtonText: {
    fontSize: 32,
  },
  stopButton: {
    backgroundColor: pastelColors.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: pastelColors.background,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: pastelColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: pastelColors.border,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: pastelColors.text,
  },
  closeButton: {
    fontSize: 24,
    color: pastelColors.textSecondary,
  },
  previewScroll: {
    flex: 1,
  },
  previewItem: {
    flexDirection: 'row',
    backgroundColor: pastelColors.cardBackground,
    margin: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: 100,
    height: 100,
  },
  previewInfo: {
    flex: 1,
    padding: 12,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: pastelColors.text,
  },
  previewDescription: {
    fontSize: 12,
    color: pastelColors.textSecondary,
    marginTop: 4,
  },
  previewTime: {
    fontSize: 11,
    color: pastelColors.textSecondary,
    marginTop: 4,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  deleteButtonText: {
    fontSize: 24,
  },
  previewFooter: {
    padding: 20,
    backgroundColor: pastelColors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: pastelColors.border,
  },
  saveButton: {
    backgroundColor: pastelColors.success,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 16,
    color: pastelColors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: pastelColors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

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
  Modal,
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

interface PathSegment {
  from_room: string;
  to_room: string;
  images: Array<{
    uri: string;
    timestamp: number;
    estimated_position: string;
  }>;
}

interface RecordedPath {
  path_id: string;
  segments: PathSegment[];
  total_images: number;
  rooms: string[];
}

export default function PathRecordingMode() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const map = params.map ? JSON.parse(params.map as string) : null;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [currentSegment, setCurrentSegment] = useState<PathSegment | null>(null);
  const [completedSegments, setCompletedSegments] = useState<PathSegment[]>([]);
  const [capturedImages, setCapturedImages] = useState<Array<any>>([]);
  const [captureInterval, setCaptureInterval] = useState(1); // 1 second
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [fromRoom, setFromRoom] = useState('');
  const [toRoom, setToRoom] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [roomsInPath, setRoomsInPath] = useState<string[]>([]);
  
  const cameraRef = useRef<any>(null);
  const intervalTimerRef = useRef<any>(null);
  const userId = DEMO_USER_ID;

  const getTurnInstruction = (currentRoom: string, nextRoom: string): string => {
    // Simple heuristic based on room names
    // In production, use actual geometry or user-defined directions
    const turns = ['left', 'right', 'straight'];
    const hash = (currentRoom + nextRoom).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const turnIdx = hash % turns.length;
    const turn = turns[turnIdx];
    
    if (turn === 'straight') {
      return `Continue straight and enter ${nextRoom.replace('_', ' ')}`;
    } else {
      return `Turn ${turn} and enter ${nextRoom.replace('_', ' ')}`;
    }
  };

  useEffect(() => {
    Speech.speak('Path recording mode. Set up your route by defining room-to-room segments.');
    
    return () => {
      stopRecording();
      Speech.stop();
    };
  }, []);

  const startNewSegment = () => {
    if (fromRoom.trim() === '' || toRoom.trim() === '') {
      Alert.alert('Missing Information', 'Please enter both from and to room names');
      Speech.speak('Please enter room names');
      return;
    }

    const segment: PathSegment = {
      from_room: fromRoom.trim(),
      to_room: toRoom.trim(),
      images: [],
    };

    setCurrentSegment(segment);
    setShowSegmentDialog(false);
    
    // Add rooms to path
    if (!roomsInPath.includes(fromRoom.trim())) {
      setRoomsInPath(prev => [...prev, fromRoom.trim()]);
    }
    if (!roomsInPath.includes(toRoom.trim())) {
      setRoomsInPath(prev => [...prev, toRoom.trim()]);
    }

    startRecording();
  };

  const startRecording = () => {
    setIsRecording(true);
    setCapturedImages([]);
    
    Speech.speak(`Recording path from ${currentSegment?.from_room} to ${currentSegment?.to_room}. Walk naturally, camera will capture automatically every ${captureInterval} second.`);
    Vibration.vibrate(100);

    // Start automatic capture
    let captureCount = 0;
    intervalTimerRef.current = setInterval(async () => {
      await captureImage();
      captureCount++;
      
      // Voice feedback every 10 captures
      if (captureCount % 10 === 0) {
        Speech.speak(`${captureCount} images captured`);
        Vibration.vibrate(50);
      }
    }, captureInterval * 1000);
  };

  const stopRecording = () => {
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }

    if (!isRecording) return;

    setIsRecording(false);
    const count = capturedImages.length;
    
    Speech.speak(`Recording stopped. ${count} images captured for this segment.`);
    Vibration.vibrate([100, 50, 100]);

    // Save current segment
    if (currentSegment && count > 0) {
      const completedSegment = {
        ...currentSegment,
        images: capturedImages.map((img, idx) => ({
          uri: img.uri,
          timestamp: img.timestamp,
          estimated_position: `${currentSegment.from_room}_to_${currentSegment.to_room}_${idx}`,
        })),
      };

      setCompletedSegments(prev => [...prev, completedSegment]);
      setCapturedImages([]);
      setCurrentSegment(null);

      Alert.alert(
        'Segment Complete',
        `Captured ${count} images from ${currentSegment.from_room} to ${currentSegment.to_room}.\n\nDo you want to record another segment?`,
        [
          {
            text: 'Add Another Segment',
            onPress: () => {
              // Suggest next segment starting from current end room
              setFromRoom(toRoom);
              setToRoom('');
              setShowSegmentDialog(true);
            },
          },
          {
            text: 'Finish & Save Path',
            onPress: finishPathRecording,
          },
        ]
      );
    }
  };

  const captureImage = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
        skipProcessing: true,
      });

      const imageData = {
        uri: photo.uri,
        timestamp: Date.now(),
      };

      setCapturedImages(prev => [...prev, imageData]);
      
      // Subtle vibration on each capture
      Vibration.vibrate(30);

      console.log(`Captured image ${capturedImages.length + 1}`);
    } catch (error) {
      console.error('Error capturing image:', error);
    }
  };

  const finishPathRecording = async () => {
    if (completedSegments.length === 0) {
      Alert.alert('No Segments', 'Please record at least one path segment');
      return;
    }

    Alert.alert(
      'Save Complete Path?',
      `You have recorded ${completedSegments.length} segments:\n${completedSegments.map(s => `• ${s.from_room} → ${s.to_room} (${s.images.length} images)`).join('\n')}\n\nTotal: ${completedSegments.reduce((sum, s) => sum + s.images.length, 0)} images`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save Path',
          onPress: saveCompletePath,
        },
      ]
    );
  };

  const saveCompletePath = async () => {
    setIsSaving(true);
    Speech.speak('Saving complete path. This may take a moment.');

    try {
      const pathId = `path_${map.map_id}_${Date.now()}`;
      
      // Save each segment separately
      for (let segIdx = 0; segIdx < completedSegments.length; segIdx++) {
        const segment = completedSegments[segIdx];
        
        Speech.speak(`Saving segment ${segIdx + 1} of ${completedSegments.length}`);
        
        // Create waypoints along the segment
        // Group images into waypoints (every 20 images = 1 waypoint for density)
        const imagesPerWaypoint = 20;
        const waypointCount = Math.ceil(segment.images.length / imagesPerWaypoint);
        
        for (let wpIdx = 0; wpIdx < waypointCount; wpIdx++) {
          const startIdx = wpIdx * imagesPerWaypoint;
          const endIdx = Math.min(startIdx + imagesPerWaypoint, segment.images.length);
          const waypointImages = segment.images.slice(startIdx, endIdx);
          
          const waypointId = `${pathId}_seg${segIdx}_wp${wpIdx}`;
          const formData = new FormData();
          
          formData.append('user_id', userId);
          formData.append('map_id', map.map_id);
          formData.append('waypoint_id', waypointId);
          
          // Determine waypoint type based on position in segment
          let waypointType = 'INTERMEDIATE';
          if (wpIdx === 0) {
            waypointType = 'CORRIDOR_START';
          } else if (wpIdx === waypointCount - 1) {
            waypointType = 'DOOR'; // Approaching destination room
          }
          
          formData.append('waypoint_type', waypointType);
          formData.append('room_label', `${segment.from_room}_to_${segment.to_room}`);
          formData.append('position_description', `Segment ${segIdx + 1}: ${segment.from_room} → ${segment.to_room}, waypoint ${wpIdx + 1}/${waypointCount}`);
          
          // Orientations (simulate angles for now, since we're capturing continuously)
          const orientations = waypointImages.map((_, idx) => (idx * 360 / waypointImages.length) % 360);
          formData.append('orientations', JSON.stringify(orientations));
          
          // Connections (connect to previous and next waypoints)
          const connections = [];
          if (wpIdx > 0) {
            connections.push({
              to_waypoint: `${pathId}_seg${segIdx}_wp${wpIdx - 1}`,
              direction: 'backward',
              distance_steps: 10,
              instruction: 'Turn around and walk back',
            });
          }
          if (wpIdx < waypointCount - 1) {
            connections.push({
              to_waypoint: `${pathId}_seg${segIdx}_wp${wpIdx + 1}`,
              direction: 'forward',
              distance_steps: 10,
              instruction: 'Continue straight ahead',
            });
          }
          // Connect to next segment's first waypoint with turn instruction
          if (wpIdx === waypointCount - 1 && segIdx < completedSegments.length - 1) {
            const nextSegment = completedSegments[segIdx + 1];
            const turnInstruction = getTurnInstruction(segment.to_room, nextSegment.to_room);
            connections.push({
              to_waypoint: `${pathId}_seg${segIdx + 1}_wp0`,
              direction: 'forward',
              distance_steps: 5,
              instruction: turnInstruction,
            });
          }
          
          formData.append('connections', JSON.stringify(connections));
          
          // Metadata
          formData.append('metadata', JSON.stringify({
            segment_index: segIdx,
            waypoint_index: wpIdx,
            capture_method: 'live_path_recording',
            capture_interval: captureInterval,
            from_room: segment.from_room,
            to_room: segment.to_room,
          }));
          
          // Add image files
          for (const img of waypointImages) {
            const fileObj = {
              uri: img.uri,
              type: 'image/jpeg',
              name: `wp_${wpIdx}_img_${waypointImages.indexOf(img)}.jpg`,
            };
            formData.append('files', fileObj as any);
          }

          // Send to backend
          const response = await fetch(API_ENDPOINTS.createWaypoint, {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (!result.success) {
            throw new Error(`Failed to save waypoint ${waypointId}`);
          }

          console.log(`Saved waypoint: ${waypointId} with ${waypointImages.length} images`);
        }
      }

      // Success!
      const totalImages = completedSegments.reduce((sum, s) => sum + s.images.length, 0);
      Speech.speak(`Path saved successfully. ${totalImages} images processed across ${completedSegments.length} segments.`);
      Vibration.vibrate([100, 50, 100, 50, 200]);

      Alert.alert(
        'Success!',
        `Complete path saved:\n\n${completedSegments.map((s, i) => `${i + 1}. ${s.from_room} → ${s.to_room} (${s.images.length} images)`).join('\n')}\n\nTotal: ${totalImages} images\n\nYou can now use this path for navigation!`,
        [
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]
      );

    } catch (error) {
      console.error('Error saving path:', error);
      Alert.alert('Error', 'Failed to save complete path. Please try again.');
      Speech.speak('Error saving path');
    } finally {
      setIsSaving(false);
    }
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
        {/* Status overlay */}
        <View style={styles.statusOverlay}>
          {isRecording ? (
            <>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>RECORDING</Text>
              </View>
              <Text style={styles.statusText}>
                {currentSegment?.from_room} → {currentSegment?.to_room}
              </Text>
              <Text style={styles.statusSubtext}>
                Images captured: {capturedImages.length}
              </Text>
              <Text style={styles.statusSubtext}>
                Interval: {captureInterval}s
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.statusText}>Ready to Record</Text>
              <Text style={styles.statusSubtext}>
                Segments: {completedSegments.length}
              </Text>
            </>
          )}
        </View>

        {/* Controls at bottom */}
        <View style={styles.controlsContainer}>
          {!isRecording ? (
            <>
              <TouchableOpacity
                style={[styles.largeButton, styles.startButton]}
                onPress={() => setShowSegmentDialog(true)}
                accessibilityRole="button"
                accessibilityLabel="Start new segment"
                accessibilityHint="Define rooms and start recording path"
              >
                <Text style={styles.largeButtonText}>Start New Segment</Text>
              </TouchableOpacity>

              {completedSegments.length > 0 && (
                <TouchableOpacity
                  style={[styles.largeButton, styles.finishButton]}
                  onPress={finishPathRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Finish and save path"
                >
                  <Text style={styles.largeButtonText}>
                    Finish & Save ({completedSegments.length} segments)
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={[styles.largeButton, styles.stopButton]}
              onPress={stopRecording}
              accessibilityRole="button"
              accessibilityLabel="Stop recording segment"
            >
              <Text style={styles.largeButtonText}>Stop Segment</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.smallButton]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back"
          >
            <Text style={styles.smallButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </CameraView>

      {/* Segment setup dialog */}
      {showSegmentDialog && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Define Path Segment</Text>
            
            {completedSegments.length > 0 && (
              <View style={styles.pathPreview}>
                <Text style={styles.pathPreviewTitle}>Current Path:</Text>
                {completedSegments.map((seg, idx) => (
                  <Text key={idx} style={styles.pathPreviewText}>
                    {idx + 1}. {seg.from_room} → {seg.to_room}
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.inputLabel}>From Room:</Text>
            <TextInput
              style={styles.textInput}
              value={fromRoom}
              onChangeText={setFromRoom}
              placeholder="e.g., Room 1, Entrance, Hallway A"
              placeholderTextColor={pastelColors.textSecondary}
              accessibilityLabel="From room"
            />

            <Text style={styles.inputLabel}>To Room:</Text>
            <TextInput
              style={styles.textInput}
              value={toRoom}
              onChangeText={setToRoom}
              placeholder="e.g., Room 5, Office, Lab"
              placeholderTextColor={pastelColors.textSecondary}
              accessibilityLabel="To room"
            />

            <Text style={styles.inputLabel}>Capture Interval:</Text>
            <View style={styles.intervalButtons}>
              {[0.5, 1, 2, 3].map(interval => (
                <TouchableOpacity
                  key={interval}
                  style={[
                    styles.intervalButton,
                    captureInterval === interval && styles.intervalButtonActive,
                  ]}
                  onPress={() => setCaptureInterval(interval)}
                >
                  <Text style={styles.intervalButtonText}>{interval}s</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSegmentDialog(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={startNewSegment}
              >
                <Text style={styles.modalButtonText}>Start Recording</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <View style={styles.modalOverlay}>
          <View style={styles.savingContainer}>
            <ActivityIndicator size="large" color={pastelColors.primary} />
            <Text style={styles.savingText}>Saving path...</Text>
            <Text style={styles.savingSubtext}>Processing images and creating waypoints</Text>
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
  statusOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: pastelColors.danger,
    marginRight: 8,
  },
  recordingText: {
    color: pastelColors.danger,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusSubtext: {
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
  largeButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    minWidth: 280,
    alignItems: 'center',
    marginBottom: 10,
  },
  startButton: {
    backgroundColor: pastelColors.success,
  },
  stopButton: {
    backgroundColor: pastelColors.danger,
  },
  finishButton: {
    backgroundColor: pastelColors.warning,
  },
  largeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: pastelColors.textSecondary,
    marginTop: 5,
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
    backgroundColor: pastelColors.primary,
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 15,
    padding: 25,
    width: '90%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pastelColors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  pathPreview: {
    backgroundColor: pastelColors.background,
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  pathPreviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelColors.text,
    marginBottom: 8,
  },
  pathPreviewText: {
    fontSize: 14,
    color: pastelColors.textSecondary,
    marginLeft: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelColors.text,
    marginBottom: 8,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: pastelColors.background,
    borderWidth: 2,
    borderColor: pastelColors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: pastelColors.text,
  },
  intervalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  intervalButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 5,
    backgroundColor: pastelColors.background,
    borderWidth: 2,
    borderColor: pastelColors.border,
    borderRadius: 10,
    alignItems: 'center',
  },
  intervalButtonActive: {
    backgroundColor: pastelColors.primary,
    borderColor: pastelColors.primary,
  },
  intervalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelColors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: pastelColors.textSecondary,
  },
  confirmButton: {
    backgroundColor: pastelColors.success,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  savingContainer: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
  },
  savingText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelColors.text,
  },
  savingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: pastelColors.textSecondary,
    textAlign: 'center',
  },
});

import {
    CameraCapturedPicture,
    CameraView,
    useCameraPermissions,
} from "expo-camera";
import Constants from "expo-constants";
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { testWakeWord, useWakeWordDetection } from '../components/wakewordDetection';
import { handleVoiceCommand } from '../utils/voiceCommandHandler';

const BACKEND_URL = Constants.backendUrl || "http://10.84.28.100:8000";

export default function NormalModeScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [faces, setFaces] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceNames, setFaceNames] = useState<string[]>([]);
  const [savingFaces, setSavingFaces] = useState<boolean[]>([]);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Voice command detection
  const { isListening, isRecording, hasPermission: hasMicPermission } = useWakeWordDetection({
    onWakeWordDetected: () => {
      Speech.speak('Yes?');
    },
    onCommandDetected: async (command) => {
      console.log('Command detected:', command);
      
      // Handle voice commands with context
      await handleVoiceCommand(command, {
        router: router,
        onSaveImage: (name?: string) => {
          if (faces.length === 0) {
            Speech.speak('No faces detected. Please detect faces first.');
            return;
          }
          const faceIndex = 0;
          const faceName = name || 'Unknown';
          setFaceNames(prev => {
            const newNames = [...prev];
            newNames[faceIndex] = faceName;
            return newNames;
          });
          setTimeout(() => saveFace(faceIndex), 100);
        },
        onDetect: () => captureAndAnalyzeFrame(),
      });
    },
    enabled: voiceEnabled,
  });

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    // Announce screen capabilities
    Speech.speak('Camera detection mode. You can detect objects and faces.');
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    // Start capturing frames every 1 second if permission granted
    if (permission?.granted) {
      intervalId = setInterval(() => {
        if (!isProcessing) {
          captureAndAnalyzeFrame();
        }
      }, 1000);
    }

    return () => {
      clearInterval(intervalId);
    };
  }, [permission, isProcessing]);

  const captureAndAnalyzeFrame = async () => {
    if (cameraRef.current) {
      setIsProcessing(true);
      try {
        // Capture picture
        const photo: CameraCapturedPicture =
          await cameraRef.current.takePictureAsync({
            quality: 0.5,
            base64: true,
          });

        const formData = new FormData();
        formData.append("file", {
          uri: photo.uri,
          name: "photo.jpg",
          type: "image/jpeg",
        } as any);

        // Send to both endpoints concurrently
        const [objResponse, faceResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/object_detection/`, {
            method: "POST",
            body: formData,
          }),
          fetch(`${BACKEND_URL}/face_recognition/`, {
            method: "POST",
            body: formData,
          }),
        ]);

        const objResult = await objResponse.json();
        const faceResult = await faceResponse.json();

        setDetections(objResult.detections || []);
        const newFaces = faceResult.faces || [];
        setFaces(newFaces);
        setLastPhotoUri(photo.uri); // Store the photo URI for later use when saving faces
        // Initialize name and saving arrays for each face
        setFaceNames(new Array(newFaces.length).fill(''));
        setSavingFaces(new Array(newFaces.length).fill(false));
      } catch (error) {
        console.error("Error during capture and analysis:", error);
        // More detailed error logging
        if (error instanceof TypeError && error.message === 'Network request failed') {
          console.error("Network request failed - check if backend server is running on:", BACKEND_URL);
          Speech.speak("Unable to connect to detection server. Please check the connection.");
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const saveFace = async (faceIndex: number) => {
    const faceName = faceNames[faceIndex];
    if (!faceName.trim()) {
      Alert.alert('Error', 'Please enter a name for the face');
      Speech.speak('please enter a name for the face')
      return;
    }

    if (!lastPhotoUri) {
      Alert.alert('Error', 'No photo available. Please detect faces first.');
      return;
    }

    // Set saving state for this face
    setSavingFaces(prev => {
      const newState = [...prev];
      newState[faceIndex] = true;
      return newState;
    });

    try {
      const face = faces[faceIndex];
      const formData = new FormData();
      
      // Use the stored photo URI from the last detection
      formData.append('file', {
        uri: lastPhotoUri,
        type: 'image/jpeg',
        name: 'face.jpg',
      } as any);
      
      formData.append('label', faceName.trim());
      formData.append('bounding_box', JSON.stringify(face.bounding_box));

      const response = await fetch(`${BACKEND_URL}/face_save/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success', `Face for '${faceName}' saved successfully!`);
        Speech.speak(`Face for ${faceName} saved successfully`);
        
        // Clear the name input for this face
        setFaceNames(prev => {
          const newNames = [...prev];
          newNames[faceIndex] = '';
          return newNames;
        });
      } else {
        Alert.alert('Error', result.detail || 'Failed to save face');
      }
    } catch (error) {
      console.error('Error saving face:', error);
      Alert.alert('Error', 'Failed to save face. Please try again.');
    } finally {
      // Clear saving state for this face
      setSavingFaces(prev => {
        const newState = [...prev];
        newState[faceIndex] = false;
        return newState;
      });
    }
  };

  if (!permission) {
    return (
      <View style={styles.defaultView}>
        <Text style={styles.loadingText}>Loading Camera Permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.defaultView}>
        <Text style={styles.permissionText}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={styles.permissionButton}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Voice Status Indicator */}
      <View style={styles.voiceStatusContainer}>
        <View style={[styles.voiceIndicator, isListening && styles.voiceIndicatorActive]}>
          <Text style={styles.voiceStatusText}>
            {isListening ? (isRecording ? '🎤 Recording...' : '👂 Listening for "Ziya"...') : '🔇 Voice Off'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.voiceToggleButton}
          onPress={() => setVoiceEnabled(!voiceEnabled)}
        >
          <Text style={styles.voiceToggleText}>{voiceEnabled ? 'Disable' : 'Enable'} Voice</Text>
        </TouchableOpacity>
      </View>

      {/* Test Voice Command Button (Native only) */}
      {Platform.OS !== 'web' && (
        <View style={styles.testButtonContainer}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => {
              Alert.alert(
                'Test Voice Command',
                'Choose a command to test:',
                [
                  {
                    text: 'Save face as John',
                    onPress: () => testWakeWord(
                      () => Speech.speak('Yes?'),
                      async (cmd) => {
                        await handleVoiceCommand(cmd, {
                          router: router,
                          onSaveImage: (name?: string) => {
                            if (faces.length === 0) {
                              Speech.speak('No faces detected. Please detect faces first.');
                              return;
                            }
                            const faceIndex = 0;
                            const faceName = name || 'John';
                            setFaceNames(prev => {
                              const newNames = [...prev];
                              newNames[faceIndex] = faceName;
                              return newNames;
                            });
                            setTimeout(() => saveFace(faceIndex), 100);
                          },
                          onDetect: () => captureAndAnalyzeFrame(),
                        });
                      },
                      'save face as John'
                    )
                  },
                  {
                    text: 'Navigate to menu',
                    onPress: () => testWakeWord(
                      () => Speech.speak('Yes?'),
                      async (cmd) => await handleVoiceCommand(cmd, {
                        router: router,
                        onDetect: () => captureAndAnalyzeFrame(),
                      }),
                      'navigate to menu'
                    )
                  },
                  {
                    text: 'Detect',
                    onPress: () => testWakeWord(
                      () => Speech.speak('Yes?'),
                      async (cmd) => await handleVoiceCommand(cmd, {
                        router: router,
                        onDetect: () => captureAndAnalyzeFrame(),
                      }),
                      'detect'
                    )
                  },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Text style={styles.testButtonText}>🎤 Test Voice Command</Text>
          </TouchableOpacity>
        </View>
      )}

      <CameraView style={styles.cameraContainer} facing="back" ref={cameraRef} />

      <TouchableOpacity
        style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
        onPress={captureAndAnalyzeFrame}
        disabled={isProcessing}
        accessibilityRole="button"
        accessibilityLabel="Detect objects and faces"
      >
        <Text style={styles.captureButtonText}>
          {isProcessing ? "Processing..." : "Detect Objects & Faces"}
        </Text>
      </TouchableOpacity>

      {(detections.length > 0 || faces.length > 0) && (
        <View style={styles.detectionsContainer}>
          {detections.length > 0 && (
            <>
              <Text style={styles.detectionsTitle}>Object Detections</Text>
              <ScrollView style={styles.scrollView}>
                {detections.map((item, index) => (
                  <View key={"obj-" + index} style={styles.detectionBox}>
                    <Text style={styles.detectionLabel}>{item.label}</Text>
                    <Text style={styles.detectionConfidence}>
                      {(item.confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {faces.length > 0 && (
            <>
              <Text style={styles.detectionsTitle}>Face Detections</Text>
              <ScrollView style={styles.scrollView}>
                {faces.map((face, index) => (
                  <View key={"face-" + index} style={styles.faceDetectionBox}>
                    <View style={styles.faceInfo}>
                      <Text style={styles.detectionLabel}>{face.name || `Unknown Face ${index + 1}`}</Text>
                      <Text style={styles.boundingBoxText}>{face.bounding_box.join(", ")}</Text>
                    </View>
                    <View style={styles.faceSaveSection}>
                      <TextInput
                        style={styles.nameInput}
                        placeholder="Enter name"
                        placeholderTextColor="#7BA7A5"
                        value={faceNames[index] || ''}
                        onChangeText={(text) => setFaceNames(prev => {
                          const arr = [...prev];
                          arr[index] = text;
                          return arr;
                        })}
                        editable={!savingFaces[index]}
                      />
                      <TouchableOpacity
                        onPress={() => saveFace(index)}
                        disabled={savingFaces[index] || !faceNames[index]?.trim()}
                        style={[styles.saveFaceButton, (savingFaces[index] || !faceNames[index]?.trim()) && styles.saveFaceButtonDisabled]}
                      >
                        <Text style={styles.saveFaceButtonText}>
                          {savingFaces[index] ? 'Saving...' : 'Save'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const pastelColors = {
  background: "#DEF2F1",
  cameraOverlay: "#75E6DA",
  buttonBackground: "#3AAFA9",
  buttonDisabledBackground: "#A0CFCB",
  buttonText: "#FEFFFF",
  detectionsBackground: "rgba(255, 255, 255, 0.85)",
  detectionBoxBackground: "#EFF7F6",
  detectionLabelText: "#2B7A78",
  detectionConfidenceText: "#17252A",
  permissionText: "#17252A",
  permissionButtonBackground: "#3AAFA9",
  permissionButtonText: "#FEFFFF",
  loadingText: "#17252A",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
  },
  cameraContainer: {
    flex: 1,
  },
  captureButton: {
    position: "absolute",
    bottom: 60,
    left: "25%",
    right: "25%",
    paddingVertical: 20,
    backgroundColor: pastelColors.buttonBackground,
    borderRadius: 35,
    alignItems: "center",
    elevation: 5,
  },
  captureButtonDisabled: {
    backgroundColor: pastelColors.buttonDisabledBackground,
  },
  captureButtonText: {
    color: pastelColors.buttonText,
    fontSize: 20,
    fontWeight: "700",
  },
  voiceStatusContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginRight: 8,
  },
  voiceIndicatorActive: {
    backgroundColor: 'rgba(75, 230, 218, 0.9)',
  },
  voiceStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: pastelColors.detectionLabelText,
  },
  voiceToggleButton: {
    backgroundColor: pastelColors.buttonBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  voiceToggleText: {
    color: pastelColors.buttonText,
    fontSize: 12,
    fontWeight: '600',
  },
  testButtonContainer: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    zIndex: 10,
  },
  testButton: {
    backgroundColor: 'rgba(58, 175, 169, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  testButtonText: {
    color: pastelColors.buttonText,
    fontSize: 14,
    fontWeight: '700',
  },
  detectionsContainer: {
    position: "absolute",
    bottom: 130,
    left: 12,
    right: 12,
    maxHeight: 220,
    backgroundColor: pastelColors.detectionsBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 10,
  },
  detectionsTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    color: pastelColors.detectionLabelText,
  },
  scrollView: {
    flexGrow: 0,
    maxHeight: 120,
  },
  detectionBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: pastelColors.detectionBoxBackground,
    marginVertical: 3,
    padding: 8,
    borderRadius: 5,
  },
  detectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: pastelColors.detectionLabelText,
  },
  detectionConfidence: {
    fontSize: 16,
    fontWeight: "500",
    color: pastelColors.detectionConfidenceText,
  },
  defaultView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: pastelColors.background,
  },
  loadingText: {
    fontSize: 20,
    color: pastelColors.loadingText,
  },
  permissionText: {
    fontSize: 18,
    color: pastelColors.permissionText,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 30,
  },
  permissionButton: {
    backgroundColor: pastelColors.permissionButtonBackground,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 5,
  },
  permissionButtonText: {
    color: pastelColors.permissionButtonText,
    fontSize: 18,
    fontWeight: "600",
  },
  faceDetectionBox: {
    backgroundColor: pastelColors.detectionBoxBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#C1E3E1",
  },
  faceInfo: {
    marginBottom: 8,
  },
  boundingBoxText: {
    fontSize: 12,
    color: pastelColors.detectionConfidenceText,
    opacity: 0.7,
  },
  faceSaveSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#C1E3E1",
    fontSize: 14,
  },
  saveFaceButton: {
    backgroundColor: pastelColors.buttonBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  saveFaceButtonDisabled: {
    backgroundColor: pastelColors.buttonDisabledBackground,
  },
  saveFaceButtonText: {
    color: pastelColors.buttonText,
    fontSize: 12,
    fontWeight: "600",
  },
});

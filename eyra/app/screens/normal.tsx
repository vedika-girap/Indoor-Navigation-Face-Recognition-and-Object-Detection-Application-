import { useRouter } from 'expo-router';
import {
  CameraCapturedPicture,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import Constants from "expo-constants";
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { DEMO_USER_ID } from '../constants/user';

const BACKEND_URL = Constants.backendUrl || "http://10.231.226.100:8000";

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
    let intervalId: ReturnType<typeof setInterval> | undefined;

    // Start capturing frames every 1 second if permission granted
    if (permission?.granted) {
      intervalId = setInterval(() => {
        if (!isProcessing) {
          captureAndAnalyzeFrame();
        }
      }, 1000);
    }

    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }
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

        // Create separate FormData for face recognition with user_id
        const faceFormData = new FormData();
        faceFormData.append("file", {
          uri: photo.uri,
          name: "photo.jpg",
          type: "image/jpeg",
        } as any);
        faceFormData.append("user_id", DEMO_USER_ID);

        // Send to both endpoints concurrently
        const [objResponse, faceResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/object_detection/`, {
            method: "POST",
            body: formData,
          }),
          fetch(`${BACKEND_URL}/face_recognition/`, {
            method: "POST",
            body: faceFormData,
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
      
      // Generate unique face_id
      const faceId = `face_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const formData = new FormData();
      
      // Use the stored photo URI from the last detection
      formData.append('file', {
        uri: lastPhotoUri,
        type: 'image/jpeg',
        name: 'face.jpg',
      } as any);
      
      formData.append('user_id', DEMO_USER_ID);
      formData.append('face_id', faceId);
      formData.append('face_name', faceName.trim());
      
      // Add metadata with bounding box and confidence if available
      const metadata = {
        bounding_box: face.bounding_box,
        confidence: face.confidence || null,
      };
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch(`${BACKEND_URL}/user_faces/save`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert('Success', `Face for '${faceName}' saved successfully!`);
        Speech.speak(`Face for ${faceName} saved successfully`);
        
        // Clear the name input for this face
        setFaceNames(prev => {
          const newNames = [...prev];
          newNames[faceIndex] = '';
          return newNames;
        });
      } else {
        Alert.alert('Error', result.message || 'Failed to save face');
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
      {/* Simple Voice Toggle */}
      <View style={styles.voiceStatusContainer}>
        <TouchableOpacity
          style={[styles.voiceToggleButton, voiceEnabled && styles.voiceToggleButtonActive]}
          onPress={() => {
            const newState = !voiceEnabled;
            setVoiceEnabled(newState);
            Speech.speak(newState ? 'Voice assistance enabled' : 'Voice assistance disabled');
          }}
        >
          <Text style={styles.voiceToggleText}>
            {voiceEnabled ? '🔊 Voice: ON' : '🔇 Voice: OFF'}
          </Text>
        </TouchableOpacity>
        
        {/* Simple voice command button */}
        {voiceEnabled && (
          <TouchableOpacity
            style={styles.simpleVoiceButton}
            onPress={() => {
              Speech.speak('Hi, I am Ziya. You can say: detect, go to menu, or save face');
            }}
          >
            <Text style={styles.simpleVoiceButtonText}>💬 Help</Text>
          </TouchableOpacity>
        )}
      </View>

      <CameraView style={styles.cameraContainer} facing="back" ref={cameraRef} />

      <TouchableOpacity
        style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
        onPress={() => {
          captureAndAnalyzeFrame();
          if (voiceEnabled) Speech.speak('Detecting');
        }}
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
    gap: 10,
  },
  voiceToggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  voiceToggleButtonActive: {
    backgroundColor: 'rgba(75, 230, 218, 0.95)',
    borderColor: '#3AAFA9',
  },
  voiceToggleText: {
    color: pastelColors.detectionLabelText,
    fontSize: 14,
    fontWeight: '700',
  },
  simpleVoiceButton: {
    backgroundColor: 'rgba(58, 175, 169, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
  },
  simpleVoiceButtonText: {
    color: pastelColors.buttonText,
    fontSize: 14,
    fontWeight: '600',
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

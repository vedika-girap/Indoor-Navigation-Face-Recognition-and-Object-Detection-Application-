import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import {
  CameraView,
  useCameraPermissions,
  CameraCapturedPicture,
} from "expo-camera";
import Constants from "expo-constants";

const BACKEND_URL = Constants.manifest?.extra?.backendUrl || "http://localhost:8000";

export default function NormalModeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [faces, setFaces] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

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
        setFaces(faceResult.faces || []);
      } catch (error) {
        console.error("Error during capture and analysis:", error);
      } finally {
        setIsProcessing(false);
      }
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
                  <View key={"face-" + index} style={styles.detectionBox}>
                    <Text style={styles.detectionLabel}>{face.name}</Text>
                    {/* Optionally show bounding box position */}
                    <Text>{face.bounding_box.join(", ")}</Text>
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
});

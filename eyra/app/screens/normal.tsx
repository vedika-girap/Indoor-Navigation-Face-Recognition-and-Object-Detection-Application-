import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  CameraView,
  useCameraPermissions,
  CameraCapturedPicture,
} from "expo-camera";

export default function NormalModeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const captureAndDetect = async () => {
    if (cameraRef.current && !isProcessing) {
      setIsProcessing(true);
      try {
        // ✅ New API -> use `takePictureAsync`
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

        const response = await fetch(
          "http://YOUR_SERVER_IP:8000/object_detection/",
          {
            method: "POST",
            body: formData,
          }
        );

        const result = await response.json();
        setDetections(result.detections);
      } catch (error) {
        console.error(error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  if (!permission) {
    return (
      <View style={styles.defaultView}>
        <Text>Loading Camera Permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.defaultView}>
        <Text>We need your permission to show the camera</Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.cameraContainer} facing="back" ref={cameraRef} />
      <TouchableOpacity
        style={styles.captureButton}
        onPress={captureAndDetect}
        disabled={isProcessing}
      >
        <Text style={{ color: "white" }}>
          {isProcessing ? "Processing..." : "Detect Objects"}
        </Text>
      </TouchableOpacity>

      {detections.length > 0 && (
        <View style={styles.detectionsContainer}>
          {detections.map((item, index) => (
            <Text key={index}>
              {item.label} ({(item.confidence * 100).toFixed(1)}%)
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cameraContainer: { flex: 1 },
  captureButton: {
    position: "absolute",
    bottom: 60,
    left: "40%",
    padding: 10,
    backgroundColor: "#28a745",
    borderRadius: 5,
  },
  detectionsContainer: {
    position: "absolute",
    bottom: 120,
    left: 10,
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 10,
    borderRadius: 5,
  },
  defaultView: { flex: 1, justifyContent: "center", alignItems: "center" },
  permissionButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#8DC63F",
    borderRadius: 5,
  },
  permissionText: {
    color: "#6e9c35",
  },
});

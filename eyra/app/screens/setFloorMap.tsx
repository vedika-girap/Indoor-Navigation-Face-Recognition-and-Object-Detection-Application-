import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../navigator/appNavigator';
const BACKEND_URL = Constants.backendUrl ;

type SetFloorMapNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SetFloorMap'>;

interface SetFloorMapProps {
  navigation: SetFloorMapNavigationProp;
}

export default function SetFloorMap({ navigation }: SetFloorMapProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);
        setFileUri(file.uri);
        Alert.alert('File selected:', file.name);
      } else {
        console.log('User cancelled document picking');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error picking document', message);
    }
  };

  // Upload selected image to backend for processing
  const uploadFile = async () => {
    if (!fileUri || !fileName) {
      Alert.alert('No file selected', 'Please select a map image before uploading.');
      return;
    }

    setUploading(true);

    try {
      // Fetch local file as blob
      const response = await fetch(fileUri);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: blob.type || 'image/jpeg',
      } as any);

      // Replace with your actual backend URL
      const uploadResponse = await fetch(`${BACKEND_URL}/upload_floor_map`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type header; fetch sets it automatically for multipart/form-data
      });

      const result = await uploadResponse.json();
      Alert.alert('Upload Success', JSON.stringify(result));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Upload Error', message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Set Floor Map</Text>

      <TouchableOpacity
        style={styles.mapPlaceholder}
        onPress={pickDocument}
        accessibilityLabel="Select map image"
        accessibilityHint="Opens file picker to select a map image"
      >
        {fileUri ? (
          <Image
            source={{ uri: fileUri }}
            style={styles.imagePreview}
            resizeMode="contain"
            accessible
            accessibilityLabel="Selected map image preview"
          />
        ) : (
          <Text style={styles.tapText}>Tap to select map file</Text>
        )}
      </TouchableOpacity>

      {fileName && <Text style={styles.fileName}>Selected File: {fileName}</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, uploading && styles.buttonDisabled]}
          onPress={uploadFile}
          accessibilityRole="button"
          accessibilityLabel="Upload selected map"
          accessibilityHint="Uploads the selected map image to the backend"
          disabled={uploading}
        >
          <Text style={styles.buttonText}>{uploading ? 'Uploading...' : 'Upload Map'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('NormalMode')}
          accessibilityRole="button"
          accessibilityLabel="Navigate to Normal mode"
          accessibilityHint="Navigates to the main screen"
        >
          <Text style={styles.buttonText}>Navigate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pastelColors = {
  background: '#E8F0F2',
  cardBackground: '#F8F2F7',
  buttonBackground: '#A3D2CA',
  buttonDisabledBackground: '#c5dacf',
  textPrimary: '#20639B',
  textSecondary: '#395B64',
  placeholderBackground: '#D6DBD2',
  borderColor: '#2F5061',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
    alignItems: 'center',
    padding: 30,
  },
  header: {
    marginTop: 50,
    fontSize: 28,
    fontWeight: '700',
    color: pastelColors.textPrimary,
    marginBottom: 30,
  },
  mapPlaceholder: {
    width: 300,
    height: 200,
    backgroundColor: pastelColors.placeholderBackground,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: pastelColors.borderColor,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tapText: {
    color: pastelColors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  fileName: {
    fontSize: 18,
    color: pastelColors.textSecondary,
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    flex: 0.45,
    paddingVertical: 18,
    backgroundColor: pastelColors.buttonBackground,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  buttonDisabled: {
    backgroundColor: pastelColors.buttonDisabledBackground,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
});

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View, StatusBar, Platform, ScrollView } from 'react-native';
import type { RootStackParamList } from '../navigator/appNavigator';
import { API_ENDPOINTS } from '../config/api';
import { colors } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

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
      const uploadResponse = await fetch(API_ENDPOINTS.uploadFloorMap, {
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
      <StatusBar barStyle="light-content" />

      {/* Header with Gradient */}
      <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessible={true}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Floor Map</Text>
          <View style={styles.backButton} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Instructions Card */}
        <View style={styles.instructionCard}>
          <Ionicons name="information-circle" size={24} color="#4facfe" />
          <Text style={styles.instructionText}>
            Select a floor map image to upload and process for indoor navigation
          </Text>
        </View>

        {/* Image Picker Card */}
        <TouchableOpacity
          style={styles.mapPlaceholder}
          onPress={pickDocument}
          accessibilityLabel="Select map image"
          accessibilityHint="Opens file picker to select a map image"
          activeOpacity={0.8}
        >
          {fileUri ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: fileUri }}
                style={styles.imagePreview}
                resizeMode="contain"
                accessible
                accessibilityLabel="Selected map image preview"
              />
              <BlurView intensity={80} style={styles.imageOverlay}>
                <Ionicons name="create-outline" size={24} color="#fff" />
                <Text style={styles.changeImageText}>Tap to change</Text>
              </BlurView>
            </View>
          ) : (
            <View style={styles.placeholderContent}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.uploadIconContainer}
              >
                <Ionicons name="cloud-upload-outline" size={48} color="#fff" />
              </LinearGradient>
              <Text style={styles.placeholderTitle}>Upload Floor Map</Text>
              <Text style={styles.placeholderSubtitle}>Tap to select an image from your device</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* File Info */}
        {fileName && (
          <View style={styles.fileInfoCard}>
            <Ionicons name="document-text-outline" size={24} color="#50c878" />
            <View style={styles.fileInfo}>
              <Text style={styles.fileLabel}>Selected File</Text>
              <Text style={styles.fileName}>{fileName}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#50c878" />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, !fileName && styles.buttonDisabled]}
            onPress={uploadFile}
            accessibilityRole="button"
            accessibilityLabel="Upload selected map"
            accessibilityHint="Uploads the selected map image to the backend"
            disabled={uploading || !fileName}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={uploading || !fileName ? ['#c5dacf', '#c5dacf'] : ['#f093fb', '#f5576c']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {uploading ? (
                <>
                  <Ionicons name="sync-outline" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Uploading...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Upload & Process</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('NormalMode')}
            accessibilityRole="button"
            accessibilityLabel="Navigate to Normal mode"
            accessibilityHint="Navigates to the main screen"
            activeOpacity={0.8}
          >
            <Ionicons name="navigate-outline" size={20} color="#4facfe" />
            <Text style={styles.secondaryButtonText}>Go to Detection</Text>
          </TouchableOpacity>
        </View>

        {/* Help Section */}
        <View style={styles.helpCard}>
          <Ionicons name="help-circle-outline" size={24} color="#FFB74D" />
          <View style={styles.helpContent}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpText}>
              Upload a clear floor plan image (PNG, JPG). The system will automatically detect rooms and create navigation paths.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  instructionCard: {
    flexDirection: 'row',
    backgroundColor: '#e8f5ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
    marginLeft: 12,
    lineHeight: 20,
  },
  mapPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  changeImageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  uploadIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  fileInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f9f1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4facfe',
  },
  helpCard: {
    flexDirection: 'row',
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 13,
    color: '#7f8c8d',
    lineHeight: 18,
  },
});

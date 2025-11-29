import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { testWakeWord, useWakeWordDetection, type VoiceCommand } from '../components/wakewordDetection';
import { API_ENDPOINTS } from '../config/api';
import type { RootStackParamList } from '../navigator/appNavigator';
import { handleVoiceCommand } from '../utils/voiceCommandHandler';

type SetFloorMapNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SetFloorMap'>;

interface SetFloorMapProps {
  navigation: SetFloorMapNavigationProp;
}

export default function SetFloorMap({ navigation }: SetFloorMapProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Voice command detection
  const { isListening, isRecording } = useWakeWordDetection({
    onWakeWordDetected: () => {
      Speech.speak('Yes?');
    },
    onCommandDetected: async (command: VoiceCommand) => {
      console.log('Voice command:', command);
      
      // Handle upload command
      if (command.action === 'upload' && fileUri) {
        await uploadFile();
        return;
      }
      
      // Handle other navigation commands
      await handleVoiceCommand(command, {
        router: navigation as any,
        onUpload: () => pickDocument(),
      });
    },
    enabled: voiceEnabled,
  });

  useEffect(() => {
    const announceScreen = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Speech.speak(
        'Select floor map screen. Upload a floor plan image to process for indoor navigation. Swipe to find the upload button.',
        { rate: 0.9 }
      );
    };
    announceScreen();
    
    // Cleanup: Stop speech when leaving screen
    return () => {
      Speech.stop();
    };
  }, []);

  const pickDocument = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Speech.speak('Opening file picker. Select a floor plan image.', { rate: 0.9 });
      
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);
        setFileUri(file.uri);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Speech.speak(`File selected: ${file.name}. Ready to upload.`, { rate: 0.9 });
        Alert.alert('File selected', file.name);
      } else {
        Speech.speak('File selection cancelled', { rate: 0.9 });
        console.log('User cancelled document picking');
      }
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = error instanceof Error ? error.message : String(error);
      Speech.speak('Error selecting file', { rate: 0.9 });
      Alert.alert('Error picking document', message);
    }
  };

  // Upload selected image to backend for processing
  const uploadFile = async () => {
    if (!fileUri || !fileName) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Speech.speak('Please select a map image before uploading', { rate: 0.9 });
      Alert.alert('No file selected', 'Please select a map image before uploading.');
      return;
    }

    setUploading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Speech.speak('Uploading and processing map. This may take a moment.', { rate: 0.9 });

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
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Speech.speak('Upload successful. Map has been processed and is ready for navigation.', { rate: 0.9 });
      Alert.alert('Upload Success', 'Your floor map has been processed successfully!');
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = error instanceof Error ? error.message : String(error);
      Speech.speak('Upload failed. Please try again.', { rate: 0.9 });
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
            onPress={() => {
              Speech.stop();
              navigation.goBack();
            }}
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
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => {
              Alert.alert(
                'Test Voice Command',
                'Choose a command to test:',
                [
                  {
                    text: 'Upload map',
                    onPress: () => testWakeWord(
                      () => Speech.speak('Yes?'),
                      async (cmd: VoiceCommand) => {
                        await handleVoiceCommand(cmd, {
                          router: navigation as any,
                          onUpload: () => pickDocument(),
                        });
                      },
                      'upload'
                    )
                  },
                  {
                    text: 'Process map',
                    onPress: () => testWakeWord(
                      () => Speech.speak('Yes?'),
                      async (cmd: VoiceCommand) => {
                        if (fileUri) {
                          await uploadFile();
                        } else {
                          Speech.speak('Please select a map first.');
                        }
                      },
                      'upload'
                    )
                  },
                  {
                    text: 'Navigate to menu',
                    onPress: () => testWakeWord(
                      () => Speech.speak('Yes?'),
                      async (cmd: VoiceCommand) => await handleVoiceCommand(cmd, {
                        router: navigation as any,
                      }),
                      'navigate to menu'
                    )
                  },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Text style={styles.testButtonText}>🎤 Test Voice Command</Text>
          </TouchableOpacity>
        )}

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
          accessibilityLabel={fileUri ? `Map image selected: ${fileName}. Double tap to change image.` : "Upload floor map. Double tap to select an image from your device."}
          accessibilityHint={fileUri ? "Opens file picker to change the selected map image" : "Opens file picker to select a floor plan image"}
          accessibilityRole="button"
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
            accessibilityLabel={uploading ? 'Uploading map, please wait' : (fileName ? `Upload ${fileName} to process map` : 'Upload button disabled. Please select a map first.')}
            accessibilityHint={uploading ? 'Upload in progress' : 'Double tap to upload and process the selected floor map'}
            accessibilityState={{ disabled: uploading || !fileName }}
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
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Speech.speak('Navigating to main menu', { rate: 0.9 });
              navigation.navigate('MainMenu');
            }}
            accessibilityRole="button"
            accessibilityLabel="Go to main menu"
            accessibilityHint="Double tap to navigate to the main menu screen"
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
    minHeight: 320,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
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
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
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
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    minHeight: 64,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 18,
    minHeight: 64,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4facfe',
  },
  voiceStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  voiceIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    flex: 1,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  voiceIndicatorActive: {
    backgroundColor: 'rgba(75, 230, 218, 0.95)',
  },
  voiceStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  voiceToggleButton: {
    backgroundColor: '#4facfe',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  voiceToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  testButton: {
    backgroundColor: 'rgba(79, 172, 254, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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

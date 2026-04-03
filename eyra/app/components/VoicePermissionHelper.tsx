/**
 * Voice Input Permission Helper
 * Manages microphone permissions and provides clear user guidance
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ExpoSpeechRecognitionModule, isNativeSpeechRecognitionAvailable } from '../libs/expoSpeechRecognitionShim';

interface VoicePermissionHelperProps {
  onPermissionGranted?: () => void;
  onDismiss?: () => void;
  showInstructions?: boolean;
}

export default function VoicePermissionHelper({ 
  onPermissionGranted,
  onDismiss,
  showInstructions = true 
}: VoicePermissionHelperProps) {
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'unavailable'>('checking');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      if (!isNativeSpeechRecognitionAvailable) {
        setPermissionStatus('unavailable');
        return;
      }

      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      if (result?.granted) {
        setPermissionStatus('granted');
        onPermissionGranted?.();
      } else {
        setPermissionStatus('denied');
      }
    } catch (error) {
      console.error('Permission check error:', error);
      setPermissionStatus('denied');
    }
  };

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    await checkPermission();
  };

  const handleOpenSettings = () => {
    Alert.alert(
      'Microphone Permission',
      'To use voice commands, please:\n\n1. Open Settings\n2. Find this app\n3. Enable Microphone permission\n4. Return to the app',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  };

  if (permissionStatus === 'checking') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="mic-outline" size={48} color="#667eea" />
          <Text style={styles.title}>Checking Permissions...</Text>
        </View>
      </View>
    );
  }

  if (permissionStatus === 'granted') {
    if (!showInstructions) return null;
    
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
          <Ionicons name="close" size={24} color="#7f8c8d" />
        </TouchableOpacity>
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#50c878" />
          <Text style={styles.successText}>Microphone permission granted!</Text>
        </View>
      </View>
    );
  }

  if (permissionStatus === 'unavailable') {
    return (
      <View style={styles.compactContainer}>
        <BlurView intensity={80} style={styles.compactBanner}>
          <View style={styles.compactContent}>
            <Ionicons name="information-circle" size={18} color="#FFB74D" />
            <Text style={styles.compactText}>
              Voice commands require development build
            </Text>
            <TouchableOpacity onPress={onDismiss} style={styles.compactCloseBtn}>
              <Ionicons name="close" size={18} color="#7f8c8d" />
            </TouchableOpacity>
          </View>
          <Text style={styles.compactSubtext}>All other features work normally</Text>
        </BlurView>
      </View>
    );
  }

  // Permission denied
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
        <Ionicons name="close" size={24} color="#7f8c8d" />
      </TouchableOpacity>
      <View style={[styles.card, styles.errorCard]}>
        <Ionicons name="mic-off-outline" size={48} color="#ff6b6b" />
        <Text style={styles.title}>Microphone Permission Required</Text>
        <Text style={styles.message}>
          Voice commands need microphone access to work. This allows you to control the app hands-free.
        </Text>

        <View style={styles.buttonContainer}>
          {retryCount < 2 ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleRetry}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.buttonText}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleOpenSettings}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="settings-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Open Settings</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.skipText}>
          You can still use the app without voice commands. All features work with touch gestures.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  warningCard: {
    borderWidth: 2,
    borderColor: '#FFB74D',
  },
  errorCard: {
    borderWidth: 2,
    borderColor: '#ff6b6b',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 8,
    marginBottom: 8,
  },
  stepContainer: {
    alignSelf: 'stretch',
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  step: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 8,
    lineHeight: 20,
  },
  note: {
    fontSize: 13,
    color: '#50c878',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 16,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipText: {
    fontSize: 13,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f9f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 8,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#50c878',
    marginLeft: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  compactBanner: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
    color: '#2c3e50',
    fontWeight: '500',
  },
  compactSubtext: {
    fontSize: 11,
    color: '#50c878',
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontWeight: '500',
  },
  compactCloseBtn: {
    padding: 4,
  },
});

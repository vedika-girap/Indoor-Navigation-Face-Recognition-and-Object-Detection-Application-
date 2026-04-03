import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from '../libs/expoSpeechRecognitionShim';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

export interface VoiceCommand {
  action: 'save_image' | 'navigate' | 'detect' | 'upload' | 'cancel' | 'unknown';
  params?: {
    destination?: string;
    name?: string;
  };
}

interface WakeWordDetectionProps {
  onWakeWordDetected: () => void;
  onCommandDetected: (command: VoiceCommand) => void;
  enabled?: boolean;
}

/**
 * Wake Word Detection Hook for Expo
 * - Uses expo-speech-recognition (works in Expo Go!)
 * - Listens continuously for wake word "Ziya"
 * - Then captures voice command
 */
export const useWakeWordDetection = ({
  onWakeWordDetected,
  onCommandDetected,
  enabled = true,
}: WakeWordDetectionProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const isWaitingForCommand = useRef(false);
  const recognitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request microphone permission on mount
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        console.log('��� Permission status:', result);
        setHasPermission(result.granted);
        
        if (result.granted) {
          console.log('✅ Microphone permission granted');
          Speech.speak('Voice assistant ready. Say Ziya to give a command');
        } else {
          console.warn('⚠️ Microphone permission denied');
          Alert.alert(
            'Microphone Permission Required',
            'Please grant microphone permission to use voice commands',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('❌ Permission request failed:', error);
        setHasPermission(false);
      }
    };

    requestPermissions();

    return () => {
      if (recognitionTimeout.current) {
        clearTimeout(recognitionTimeout.current);
      }
      stopListening();
    };
  }, []);

  // Listen for speech recognition results
  useSpeechRecognitionEvent('result', (event) => {
    if (!event.results || event.results.length === 0) {
      console.log('⚠️ No speech results');
      return;
    }

    const results = event.results[0];
    if (!results?.transcript) {
      return;
    }

    const transcript = results.transcript;
    const text = transcript.toLowerCase().trim();
    
    console.log(`📝 Heard: "${text}"`);
    Speech.speak(`I heard: ${text}`);

    // Check for wake word
    if (text.includes('ziya') || text.includes('zia') || text.includes('computer')) {
      console.log('��� Wake word detected!');
      onWakeWordDetected();
      Speech.speak('Yes, I am listening. Please say your command');
      isWaitingForCommand.current = true;
      
      // Continue listening for the command
      setTimeout(() => {
        restartListening();
      }, 2000);
    } 
    // If waiting for command, parse it
    else if (isWaitingForCommand.current) {
      const command = parseCommand(text);
      console.log('🎯 Command parsed:', command);
      Speech.speak(`Executing command: ${command.action}`);
      onCommandDetected(command);
      isWaitingForCommand.current = false;
      
      // Restart listening for next wake word
      setTimeout(() => {
        restartListening();
      }, 1000);
    } else {
      // Not wake word and not waiting for command, continue listening
      console.log('⏱️ Waiting for wake word...');
    }
  });

  // Listen for speech recognition start
  useSpeechRecognitionEvent('start', () => {
    console.log('��� Speech recognition started');
    setIsListening(true);
    setIsRecording(true);
  });

  // Listen for speech recognition end
  useSpeechRecognitionEvent('end', () => {
    console.log('��� Speech recognition ended');
    setIsRecording(false);
    
    // Auto-restart if still enabled
    if (enabled) {
      setTimeout(() => {
        restartListening();
      }, 500);
    }
  });

  // Listen for errors
  useSpeechRecognitionEvent('error', (event) => {
    console.error('❌ Speech recognition error:', event.error);
    
    if (event.error === 'no-speech') {
      console.log('⚠️ No speech detected, restarting...');
    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      Alert.alert(
        'Microphone Permission',
        'Please grant microphone permission to use voice commands',
        [{ text: 'OK' }]
      );
      setHasPermission(false);
    } else {
      Speech.speak('Voice recognition error occurred');
    }
    
    // Restart listening after error
    if (enabled) {
      setTimeout(() => {
        restartListening();
      }, 1000);
    }
  });

  // Start listening
  const startListening = async () => {
    if (!enabled || isListening || !hasPermission) {
      if (!hasPermission) {
        console.warn('⚠️ No microphone permission');
        Alert.alert(
          'Permission Required',
          'Please grant microphone permission to use voice commands',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    try {
      console.log('��� Starting voice recognition...');
      
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        contextualStrings: ['Ziya', 'navigate', 'detect', 'save', 'upload', 'cancel'],
      });
      
      setIsListening(true);
      
      // Set timeout to restart if no results after 10 seconds
      if (recognitionTimeout.current) {
        clearTimeout(recognitionTimeout.current);
      }
      recognitionTimeout.current = setTimeout(() => {
        console.log('⏱️ Recognition timeout, restarting...');
        restartListening();
      }, 10000);
      
    } catch (error) {
      console.error('❌ Failed to start voice recognition:', error);
      Alert.alert('Error', 'Failed to start voice recognition: ' + (error as Error).message);
    }
  };

  // Stop listening
  async function stopListening() {
    try {
      console.log('��� Stopping voice recognition...');
      await ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      setIsRecording(false);
      if (recognitionTimeout.current) {
        clearTimeout(recognitionTimeout.current);
      }
    } catch (error) {
      console.error('❌ Error stopping voice recognition:', error);
    }
  };

  // Restart listening (for continuous recognition)
  const restartListening = async () => {
    if (!enabled || !hasPermission) return;
    
    try {
      await stopListening();
      setTimeout(async () => {
        if (enabled && hasPermission) {
          await startListening();
        }
      }, 500);
    } catch (error) {
      console.error('❌ Error restarting voice recognition:', error);
    }
  };

  // Parse transcript into structured command
  const parseCommand = (transcript: string): VoiceCommand => {
    const lowerTranscript = transcript.toLowerCase();

    // Save image/face commands
    if (
      lowerTranscript.includes('save') &&
      (lowerTranscript.includes('image') || lowerTranscript.includes('face') || lowerTranscript.includes('photo'))
    ) {
      // Extract name if present
      const nameMatch = lowerTranscript.match(/(?:as|name|called)\s+(\w+)/);
      return {
        action: 'save_image',
        params: {
          name: nameMatch ? nameMatch[1] : undefined,
        },
      };
    }

    // Navigation commands
    if (
      lowerTranscript.includes('navigate') ||
      lowerTranscript.includes('go to') ||
      lowerTranscript.includes('open')
    ) {
      let destination = 'menu';
      
      if (lowerTranscript.includes('menu') || lowerTranscript.includes('main')) {
        destination = 'MainMenu';
      } else if (lowerTranscript.includes('floor') || lowerTranscript.includes('map')) {
        destination = 'SetFloorMap';
      } else if (lowerTranscript.includes('indoor') || lowerTranscript.includes('navigation')) {
        destination = 'IndoorNavigation';
      } else if (lowerTranscript.includes('normal') || lowerTranscript.includes('detection')) {
        destination = 'NormalMode';
      }

      return {
        action: 'navigate',
        params: { destination },
      };
    }

    // Detect command
    if (
      lowerTranscript.includes('detect') ||
      lowerTranscript.includes('scan') ||
      lowerTranscript.includes('analyze')
    ) {
      return { action: 'detect' };
    }

    // Upload command
    if (lowerTranscript.includes('upload')) {
      return { action: 'upload' };
    }

    // Cancel command
    if (
      lowerTranscript.includes('cancel') ||
      lowerTranscript.includes('stop') ||
      lowerTranscript.includes('nevermind')
    ) {
      return { action: 'cancel' };
    }

    return { action: 'unknown' };
  };

  // Auto start/stop based on enabled prop
  useEffect(() => {
    if (enabled && hasPermission) {
      console.log('✅ Starting continuous voice recognition...');
      Speech.speak('Voice assistant activated. Say Ziya to give a command');
      startListening();
    } else if (!enabled) {
      stopListening();
    }

    return () => {
      if (enabled) {
        stopListening();
      }
    };
  }, [enabled, hasPermission]);

  return {
    isListening,
    isRecording,
    hasPermission,
    isOnline: true,
    startListening,
    stopListening,
  };
};

// Helper function to manually trigger wake word (for testing)
export const testWakeWord = async (
  onWakeWordDetected: () => void,
  onCommandDetected: (command: VoiceCommand) => void,
  commandText: string
) => {
  console.log('��� Testing voice command:', commandText);
  onWakeWordDetected();
  Speech.speak('Wake word detected, testing command');
  
  // Parse the command
  const lowerCommand = commandText.toLowerCase();
  let command: VoiceCommand = { action: 'unknown' };

  if (lowerCommand.includes('save')) {
    const nameMatch = lowerCommand.match(/(?:as|name)\s+(\w+)/);
    command = {
      action: 'save_image',
      params: { name: nameMatch ? nameMatch[1] : undefined },
    };
  } else if (lowerCommand.includes('navigate') || lowerCommand.includes('go to')) {
    command.action = 'navigate';
    if (lowerCommand.includes('menu')) {
      command.params = { destination: 'MainMenu' };
    } else if (lowerCommand.includes('floor')) {
      command.params = { destination: 'SetFloorMap' };
    } else if (lowerCommand.includes('indoor')) {
      command.params = { destination: 'IndoorNavigation' };
    }
  } else if (lowerCommand.includes('detect')) {
    command.action = 'detect';
  } else if (lowerCommand.includes('upload')) {
    command.action = 'upload';
  }

  console.log('🎯 Parsed command:', command);
  Speech.speak(`Executing command: ${command.action}`);
  
  // Small delay to make it feel more natural
  setTimeout(() => {
    onCommandDetected(command);
  }, 500);
};

// Default export placeholder to satisfy Expo Router (this file is not a route)
export default function WakewordDetectionPlaceholder(): null {
  return null;
}

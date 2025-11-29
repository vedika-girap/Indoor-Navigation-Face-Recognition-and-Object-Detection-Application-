import { Router } from 'expo-router';
import * as Speech from 'expo-speech';
import { Alert, Platform, ToastAndroid } from 'react-native';
import { VoiceCommand } from '../components/wakewordDetection';

export interface VoiceCommandHandlerContext {
  router?: Router | any; // Support both expo-router and react-navigation
  onSaveImage?: (name?: string) => void;
  onDetect?: () => void;
  onUpload?: () => void;
}

export const handleVoiceCommand = async (
  command: VoiceCommand,
  context: VoiceCommandHandlerContext
) => {
  const { router, onSaveImage, onDetect, onUpload } = context;

  // Log incoming command and available context for debugging
  console.log('🟢 handleVoiceCommand invoked', { command, hasRouter: !!router, hasSave: !!onSaveImage, hasDetect: !!onDetect, hasUpload: !!onUpload });

  switch (command.action) {
    case 'save_image':
      if (onSaveImage) {
        const name = command.params?.name;
        Speech.speak(name ? `Saving image as ${name}` : 'Saving image');
        onSaveImage(name);
      } else {
        Speech.speak('Save image function is not available on this screen');
      }
      break;

    case 'navigate':
      if (router && command.params?.destination) {
        const destination = command.params.destination;
        console.log(`➡️ Voice navigation requested to: ${destination}`);
        Speech.speak(`Navigating to ${getReadableScreenName(destination)}`);
        try {
          const route = getRouteFromScreenName(destination);
          console.log('🔗 Resolved route:', route);
          // Attempt navigation
          router.push(route as any);
          console.log('✅ Navigation pushed to route:', route);
          // Lightweight UI feedback: toast on Android, alert fallback on iOS
          const msg = `Navigated to ${getReadableScreenName(destination)}`;
          if (Platform.OS === 'android') {
            ToastAndroid.show(msg, ToastAndroid.SHORT);
          } else {
            // non-blocking alert as fallback
            Alert.alert('Navigation', msg);
          }
        } catch (error) {
          console.error('❌ Navigation error:', error);
          Speech.speak('Unable to navigate to that screen');
        }
      } else {
        console.warn('⚠️ Navigation requested but router or destination missing', { routerPresent: !!router, destination: command.params?.destination });
        Speech.speak('Navigation is not available');
      }
      break;

    case 'detect':
      if (onDetect) {
        Speech.speak('Starting detection');
        onDetect();
      } else {
        Speech.speak('Detection function is not available on this screen');
      }
      break;

    case 'upload':
      if (onUpload) {
        Speech.speak('Starting upload');
        onUpload();
      } else {
        Speech.speak('Upload function is not available on this screen');
      }
      break;

    case 'cancel':
      Speech.speak('Command cancelled');
      break;

    case 'unknown':
    default:
      Speech.speak('Sorry, I did not understand that command. Please try again.');
      Alert.alert(
        'Unknown Command',
        'Available commands:\n' +
        '• "Save image" or "Save face"\n' +
        '• "Navigate to [menu/floor map/detection]"\n' +
        '• "Detect" or "Scan"\n' +
        '• "Upload"\n' +
        '• "Cancel"'
      );
      break;
  }
};

// Convert screen names to readable format
const getReadableScreenName = (screenName: string): string => {
  const nameMap: { [key: string]: string } = {
    'MainMenu': 'main menu',
    'SetFloorMap': 'floor map screen',
    'IndoorNavigation': 'indoor navigation',
    'NormalMode': 'detection mode',
  };

  return nameMap[screenName] || screenName;
};

// Convert screen names to Expo Router paths
const getRouteFromScreenName = (screenName: string): string => {
  const routeMap: { [key: string]: string } = {
    'MainMenu': '/screens/menu',
    'SetFloorMap': '/screens/setFloorMap',
    'IndoorNavigation': '/screens/indoorNavigation',
    'NormalMode': '/screens/normal',
    'ProcessFloorMap': '/screens/processFloorMap',
  };

  return routeMap[screenName] || '/';
};

// Voice command help text
export const getVoiceCommandHelp = (): string => {
  return `
Voice Commands Available:

Wake Word: "Ziya"

After saying "Ziya", you can use these commands:

1. Save Commands:
   - "Save image"
   - "Save face"
   - "Save image as [name]"

2. Navigation Commands:
   - "Navigate to menu"
   - "Go to floor map"
   - "Open detection"
   - "Navigate to indoor navigation"

3. Action Commands:
   - "Detect"
   - "Scan"
   - "Upload"

4. Cancel Command:
   - "Cancel"
   - "Stop"
   - "Nevermind"

Example Usage:
1. Say "Ziya"
2. Wait for response
3. Say your command, e.g., "Save face as John"
  `.trim();
};

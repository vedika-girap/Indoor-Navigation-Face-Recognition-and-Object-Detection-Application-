import { NavigationProp } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';
import { VoiceCommand } from '../components/wakewordDetection';

export interface VoiceCommandHandlerContext {
  navigation?: NavigationProp<any>;
  onSaveImage?: (name?: string) => void;
  onDetect?: () => void;
  onUpload?: () => void;
}

export const handleVoiceCommand = async (
  command: VoiceCommand,
  context: VoiceCommandHandlerContext
) => {
  const { navigation, onSaveImage, onDetect, onUpload } = context;

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
      if (navigation && command.params?.destination) {
        const destination = command.params.destination;
        Speech.speak(`Navigating to ${getReadableScreenName(destination)}`);
        
        try {
          navigation.navigate(destination as never);
        } catch (error) {
          console.error('Navigation error:', error);
          Speech.speak('Unable to navigate to that screen');
        }
      } else {
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

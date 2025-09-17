# Voice Navigation System

The Voice Navigation System allows users to control the Ziya app using voice commands. This system includes speech recognition, command processing, and navigation control.

## Features

- **Real Speech Recognition**: Uses Web Speech API on web platforms and fallback text input on mobile
- **Wake Word Activation**: Commands must start with "Ziya" to be processed
- **Visual Feedback**: Floating voice button with pulsing animation when listening
- **Command Confirmation**: Audio feedback for executed commands
- **Error Handling**: Graceful fallbacks when speech recognition fails

## Components

### Services

1. **VoiceNavigationService** (`app/services/voiceNavigation.ts`)

   - Main service for processing voice commands
   - Handles command registration and execution
   - Integrates with navigation system

2. **SpeechRecognitionService** (`app/services/speechRecognition.ts`)
   - Handles actual speech recognition
   - Web Speech API for web platforms
   - Text input fallback for mobile platforms

### Components

1. **GlobalVoiceListener** (`app/components/GlobalVoiceListener.tsx`)
   - Global floating voice button
   - Visual listening indicator
   - Toggle voice navigation on/off

## Usage

### Basic Setup

```typescript
import {
  voiceNavigationService,
  createNavigationCommands,
} from "../services/voiceNavigation";

// In your screen component
useEffect(() => {
  const commands = createNavigationCommands(navigation);
  voiceNavigationService.addCommands([...commands.home, ...commands.general]);

  return () => {
    voiceNavigationService.clearCommands();
  };
}, [navigation]);
```

### Available Commands

#### Navigation Commands

- "Ziya go home" / "Ziya home screen" → Navigate to Home
- "Ziya indoor navigation" / "Ziya navigate indoors" → Navigate to Indoor Navigation
- "Ziya menu" / "Ziya show menu" → Navigate to Menu
- "Ziya normal mode" / "Ziya normal navigation" → Navigate to Normal Mode
- "Ziya upload" / "Ziya upload floor map" → Navigate to Upload
- "Ziya set floor map" / "Ziya floor map settings" → Navigate to Set Floor Map
- "Ziya voice test" / "Ziya test voice" → Navigate to Voice Test

#### Control Commands

- "Ziya help" / "Ziya what can you do" → List available commands
- "Ziya go back" / "Ziya back" → Go to previous screen
- "Ziya stop listening" / "Ziya stop voice" → Stop voice navigation

### Custom Commands

```typescript
const customCommands = [
  {
    commands: ["custom action", "special function"],
    action: () => {
      // Your custom action here
      console.log("Custom action executed");
    },
    description: "Execute custom action",
  },
];

voiceNavigationService.addCommands(customCommands);
```

## Integration Guide

### 1. Wrap Your App

```typescript
import { GlobalVoiceListener } from "./app/components/GlobalVoiceListener";

export default function App() {
  return (
    <GlobalVoiceListener>
      <YourAppContent />
    </GlobalVoiceListener>
  );
}
```

### 2. Add to Screens

```typescript
import { voiceNavigationService, createNavigationCommands } from '../services/voiceNavigation';
import { useFocusEffect } from '@react-navigation/native';

export function HomeScreen({ navigation }) {
  useFocusEffect(
    useCallback(() => {
      const commands = createNavigationCommands(navigation);
      voiceNavigationService.addCommands([
        ...commands.home,
        ...commands.general
      ]);

      return () => {
        voiceNavigationService.clearCommands();
      };
    }, [navigation])
  );

  return (
    // Your screen content
  );
}
```

## Platform Support

### Web

- Uses Web Speech API (`webkitSpeechRecognition`)
- Real-time speech recognition
- High accuracy and performance

### Mobile (iOS/Android)

- Fallback to text input modal
- Future: Integration with react-native-voice
- Future: Cloud speech services (Google, Azure)

## Configuration

```typescript
const voiceNavigationService = new VoiceNavigationService({
  enabled: true, // Enable/disable voice navigation
  wakeWord: "ziya", // Wake word for commands
  timeout: 5000, // Speech recognition timeout
  confirmVoiceActions: true, // Speak command confirmations
});
```

## Testing

Use the voice navigation test utilities:

```typescript
import { VoiceNavigationTests } from "../tests/voiceNavigationTest";

// Run all tests
VoiceNavigationTests.runAll();

// Test specific functionality
VoiceNavigationTests.setup();
VoiceNavigationTests.commands();
VoiceNavigationTests.simulation();
```

## Development Notes

### Mock Commands for Testing

The system includes simulation capabilities for testing without actual speech:

```typescript
speechRecognitionService.simulateVoiceInput("ziya go home");
```

### Error Handling

- Graceful fallbacks when speech recognition fails
- Audio feedback for errors
- Console logging for debugging

### Performance

- Minimal impact on app performance
- Efficient command matching
- Background processing

## Future Enhancements

1. **Cloud Speech Services**: Integration with Google Speech API, Azure Speech Services
2. **Offline Recognition**: Local speech processing capabilities
3. **Multi-language Support**: Commands in multiple languages
4. **Context-aware Commands**: Different commands based on current screen context
5. **Voice Training**: Personalized voice recognition
6. **Gesture Integration**: Combine voice with gesture controls

## Troubleshooting

### Common Issues

1. **Voice commands not working on mobile**

   - Expected behavior: Uses text input fallback
   - Solution: Consider integrating react-native-voice

2. **No audio feedback**

   - Check expo-speech configuration
   - Ensure device volume is up

3. **Commands not recognized**

- Ensure commands start with wake word "Ziya"
- Check command registration in current screen

4. **Web Speech API not available**
   - Requires HTTPS in production
   - Supported browsers: Chrome, Firefox, Safari

### Debug Mode

Enable debug logging:

```typescript
// Add to your app initialization
console.log("Voice Navigation Debug Mode");
voiceNavigationService.announceCommands(); // Hear available commands
```

# Voice Command Feature - "Ziya" Wake Word

## Overview

The voice command feature allows users to control the app hands-free using voice commands. The wake word "Ziya" activates the voice command system.

## Features

- **Background Voice Detection**: Continuously listens for the wake word "Ziya" in the background
- **Command Processing**: After detecting "Ziya", the system listens for voice commands
- **Multiple Actions**: Supports navigation, image saving, object detection, and more
- **Speech Feedback**: Provides audio feedback for all actions
- **Toggle Control**: Can be enabled/disabled via UI

## Setup

### Dependencies Installed

- `expo-av`: For audio recording and processing
- `expo-speech`: For text-to-speech feedback

### Files Added/Modified

1. **`app/components/wakewordDetection.tsx`**: Core wake word detection logic
2. **`app/utils/voiceCommandHandler.ts`**: Voice command parsing and execution
3. **`app/screens/normal.tsx`**: Integrated voice commands into detection screen

## Usage

### Basic Flow

1. **Enable Voice Commands**: The feature is enabled by default on the Normal Mode screen
2. **Say Wake Word**: Say "Ziya" clearly
3. **Wait for Response**: The app will respond with "Yes, I am listening"
4. **Give Command**: Say your command within 5 seconds
5. **Confirmation**: The app will execute the command and provide feedback

### Available Commands

#### 1. Save Commands

- "Save image"
- "Save face"
- "Save image as [name]"
- "Save face as John"

**Example**:

- Say: "Ziya"
- Wait for response
- Say: "Save face as Mary"

#### 2. Navigation Commands

- "Navigate to menu"
- "Go to floor map"
- "Open detection"
- "Navigate to indoor navigation"

**Example**:

- Say: "Ziya"
- Wait for response
- Say: "Navigate to menu"

#### 3. Action Commands

- "Detect" - Triggers object/face detection
- "Scan" - Same as detect
- "Analyze" - Same as detect
- "Upload" - Triggers upload function (where available)

#### 4. Cancel Command

- "Cancel"
- "Stop"
- "Nevermind"

## Technical Implementation

### Wake Word Detection

The current implementation uses a mock detection system. For production use, you should integrate one of these services:

#### Option 1: Google Cloud Speech-to-Text

```javascript
// Add to mockSpeechRecognition function
const response = await fetch(
  "https://speech.googleapis.com/v1/speech:recognize",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 44100,
        languageCode: "en-US",
      },
      audio: {
        content: base64Audio,
      },
    }),
  }
);
```

#### Option 2: Azure Speech Services

```javascript
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const speechConfig = sdk.SpeechConfig.fromSubscription(KEY, REGION);
const audioConfig = sdk.AudioConfig.fromWavFileInput(audioFile);
const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
```

#### Option 3: AWS Transcribe

```javascript
const AWS = require("aws-sdk");
const transcribe = new AWS.TranscribeService();
// Upload audio and get transcription
```

#### Option 4: Local ML Model (Porcupine)

For offline wake word detection:

```bash
npm install @picovoice/porcupine-react-native
```

### Command Parsing

Commands are parsed using pattern matching in the `parseCommand` function. The system:

1. Converts speech to lowercase
2. Matches keywords and phrases
3. Extracts parameters (like names for saving)
4. Returns structured command object

### Voice Command Handler

The handler executes commands based on the current screen context:

- Checks if required functions are available
- Provides feedback for unavailable functions
- Handles navigation between screens
- Manages error cases gracefully

## Screen Integration

### Adding Voice Commands to Other Screens

To add voice commands to another screen:

```typescript
import {
  useWakeWordDetection,
  VoiceCommand,
} from "../components/wakewordDetection";
import { handleVoiceCommand } from "../utils/voiceCommandHandler";

export default function YourScreen() {
  const navigation = useNavigation();
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const handleWakeWordDetected = () => {
    console.log("Wake word detected!");
  };

  const handleCommandDetected = async (command: VoiceCommand) => {
    await handleVoiceCommand(command, {
      navigation,
      onSaveImage: (name) => {
        // Your save logic
      },
      onDetect: () => {
        // Your detect logic
      },
      onUpload: () => {
        // Your upload logic
      },
    });
  };

  const { isListening } = useWakeWordDetection({
    onWakeWordDetected: handleWakeWordDetected,
    onCommandDetected: handleCommandDetected,
    enabled: voiceEnabled,
  });

  // ... rest of your component
}
```

## Testing

### Manual Testing

Since the current implementation uses mock speech recognition, you can test by:

1. **Modify the mock function** in `wakewordDetection.tsx`:

```typescript
const mockSpeechRecognition = async (audioUri: string): Promise<string> => {
  // For testing, return a sample command
  return "ziya"; // or 'save face as john', etc.
};
```

2. **Use the test helper**:

```typescript
import { testWakeWord } from "../components/wakewordDetection";

// Simulate wake word + command
testWakeWord(
  handleWakeWordDetected,
  handleCommandDetected,
  "save face as john"
);
```

### Integration Testing

Once you integrate a real speech-to-text service:

1. Test wake word detection accuracy
2. Test command recognition in noisy environments
3. Test response time
4. Test battery consumption
5. Test with different accents and speech patterns

## Permissions

The app requires microphone permission. Users will be prompted on first use:

- **iOS**: Automatic permission dialog
- **Android**: Automatic permission dialog

If permission is denied, the voice command feature will not be available.

## Limitations

### Current Implementation

- Mock speech recognition (requires real implementation)
- Continuous listening may impact battery life
- Requires internet connection for cloud-based services
- Fixed wake word "Ziya" (cannot be customized)

### Recommendations

1. Implement actual speech-to-text service
2. Add battery optimization mode
3. Add offline wake word detection
4. Allow custom wake word configuration
5. Add confidence threshold settings
6. Implement better noise cancellation

## Troubleshooting

### Voice Not Detected

- Check microphone permissions
- Ensure voice command toggle is enabled
- Speak clearly and loudly
- Check if app has microphone access

### Commands Not Working

- Ensure you wait for "Yes, I am listening" before giving command
- Speak command clearly within 5 seconds
- Check available commands list
- Verify command context (some commands only work on specific screens)

### Performance Issues

- Disable voice commands when not needed
- Check battery optimization settings
- Ensure background processes are allowed

## Future Enhancements

1. Multi-language support
2. Custom wake words
3. Offline speech recognition
4. Voice training for better accuracy
5. Command history
6. Voice shortcuts
7. Integration with accessibility features
8. Support for longer, conversational commands

## Accessibility

This feature is designed to enhance accessibility for:

- Visually impaired users
- Users with motor disabilities
- Hands-free operation needs
- Multi-tasking scenarios

## Privacy

- Audio is only recorded when actively listening
- Recordings are processed and immediately discarded
- No audio data is stored permanently
- Cloud services (if used) follow their privacy policies

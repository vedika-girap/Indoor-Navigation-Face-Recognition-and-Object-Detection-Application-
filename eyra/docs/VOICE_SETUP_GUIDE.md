# Quick Setup Guide - Voice Commands

## ✅ Completed Implementation

### What Was Added:

1. **Wake Word Detection System** (`wakewordDetection.tsx`)

   - Continuous background listening for "Ziya"
   - Audio recording and processing
   - Command parsing and execution

2. **Voice Command Handler** (`voiceCommandHandler.ts`)

   - Command routing and execution
   - Navigation between screens
   - Action triggering (save, detect, upload)

3. **Screen Integrations**
   - ✅ Normal Mode screen (full voice control)
   - ✅ Set Floor Map screen (voice upload)
   - Voice indicators and toggle buttons

### How to Test:

#### Option 1: Using Test Helper (Recommended for initial testing)

```typescript
import { testWakeWord } from "../components/wakewordDetection";

// In your component
<TouchableOpacity
  onPress={() => {
    testWakeWord(
      handleWakeWordDetected,
      handleCommandDetected,
      "save face as john" // Test command
    );
  }}
>
  <Text>Test Voice Command</Text>
</TouchableOpacity>;
```

#### Option 2: Use Expo Speech (TTS) only and Web Speech API

Expo Speech (`expo-speech`) is Text-to-Speech only and does not provide speech-to-text on native platforms.

What works now:

- On Web (Expo Web): Wake word and commands work using the browser Web Speech API.
- On Native (Android/iOS): Voice feedback works; speech recognition is disabled by design.

If you need native speech-to-text, consider one of these options (requires a custom dev client and native modules):

- `react-native-voice` (online, platform STT)
- `@picovoice/porcupine-react-native` (offline wake word) + a cloud STT for commands

For this project, we’ve configured the hook to:

- Use Web Speech API automatically on web
- Show a helpful notice on native that STT isn’t available with expo-speech

### Available Commands:

| Command                    | Action                 | Example                      |
| -------------------------- | ---------------------- | ---------------------------- |
| "Save image" / "Save face" | Saves detected face    | "Ziya" → "Save face"         |
| "Save image as [name]"     | Saves with custom name | "Ziya" → "Save face as John" |
| "Navigate to menu"         | Goes to main menu      | "Ziya" → "Navigate to menu"  |
| "Navigate to floor map"    | Opens floor map        | "Ziya" → "Go to floor map"   |
| "Detect" / "Scan"          | Triggers detection     | "Ziya" → "Detect"            |
| "Upload"                   | Uploads file           | "Ziya" → "Upload"            |

### User Flow:

1. **Enable** - Voice is enabled by default
2. **Speak** - Say "Ziya" clearly
3. **Wait** - App responds "Yes, I am listening"
4. **Command** - Say your command within 5 seconds
5. **Feedback** - App confirms and executes

### Voice Indicator:

- 🎤 **Listening for "Ziya"...** - Actively listening
- 🎤 **Voice Ready** - Ready but not currently recording
- **Disable/Enable Voice** button - Toggle voice commands

### Permissions Required:

- ✅ Microphone (Audio recording)
- ✅ Camera (For detection screen)

### Files Modified:

```
app/
├── components/
│   └── wakewordDetection.tsx     (Voice detection logic)
├── utils/
│   └── voiceCommandHandler.ts    (Command handling)
└── screens/
    ├── normal.tsx                (With voice controls)
    └── setFloorMap.tsx           (With voice controls)

docs/
└── VOICE_COMMANDS.md             (Full documentation)

package.json                      (Added expo-av)
```

### Next Steps:

#### For Production:

1. **Implement Real Speech Recognition**

   - Choose and integrate a speech-to-text service
   - Add API keys to environment variables
   - Test accuracy with different voices/accents

2. **Optimize Performance**

   - Add battery optimization
   - Implement better wake word detection (Porcupine)
   - Cache common commands

3. **Enhance User Experience**

   - Add visual feedback during listening
   - Show command suggestions
   - Add voice training

4. **Testing**
   - Test in noisy environments
   - Test with different accents
   - Test battery consumption
   - Test offline functionality

#### For Development:

1. **Test Current Implementation**

   - Use test helper to simulate commands
   - Verify command parsing
   - Test navigation flows

2. **Add More Commands**

   - Edit `parseCommand` in `wakewordDetection.tsx`
   - Add handlers in `voiceCommandHandler.ts`
   - Update documentation

3. **Integrate to More Screens**
   - Copy integration pattern from `normal.tsx`
   - Add screen-specific commands
   - Update command handler context

### Troubleshooting:

**Voice not detecting:**

- Check microphone permissions in device settings
- Ensure voice toggle is enabled
- Verify expo-av is installed correctly

**Commands not working:**

- Check console logs for command detection
- Verify command syntax matches available commands
- Ensure required functions are available on current screen

**App crashes:**

- Check Audio permissions are granted
- Verify expo-av is compatible with your Expo SDK version
- Check for memory leaks in continuous listening

### Support:

- See full documentation: `docs/VOICE_COMMANDS.md`
- Check implementation: `app/components/wakewordDetection.tsx`
- Review command handling: `app/utils/voiceCommandHandler.ts`

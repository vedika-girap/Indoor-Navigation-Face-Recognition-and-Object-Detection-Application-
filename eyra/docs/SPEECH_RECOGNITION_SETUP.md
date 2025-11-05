# Complete Speech Recognition Setup Guide

## 🎯 Overview

This guide will help you set up real speech recognition for the "Ziya" wake word feature using Google Cloud Speech-to-Text API.

## ✅ What's Already Done

- ✅ expo-av installed (audio recording)
- ✅ expo-file-system installed (file handling)
- ✅ Speech recognition service created
- ✅ Wake word detection integrated
- ✅ Voice command handling implemented

## 🚀 Quick Setup (3 Options)

### Option 1: Google Cloud Speech-to-Text (Recommended - Best Accuracy)

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Enter project name: "eyra-speech" (or your choice)
4. Click "Create"

#### Step 2: Enable Speech-to-Text API

1. In the search bar, type "Speech-to-Text API"
2. Click on "Cloud Speech-to-Text API"
3. Click "Enable"
4. Wait for API to be enabled (takes ~30 seconds)

#### Step 3: Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "API Key"
3. Copy the API key (it will look like: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)
4. Click "Restrict Key" (recommended for production)
   - Under "API restrictions", select "Restrict key"
   - Choose "Cloud Speech-to-Text API"
   - Click "Save"

#### Step 4: Add API Key to Your Project

**Option A: Using Environment Variable** (Recommended for development)

```bash
# Create .env file in project root
echo "GOOGLE_SPEECH_API_KEY=YOUR_API_KEY_HERE" > .env
```

**Option B: Using app.config.js** (Direct configuration)

```javascript
// app.config.js
export default {
  expo: {
    name: "eyra",
    slug: "your-app-slug",
    extra: {
      backendUrl: "http://10.126.188.99:8000",
      googleSpeechApiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // Replace with your key
    },
  },
};
```

#### Step 5: Test Your Setup

```bash
# Restart your Expo app to load the new configuration
npx expo start --clear
```

---

### Option 2: Test Mode (No API Key Required)

For testing without API key, the system will use mock mode. To test specific commands:

**Edit:** `app/services/speechRecognitionService.ts`

Find the `mockTranscription` function (line ~160) and modify it:

```typescript
private mockTranscription(audioUri: string): Promise<string> {
  console.log('Mock transcription for:', audioUri);

  // Test different commands by returning different strings
  // Uncomment the line you want to test:

  // return Promise.resolve('ziya'); // Test wake word detection
  // return Promise.resolve('save face as john'); // Test save command
  // return Promise.resolve('navigate to menu'); // Test navigation
  // return Promise.resolve('detect'); // Test detect command

  return Promise.resolve(''); // Default: no detection
}
```

Then use the test helper in your components:

```typescript
import { testWakeWord } from "../components/wakewordDetection";

// Add a test button
<TouchableOpacity
  onPress={() => {
    testWakeWord(
      handleWakeWordDetected,
      handleCommandDetected,
      "save face as mary" // Test command here
    );
  }}
>
  <Text>Test Voice Command</Text>
</TouchableOpacity>;
```

---

### Option 3: Alternative Speech Services

#### Azure Speech Services

1. Create Azure account at [portal.azure.com](https://portal.azure.com)
2. Create a "Speech Services" resource
3. Get subscription key and region
4. Use the `transcribeAzure` method in the service

```typescript
// In wakewordDetection.tsx, replace:
const transcript = await speechRecognitionService.transcribe(audioUri);

// With:
const transcript = await speechRecognitionService.transcribeAzure(
  audioUri,
  "YOUR_SUBSCRIPTION_KEY",
  "YOUR_REGION" // e.g., 'eastus'
);
```

---

## 🧪 Testing Your Implementation

### Test 1: Check Service Configuration

Add this to your Normal screen component:

```typescript
useEffect(() => {
  speechRecognitionService.test().then((isReady) => {
    console.log("Speech service ready:", isReady);
    if (!isReady) {
      Alert.alert("Info", "Voice commands will use test mode");
    }
  });
}, []);
```

### Test 2: Test Wake Word Detection

1. Enable voice commands (toggle button should show "Listening for Ziya...")
2. Say "Ziya" clearly into your device microphone
3. Wait for response: "Yes, I am listening"
4. Say a command like "Save face"
5. Check console logs for transcription results

### Test 3: Verify Command Parsing

Check console logs for:

```
Wake word detection - Transcript: ziya
Command detection - Transcript: save face as john
```

---

## 🔧 Troubleshooting

### Problem: "No API key configured" warning

**Solution**: Make sure you've added the API key to `app.config.js` and restarted Expo

### Problem: Voice not detecting

**Checklist**:

- ✅ Microphone permission granted?
- ✅ Voice toggle enabled?
- ✅ Speaking clearly and loudly?
- ✅ API key configured correctly?
- ✅ Internet connection active?

### Problem: API Error 403 (Forbidden)

**Solution**:

- Check if API is enabled in Google Cloud Console
- Verify API key restrictions allow Speech-to-Text API
- Make sure billing is enabled (Google provides free tier)

### Problem: API Error 400 (Bad Request)

**Possible causes**:

- Audio format not supported
- Audio file too large
- Invalid encoding settings

**Solution**: Check audio recording settings in `wakewordDetection.tsx`

### Problem: Commands not recognized

**Solution**:

- Speak slowly and clearly
- Use exact command phrases from documentation
- Check command parsing in console logs
- Adjust language code if needed

---

## 💰 Cost Information

### Google Cloud Speech-to-Text Pricing

- **Free tier**: 60 minutes per month
- **After free tier**: $0.006 per 15 seconds

### Estimated Usage for Your App

- Wake word check: ~2 seconds every 3 seconds when listening
- Command detection: ~5 seconds per command
- **Estimated monthly cost**: Under $5 for typical usage

**Tip**: Implement caching and optimize listening intervals to reduce costs.

---

## 🎯 Advanced Configuration

### Optimize for Battery Life

Edit `wakewordDetection.tsx`:

```typescript
// Change listening interval from 3 seconds to 5 seconds
listeningIntervalRef.current = setInterval(async () => {
  await recordAndProcessAudio();
}, 5000); // Changed from 3000 to 5000
```

### Improve Recognition Accuracy

In `speechRecognitionService.ts`, update the config:

```typescript
body: JSON.stringify({
  config: {
    encoding: this.encoding,
    sampleRateHertz: this.sampleRateHertz,
    languageCode: this.languageCode,
    enableAutomaticPunctuation: false,
    model: 'command_and_search', // Best for voice commands
    useEnhanced: true, // Better accuracy (slightly more expensive)
    enableWordTimeOffsets: false, // Not needed for commands
  },
  audio: {
    content: audioBase64,
  },
}),
```

### Support Multiple Languages

```typescript
// In app.config.js
extra: {
  googleSpeechApiKey: "YOUR_KEY",
  speechLanguage: "es-ES", // Spanish
  // Or: "hi-IN" for Hindi, "fr-FR" for French, etc.
}

// In speechRecognitionService.ts constructor:
this.languageCode = config.languageCode || expoConfig?.speechLanguage || 'en-US';
```

---

## 📱 Alternative: Offline Wake Word Detection

For offline wake word detection without internet:

### Using Porcupine (Recommended for offline)

```bash
npm install @picovoice/porcupine-react-native
```

Then create a new wake word detector service that uses Porcupine for wake word detection and only uses Google Cloud for command transcription.

---

## ✅ Verification Checklist

Before going to production, verify:

- [ ] API key configured and tested
- [ ] Wake word detection working
- [ ] Commands being recognized
- [ ] Navigation working via voice
- [ ] Save face command working
- [ ] Detect command working
- [ ] Voice feedback playing correctly
- [ ] Error handling working
- [ ] Battery consumption acceptable
- [ ] Cost estimates within budget

---

## 🆘 Need Help?

1. **Check Console Logs**: All transcriptions and errors are logged
2. **Test API Directly**: Use Google's [Speech-to-Text UI](https://cloud.google.com/speech-to-text#test-the-api)
3. **Verify Audio Quality**: Record and play back audio to ensure it's clear
4. **Check Network**: Speech recognition requires internet connection

---

## 📝 Quick Reference

### Wake Word: "Ziya"

### Commands After Wake Word:

| Say This              | What Happens                    |
| --------------------- | ------------------------------- |
| "Save face"           | Saves first detected face       |
| "Save face as [name]" | Saves with custom name          |
| "Navigate to menu"    | Goes to main menu               |
| "Go to floor map"     | Opens floor map screen          |
| "Detect" or "Scan"    | Triggers detection              |
| "Upload"              | Uploads file (on upload screen) |

### Files to Configure:

1. `app.config.js` - Add API key
2. `app/services/speechRecognitionService.ts` - Service implementation
3. `app/components/wakewordDetection.tsx` - Wake word logic
4. `.env` - Environment variables (optional)

---

## 🚀 You're All Set!

Once you've completed the setup:

1. Start your app: `npx expo start`
2. Say "Ziya" to activate
3. Give your command
4. Enjoy hands-free control!

For more details, see:

- `docs/VOICE_COMMANDS.md` - Full command documentation
- `docs/VOICE_SETUP_GUIDE.md` - Quick setup guide

# Voice Navigation System Documentation

## Overview

The Ziya app now includes a comprehensive voice navigation system that allows users to control the entire app using voice commands. Users can navigate between screens, perform actions, and control the app hands-free.

## Features

### 🎤 **Global Voice Navigation**

- **Floating Voice Button**: Always accessible voice activation button in the bottom-right corner
- **Visual Feedback**: Pulsing animation when listening, color changes for status
- **Cross-Screen Functionality**: Works on all screens throughout the app

### 🗣️ **Wake Word Detection**

- **Wake Word**: "Ziya" - say this before any command
- **Example**: "Ziya, go to indoor navigation"

### 🧭 **Universal Navigation Commands**

Available on all screens:

- **"Ziya, go home"** - Navigate to home screen
- **"Ziya, indoor navigation"** - Open indoor navigation
- **"Ziya, main menu"** - Open main menu
- **"Ziya, normal mode"** - Open camera detection mode
- **"Ziya, set floor map"** - Open floor map settings
- **"Ziya, go back"** - Return to previous screen
- **"Ziya, help"** - List available commands
- **"Ziya, stop listening"** - Disable voice navigation

## Screen-Specific Commands

### 🏠 **Home Screen**

- All universal navigation commands
- Voice activation through dedicated button
- Automatic announcement of available options

### 🗺️ **Indoor Navigation Screen**

- **"Ziya, add floor map"** - Open add map dialog
- **"Ziya, select map"** - Instructions for map selection
- **"Ziya, voice navigation"** - Activate voice commands

### 📷 **Normal Mode (Camera) Screen**

- **"Ziya, detect objects"** - Capture and analyze frame
- **"Ziya, scan"** - Alternative detection command
- **"Ziya, clear results"** - Clear detection results
- **"Ziya, reset"** - Clear all data

## How to Use

### Method 1: Voice Button

1. Tap the floating microphone button (bottom-right corner)
2. Follow on-screen instructions
3. Say "Ziya" followed by your command

### Method 2: Direct Voice Commands

1. Ensure voice navigation is active (button shows red when listening)
2. Say "Ziya" + your command
3. Wait for confirmation speech

### Method 3: Help System

1. Say "Ziya, help" to hear available commands
2. Or tap "Voice Commands Help" on the home screen

## Voice Feedback

### 📢 **Audio Confirmations**

- Command acknowledgment: "Executing: [action]"
- Navigation announcements when entering screens
- Error messages for unrecognized commands
- Status updates (listening/stopped)

### 👁️ **Visual Indicators**

- **Blue Button**: Voice navigation ready
- **Red Button + Pulsing**: Currently listening
- **"Listening..." Text**: Active voice detection
- **Voice Status**: Shows on home screen

## Technical Implementation

### 🏗️ **Architecture**

- **VoiceNavigationService**: Core voice command processing
- **GlobalVoiceListener**: App-wide voice interface
- **Screen Integration**: Each screen registers custom commands
- **Navigation Integration**: Works with React Navigation

### 🔧 **Key Components**

```typescript
// Voice Navigation Service
voiceNavigationService.addCommands(commands)
voiceNavigationService.startListening()
voiceNavigationService.processVoiceInput(input)

// Command Structure
{
  commands: ['go home', 'home screen'],
  action: () => navigation.navigate('Home'),
  description: 'Go to home screen'
}
```

## Customization

### Adding New Commands

1. Edit the screen's `useFocusEffect` hook
2. Add command object to `screenSpecificCommands`
3. Include alternative phrasings in `commands` array

### Modifying Wake Word

1. Edit `voiceNavigation.ts`
2. Change `wakeWord` in VoiceNavigationService constructor
3. Update documentation and help text

## Accessibility Features

### ♿ **Inclusive Design**

- **Screen Reader Support**: All buttons have accessibility labels
- **Voice Alternative**: Complete app control without touch
- **Visual Feedback**: Status indicators for hearing-impaired users
- **Clear Audio**: Loud, clear speech synthesis

### 🎯 **User Benefits**

- **Hands-Free Operation**: Perfect for navigation while walking
- **Accessibility Support**: Assists users with motor impairments
- **Eyes-Free Usage**: Use app without looking at screen
- **Quick Navigation**: Faster than tapping through menus

## Future Enhancements

### 🚀 **Planned Features**

1. **Real Speech Recognition**: Integration with device speech APIs
2. **Custom Wake Words**: User-configurable activation phrases
3. **Voice Training**: Personalized voice recognition
4. **Offline Mode**: Local speech processing
5. **Multi-Language**: Support for different languages

### 🔮 **Advanced Capabilities**

- **Context Awareness**: Commands based on current screen state
- **Voice Shortcuts**: Custom user-defined commands
- **Voice Macros**: Chain multiple actions together
- **Smart Suggestions**: AI-powered command recommendations

## Troubleshooting

### Common Issues

1. **Commands Not Recognized**: Ensure you say "Ziya" first
2. **No Voice Feedback**: Check device volume and TTS settings
3. **Button Not Responding**: Tap the floating microphone button
4. **Wrong Action**: Try alternative command phrasings

### Debug Mode

- Enable by tapping voice button multiple times
- Shows detected commands in alerts
- Test commands without actual execution

## Integration with Backend

The voice navigation system can be extended to work with the backend voice assistant:

### 🔗 **Backend Integration Points**

- **Wake Word Detection**: Uses AssemblyAI for "Ziya" detection
- **Command Processing**: Natural language understanding
- **Response Generation**: Contextual voice responses
- **Location Services**: Voice-guided indoor navigation

### 🌐 **API Endpoints**

- `/voice/process` - Process voice commands
- `/voice/status` - Get voice system status
- `/voice/train` - Train custom commands

This voice navigation system provides a complete hands-free experience for the Ziya indoor navigation app, making it more accessible and user-friendly for all users.

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from "../navigator/appNavigator";
import * as Speech from 'expo-speech';
import { voiceNavigationService, createNavigationCommands } from '../services/voiceNavigation';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const BUTTONS = [
  { 
    label: "Indoor Navigation", 
    action: (navigation: HomeScreenNavigationProp) => navigation.navigate('IndoorNavigation'),
    type: 'navigation' as const
  },
  { 
    label: "Main Menu", 
    action: (navigation: HomeScreenNavigationProp) => navigation.navigate('MainMenu'),
    type: 'navigation' as const
  },
  { 
    label: "Normal Mode", 
    action: (navigation: HomeScreenNavigationProp) => navigation.navigate('NormalMode'),
    type: 'navigation' as const
  },
  { 
    label: "Voice Navigation", 
    action: () => voiceNavigationService.startListening(),
    type: 'voice' as const
  },
  { 
    label: "Voice Test", 
    action: (navigation: HomeScreenNavigationProp) => navigation.navigate('VoiceTest'),
    type: 'navigation' as const
  }
];

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const voiceCommandsRef = useRef(createNavigationCommands(navigation));

  // Setup voice commands when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const commands = [
        ...voiceCommandsRef.current.home,
        ...voiceCommandsRef.current.general
      ];
      
      voiceNavigationService.addCommands(commands);
      
      return () => {
        voiceNavigationService.clearCommands();
      };
    }, [])
  );

  useEffect(() => {
    const names = BUTTONS.map(b => b.label).join(", ");
  Speech.speak(`Welcome to Ziya. Available options are: ${names}. You can also use voice commands by saying "Ziya" followed by your command.`);
  }, []);

  return (
    <View style={styles.container}>
       <TouchableOpacity
         style={styles.circle} 
        onPress={() => navigation.navigate('MainMenu')}
        accessibilityRole="button"
        accessibilityLabel="Ziya logo, navigate to Main Menu"
        accessibilityHint="Tap to open Main Menu"
      >
      <Text style={styles.circleText}>Ziya</Text>
       </TouchableOpacity>

       {/* Voice Status Indicator */}
       <View style={styles.voiceStatus}>
         <Text style={styles.voiceStatusText}>
           Voice Navigation: {voiceNavigationService.getListeningStatus() ? 'Active' : 'Ready'}
         </Text>
       </View>

      {BUTTONS.map(button => (
        <TouchableOpacity
          key={button.label}
          style={[
            styles.button, 
            button.type === "voice" && styles.voiceButton
          ]}
          onPress={() => {
            Speech.speak(`${button.label} selected`);
            if (button.type === 'voice') {
              (button.action as () => void)();
            } else {
              (button.action as (nav: HomeScreenNavigationProp) => void)(navigation);
            }
          }}
          accessibilityLabel={button.label}
          accessibilityRole="button"
          accessibilityHint={`Tap to ${button.label.toLowerCase()}`}
        >
          <Text style={[
            styles.buttonText,
            button.type === "voice" && styles.voiceButtonText
          ]}>
            {button.label}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Voice Commands Help */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => {
          Alert.alert(
            'Voice Commands Help',
            'Say "Ziya" followed by:\n\n• "Indoor navigation" - Open navigation\n• "Main menu" - Open menu\n• "Normal mode" - Open camera mode\n• "Help" - List all commands\n• "Go back" - Previous screen',
            [{ text: 'Got it!' }]
          );
        }}
        accessibilityLabel="Voice commands help"
      >
        <Text style={styles.helpButtonText}>Voice Commands Help</Text>
      </TouchableOpacity>
    </View>
  );
}

const pastelColors = {
  background: '#F0F4EF',
  circleBackground: '#A0C1B8',
  circleText: '#2C3E50',
  buttonBackground: '#6A8E7F',
  buttonShadow: '#52796F',
  buttonText: '#ECF0F1',
  voiceButtonBackground: '#4A90E2',
  voiceButtonText: '#FFFFFF',
  helpButtonBackground: '#E8F4FD',
  helpButtonText: '#2C3E50',
  voiceStatusBackground: '#FFF3CD',
  voiceStatusText: '#856404',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: pastelColors.circleBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  circleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: pastelColors.circleText,
  },
  button: {
    width: 260,
    backgroundColor: pastelColors.buttonBackground,
    paddingVertical: 18,
    marginVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: pastelColors.buttonShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    color: pastelColors.buttonText,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  voiceStatus: {
    backgroundColor: pastelColors.voiceStatusBackground,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D1ECF1',
  },
  voiceStatusText: {
    color: pastelColors.voiceStatusText,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  voiceButton: {
    backgroundColor: pastelColors.voiceButtonBackground,
    borderColor: '#357ABD',
  },
  voiceButtonText: {
    color: pastelColors.voiceButtonText,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  helpButton: {
    backgroundColor: pastelColors.helpButtonBackground,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#B8DAFF',
    elevation: 2,
  },
  helpButtonText: {
    color: pastelColors.helpButtonText,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

import * as Speech from 'expo-speech';
import React, { useEffect } from 'react';
import { Alert, Button, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/appNavigator';

type VoiceTestNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VoiceTest'>;

const BUTTONS = [
  { label: 'Go To Home', action: (navigation: VoiceTestNavigationProp) => { navigation.navigate('Home'); } },
  { label: 'Set Floor Map', action: () => Alert.alert('Set Floor Map opened') },
  { label: 'Normal Mode', action: () => Alert.alert('Normal Mode opened') },
];

export default function VoiceTest() {
  const navigation = useNavigation<VoiceTestNavigationProp>();

  useEffect(() => {
    const names = BUTTONS.map(b => b.label).join(', ');
    Speech.speak(`Available options are: ${names}. Please select an option.`);
  }, []);

  const startVoiceInput = () => {
    Alert.alert('Voice input is not supported in this current Expo environment.');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {BUTTONS.map((button) => (
        <Button
          key={button.label}
          title={button.label}
          onPress={() => {
            Speech.speak(`${button.label} selected`);
            button.action(navigation);
          }}
          accessibilityState={{ disabled: false }}
          accessibilityLabel={button.label}
        />
      ))}
      <Button title="Voice Select Option" onPress={startVoiceInput} />
    </View>
  );
}

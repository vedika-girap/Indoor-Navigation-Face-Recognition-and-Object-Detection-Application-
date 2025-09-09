import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Speech from 'expo-speech';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/appNavigator';

type MainMenuNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainMenu'>;

interface MainMenuProps {
  navigation: MainMenuNavigationProp;
}

const MainMenu = ({ navigation }: MainMenuProps) => {
  useEffect(() => {
    const options = ['set floor map', 'check your surrounding'];
    const speechText = `Available options are: ${options.join(', ')}. Please select an option.`;
    Speech.speak(speechText);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.speak('Set floor map selected');
          navigation.navigate('SetFloorMap');
        }}
        accessibilityLabel="Set floor map"
        accessibilityRole="button"
        accessibilityHint="Navigates to set floor map screen"
      >
        <Text style={styles.buttonText}>Set Floor Map</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.speak('Check your surrounding selected');
          navigation.navigate('NormalMode');
        }}
        accessibilityLabel="Check your surrounding"
        accessibilityRole="button"
        accessibilityHint="Navigates to check your surrounding screen"
      >
        <Text style={styles.buttonText}>Check Your{'\n'}Surrounding</Text>
      </TouchableOpacity>
    </View>
  );
};

const pastelColors = {
  background: '#E8F0F2',
  buttonBackground: '#A3D2CA',
  buttonText: '#205072',
  buttonShadow: '#88BDBC',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  button: {
    width: 280,
    paddingVertical: 20,
    marginVertical: 15,
    backgroundColor: pastelColors.buttonBackground,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: pastelColors.buttonShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 7,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '700',
    color: pastelColors.buttonText,
    textAlign: 'center',
    letterSpacing: 1,
  },
});

export default MainMenu;

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
      >
        <Text style={styles.buttonText}>set floor map</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.speak('Check your surrounding selected');
          navigation.navigate('NormalMode');
        }}
        accessibilityLabel="Check your surrounding"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>check your{'\n'}surrounding</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF6C2',
  },
  button: {
    width: 250,
    paddingVertical: 15,
    marginVertical: 10,
    backgroundColor: '#D3D3D3',
    alignItems: 'center',
    borderRadius: 4,
  },
  buttonText: {
    fontSize: 18,
    textAlign: 'center',
  },
});

export default MainMenu;

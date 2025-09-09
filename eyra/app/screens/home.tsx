import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from "../navigator/appNavigator";
import * as Speech from 'expo-speech';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const BUTTONS = [
  { label: "Voice Test", action: (navigation: HomeScreenNavigationProp) => navigation.navigate('VoiceTest') },
  { label: "MainMenu", action: (navigation: HomeScreenNavigationProp) => navigation.navigate('MainMenu') },
  { label: "Show Alert", action: () => Alert.alert('This is an alert from HomeScreen') }
];

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  useEffect(() => {
    const names = BUTTONS.map(b => b.label).join(", ");
    Speech.speak(`Available options are: ${names}. Please select an option.`);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.Circle} onPress={() => navigation.navigate('MainMenu')}>
        <Text style={styles.textStyles}>Eyra</Text>
      </TouchableOpacity>

      {BUTTONS.map((button) => (
        <TouchableOpacity
          key={button.label}
          style={styles.button}
          onPress={() => {
            Speech.speak(`${button.label} selected`);
            button.action(navigation);
          }}
          accessibilityLabel={button.label}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{button.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
    justifyContent:'center',
    alignItems: 'center',
    padding: 20,
  },
  Circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#D3ECA7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  textStyles: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6f865cff',
  },
  button: {
    width: 250,
    backgroundColor: '#6f865c',
    paddingVertical: 15,
    marginVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

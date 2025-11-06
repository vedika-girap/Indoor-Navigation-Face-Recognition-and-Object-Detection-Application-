import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

const BUTTONS = [
  { 
    label: "Indoor Navigation", 
    path: '/screens/indoorNavigation',
    type: 'navigation' as const
  },
  { 
    label: "Main Menu", 
    path: '/screens/menu',
    type: 'navigation' as const
  },
  { 
    label: "Normal Mode", 
    path: '/screens/normal',
    type: 'navigation' as const
  }
];

export default function HomeScreen() {
  const router = useRouter();
  useEffect(() => {
    const names = BUTTONS.map(b => b.label).join(", ");
    Speech.speak(`Welcome to Ziya. Available options are: ${names}.`);
  }, []);

  return (
    <View style={styles.container}>
       <TouchableOpacity
         style={styles.circle} 
        onPress={() => router.push('/screens/menu')}
        accessibilityRole="button"
        accessibilityLabel="Ziya logo, navigate to Main Menu"
        accessibilityHint="Tap to open Main Menu"
      >
      <Text style={styles.circleText}>Ziya</Text>
       </TouchableOpacity>

      {BUTTONS.map(button => (
        <TouchableOpacity
          key={button.label}
          style={styles.button}
          onPress={() => {
            Speech.speak(`${button.label} selected`);
            router.push(button.path as any);
          }}
          accessibilityLabel={button.label}
          accessibilityRole="button"
          accessibilityHint={`Tap to ${button.label.toLowerCase()}`}
        >
          <Text style={styles.buttonText}>
            {button.label}
          </Text>
        </TouchableOpacity>
      ))}
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
});

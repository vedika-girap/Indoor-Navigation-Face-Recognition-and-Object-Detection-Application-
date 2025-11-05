import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    // Announce welcome message
    const announceWelcome = () => {
      const names = ['Indoor Navigation', 'Main Menu', 'Normal Mode'];
      Speech.speak(`Welcome to Ziya. Available options are: ${names.join(', ')}.`);
    };

    const timer = setTimeout(announceWelcome, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.circleButton}
        onPress={() => router.push('/screens/menu')}
        accessibilityLabel="Ziya logo, navigate to Main Menu"
      >
        <Text style={styles.circleText}>Ziya</Text>
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => router.push('/screens/indoorNavigation')}
        >
          <Text style={styles.buttonText}>Indoor Navigation</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => router.push('/screens/normal')}
        >
          <Text style={styles.buttonText}>Normal Mode</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 20,
  },
  circleButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  circleText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  navButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

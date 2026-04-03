import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';

const MainMenu = () => {
  const router = useRouter();
  
  useEffect(() => {
    const options = ['indoor navigation', 'path guidance', 'manage floor maps', 'manage faces', 'process floor map', 'check your surrounding'];
    const speechText = `Available options are: ${options.join(', ')}. Please select an option.`;
    Speech.speak(speechText);
    
    // Cleanup: Stop speech when leaving screen
    return () => {
      Speech.stop();
    };
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.stop();
          Speech.speak('Indoor navigation selected');
          setTimeout(() => router.push('/screens/indoorNavigation'), 500);
        }}
        accessibilityLabel="Indoor navigation"
        accessibilityRole="button"
        accessibilityHint="Navigate using recorded floor maps"
      >
        <Text style={styles.buttonText}>Indoor{'\n'}Navigation</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.stop();
          Speech.speak('Path guidance selected');
          setTimeout(() => router.push('/screens/pathGuidance'), 500);
        }}
        accessibilityLabel="Path guidance"
        accessibilityRole="button"
        accessibilityHint="Real-time obstacle detection and path guidance with voice alerts"
      >
        <Text style={styles.buttonText}>Path{'\n'}Guidance</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.stop();
          Speech.speak('Manage floor maps selected');
          setTimeout(() => router.push('/screens/floorMapManagement'), 500);
        }}
        accessibilityLabel="Manage floor maps"
        accessibilityRole="button"
        accessibilityHint="Navigates to floor map management screen"
      >
        <Text style={styles.buttonText}>Manage Floor{'\n'}Maps</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.stop();
          Speech.speak('Manage faces selected');
          setTimeout(() => router.push('/screens/faceManagement'), 500);
        }}
        accessibilityLabel="Manage faces"
        accessibilityRole="button"
        accessibilityHint="Manage saved faces, edit names, or delete"
      >
        <Text style={styles.buttonText}>Manage{'\n'}Faces</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.stop();
          Speech.speak('Process floor map selected');
          setTimeout(() => router.push('/screens/processFloorMap'), 500);
        }}
        accessibilityLabel="Process floor map"
        accessibilityRole="button"
        accessibilityHint="Select a floor map to send to server for processing"
      >
        <Text style={styles.buttonText}>Process Floor{"\n"}Map</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          Speech.stop();
          Speech.speak('Check your surrounding selected');
          setTimeout(() => router.push('/screens/normal'), 500);
        }}
        accessibilityLabel="Check your surrounding"
        accessibilityRole="button"
        accessibilityHint="Navigates to check your surrounding screen"
      >
        <Text style={styles.buttonText}>Check Your{'\n'}Surrounding</Text>
      </TouchableOpacity>
      </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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

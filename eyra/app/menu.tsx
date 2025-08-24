import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import type { NavigationProp } from '@react-navigation/native';

interface MainMenuProps {
  navigation: NavigationProp<any>;
}

const MainMenu = ({ navigation }: MainMenuProps) => (
  <View style={styles.container}>
    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('SetFloorMap')}>
      <Text style={styles.buttonText}>set floor map</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Navigate')}>
      <Text style={styles.buttonText}>navigate</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('CheckSurrounding')}>
      <Text style={styles.buttonText}>check your{'\n'}surrounding</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF6C2', // light greenish background
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

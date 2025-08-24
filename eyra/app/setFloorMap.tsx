import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import type { NavigationProp } from '@react-navigation/native';

interface MainMenuProps {
  navigation: NavigationProp<any>;
}

const SetFloorMap: React.FC<MainMenuProps> = ({ navigation }) => (
  <View style={styles.container}>
    <Text style={styles.header}>set floor map</Text>
    
    <View style={styles.mapPlaceholder}>
      {/* Replace with your actual map component or image upload */}
    </View>

    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Navigate')}>
      <Text style={styles.buttonText}>navigate</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF6C2',
    alignItems: 'center',
  },
  header: {
    marginTop: 40,
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 20,
  },
  mapPlaceholder: {
    width: 250,
    height: 180,
    backgroundColor: '#D3D3D3',
    marginBottom: 40,
    alignSelf: 'center',
  },
  button: {
    width: 200,
    paddingVertical: 15,
    backgroundColor: '#D3D3D3',
    alignItems: 'center',
    borderRadius: 4,
    position: 'absolute',
    bottom: 40,
  },
  buttonText: {
    fontSize: 18,
  },
});

export default SetFloorMap;

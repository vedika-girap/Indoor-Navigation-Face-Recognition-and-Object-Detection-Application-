import * as ImagePicker from 'expo-image-picker';
import React, { useState, useRef } from 'react';
import {
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from "../navigator/appNavigator";
import * as Speech from 'expo-speech';
import { voiceNavigationService, createNavigationCommands } from '../services/voiceNavigation';

type IndoorNavigationProp = NativeStackNavigationProp<RootStackParamList, 'IndoorNavigation'>;

const pastelColors = {
  background: '#E8F0F2',
  cardBackground: '#F8F2F7',
  buttonBackground: '#A3D2CA',
  buttonDisabledBackground: '#c5dacf',
  textPrimary: '#20639B',
  textSecondary: '#395B64',
  placeholderBackground: '#D6DBD2',
  borderColor: '#2F5061',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
    alignItems: 'center',
    padding: 30,
  },
  header: {
    marginTop: 50,
    fontSize: 28,
    fontWeight: '700',
    color: pastelColors.textPrimary,
    marginBottom: 30,
  },
  mapPlaceholder: {
    width: 300,
    height: 200,
    backgroundColor: pastelColors.placeholderBackground,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: pastelColors.borderColor,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  mapName: {
    fontSize: 18,
    color: pastelColors.textSecondary,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  flatList: {
    height: 120,
    marginBottom: 15,
  },
  card: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: pastelColors.borderColor,
    padding: 10,
    alignItems: 'center',
    marginRight: 12,
    width: 120,
    elevation: 2,
  },
  smallImage: {
    width: 96,
    height: 64,
    borderRadius: 8,
  },
  selectedCard: {
    borderColor: pastelColors.textPrimary,
    borderWidth: 3,
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  button: {
    flex: 0.45,
    paddingVertical: 18,
    backgroundColor: pastelColors.buttonBackground,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  buttonDisabled: {
    backgroundColor: pastelColors.buttonDisabledBackground,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(55,75,75,0.2)',
  },
  modalView: {
    backgroundColor: pastelColors.cardBackground,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    elevation: 5,
    width: 320,
  },
  textInput: {
    width: 230,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pastelColors.borderColor,
    fontSize: 18,
    backgroundColor: '#fff',
    marginBottom: 18,
    padding: 10,
    color: pastelColors.textPrimary,
    textAlign: 'center',
  },
  modalCancel: {
    marginTop: 8,
    color: pastelColors.textSecondary,
    fontSize: 16,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
});

const defaultMaps = [
  {
    id: '1',
    name: 'College 1st Floor',
    image: require('../../assets/images/floorMaps/2ndFloor.png'),
    isStatic: true,
  },
  {
    id: '2',
    name: 'College 2nd Floor',
    image: require('../../assets/images/floorMaps/2ndFloor.png'),
    isStatic: true,
  },
];

export default function IndoorNavigation() {
  const navigation = useNavigation<IndoorNavigationProp>();
  const [maps, setMaps] = useState(defaultMaps);
  const [selected, setSelected] = useState(defaultMaps[0]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapUri, setNewMapUri] = useState<string | null>(null);
  const voiceCommandsRef = useRef(createNavigationCommands(navigation));

  // Setup voice commands for this screen
  useFocusEffect(
    React.useCallback(() => {
      const screenSpecificCommands = [
        {
          commands: ['add floor map', 'add map', 'new map'],
          action: () => setModalVisible(true),
          description: 'Add new floor map'
        },
        {
          commands: ['select map', 'choose map', 'pick map'],
          action: () => Speech.speak('Please tap on a map to select it'),
          description: 'Select a floor map'
        },
        {
          commands: ['voice navigation', 'activate voice'],
          action: () => voiceNavigationService.startListening(),
          description: 'Activate voice navigation'
        }
      ];

      const commands = [
        ...voiceCommandsRef.current.general,
        ...screenSpecificCommands
      ];
      
      voiceNavigationService.addCommands(commands);
      
      // Announce screen capabilities
  Speech.speak('Indoor Navigation screen. You can add floor maps, select maps, or use voice commands. Say "Ziya help" for available commands.');
      
      return () => {
        voiceNavigationService.clearCommands();
      };
    }, [])
  );

  // Image Picker Handler using expo-image-picker
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].uri) {
      setNewMapUri(result.assets[0].uri);
    }
  };

  // Add Map Logic
  const handleAddMap = () => {
    if (newMapName && newMapUri) {
      const newMap = {
        id: Date.now().toString(),
        name: newMapName,
        image: { uri: newMapUri },
        isStatic: false,
      };
      const updated = [...maps, newMap];
      setMaps(updated);
      setSelected(newMap);
      setModalVisible(false);
      setNewMapName('');
      setNewMapUri(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Indoor Navigation</Text>
      <FlatList
        style={styles.flatList}
        data={maps}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              item.id === selected.id && styles.selectedCard
            ]}
            onPress={() => setSelected(item)}
            activeOpacity={0.8}
          >
            <Image source={item.image} style={styles.smallImage} resizeMode="cover" />
            <Text numberOfLines={1} style={styles.mapName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <View style={styles.mapPlaceholder}>
        {selected?.image ? (
          <Image source={selected.image} style={styles.imagePreview} resizeMode="contain" />
        ) : (
          <Text style={styles.mapName}>Select or add a floor map</Text>
        )}
      </View>
      <Text style={styles.mapName}>{selected?.name}</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.buttonText}>Add Floor Map</Text>
        </TouchableOpacity>
      </View>
      {/* Modal for Adding New Map */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Floor Name"
              placeholderTextColor={pastelColors.textSecondary}
              value={newMapName}
              onChangeText={setNewMapName}
            />
            <TouchableOpacity
              style={[
                styles.button,
                !newMapName && styles.buttonDisabled,
                { marginVertical: 8, width: 160 },
              ]}
              onPress={pickImage}
            >
              <Text style={styles.buttonText}>
                {newMapUri ? 'Change Image' : 'Pick Image'}
              </Text>
            </TouchableOpacity>
            {newMapUri && (
              <Image
                source={{ uri: newMapUri }}
                style={{
                  width: 130,
                  height: 90,
                  marginBottom: 10,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: pastelColors.borderColor,
                }}
              />
            )}
            <TouchableOpacity
              style={[
                styles.button,
                (!newMapName || !newMapUri) && styles.buttonDisabled,
                { width: 160 },
              ]}
              onPress={handleAddMap}
              disabled={!newMapName || !newMapUri}
            >
              <Text style={styles.buttonText}>Add Map</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

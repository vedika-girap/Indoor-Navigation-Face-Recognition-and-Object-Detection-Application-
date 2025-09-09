import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/appNavigator';

type SetFloorMapNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SetFloorMap'>;

interface SetFloorMapProps {
  navigation: SetFloorMapNavigationProp;
}

export default function SetFloorMap({ navigation }: SetFloorMapProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);
        setFileUri(file.uri);
        Alert.alert('File selected:', file.name);

        // Uncomment to upload after pick
        // await uploadFile(file.uri, file.name);
      } else {
        console.log('User cancelled document picking');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error picking document', message);
    }
  };

  const uploadFile = async (fileUri: string, fileName: string) => {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: blob.type || 'application/octet-stream',
      } as any);

      const uploadResponse = await fetch('https://your-backend-endpoint/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const result = await uploadResponse.json();
      Alert.alert('Upload Success', JSON.stringify(result));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Upload Error', message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Set Floor Map</Text>

      <TouchableOpacity style={styles.mapPlaceholder} onPress={pickDocument}>
        {fileUri ? (
          <Image source={{ uri: fileUri }} style={styles.imagePreview} resizeMode="contain" />
        ) : (
          <Text>Tap to select map file</Text>
        )}
      </TouchableOpacity>

      {fileName ? <Text style={styles.fileName}>{fileName}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('NormalMode')}>
        <Text style={styles.buttonText}>navigate</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF6C2',
    alignItems: 'center',
    padding: 20,
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
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  fileName: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
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

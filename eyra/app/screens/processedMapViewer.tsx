import React, { useState } from 'react';
import { View, Text, Image, ScrollView, Button, StyleSheet, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function ProcessedMapViewer() {
  const route = useRoute();
  const navigation = useNavigation();
  const { processed, original } = (route.params as any) || {};
  const [saving, setSaving] = useState(false);

  if (!processed) {
    return (
      <View style={styles.center}>
        <Text>No processed data provided</Text>
      </View>
    );
  }

  const b64 = processed.processed_image_base64 as string;
  const labels = processed.labels || [];

  const saveToDevice = async () => {
    try {
      setSaving(true);
      const fileName = `processed_map_${Date.now()}.png`;
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
      const path = `${docDir}${fileName}`;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: (FileSystem as any).EncodingType.Base64 });
      setSaving(false);
      Alert.alert('Saved', `Processed map saved to ${path}`);
    } catch (e) {
      setSaving(false);
      console.error('Save error', e);
      Alert.alert('Error', `Failed to save: ${e}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Processed Map</Text>
      <Image source={{ uri: `data:image/png;base64,${b64}` }} style={styles.image} resizeMode="contain" />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detected Regions</Text>
        {labels.length === 0 ? (
          <Text style={{ color: '#666' }}>No regions detected</Text>
        ) : (
          labels.map((l: any, idx: number) => (
            <View key={idx} style={styles.labelRow}>
              <Text style={styles.labelText}>{l.label}</Text>
              <Text style={styles.meta}>{`area: ${Math.round(l.area)}`}</Text>
            </View>
          ))
        )}
      </View>

      <View style={{ marginVertical: 12 }}>
        <Button title={saving ? 'Saving...' : 'Save Processed Map to Device'} onPress={saveToDevice} disabled={saving} />
      </View>

      <View style={{ marginTop: 20 }}>
        <Button title="Back" onPress={() => (navigation as any).goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center', backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  image: { width: '100%', height: 400, backgroundColor: '#eee' },
  section: { width: '100%', marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  labelText: { fontWeight: '600' },
  meta: { color: '#666' }
});

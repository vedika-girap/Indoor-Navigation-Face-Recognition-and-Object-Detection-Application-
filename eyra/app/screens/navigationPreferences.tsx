import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

const STORAGE_KEY = 'nav_preferences';

export default function NavigationPreferences() {
  const [preferences, setPreferences] = useState({
    avoid_stairs: false,
    prefer_wide_corridors: true,
    avoid_crowds: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) setPreferences(JSON.parse(json));
      } catch (e) {
        console.warn('Failed to load navigation preferences', e);
      }
    })();
  }, []);

  const save = async (newPrefs: any) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } catch (e) {
      console.warn('Failed to save navigation preferences', e);
    }
  };

  const toggle = (key: string) => {
    const updated = { ...preferences, [key]: !preferences[key as keyof typeof preferences] };
    setPreferences(updated);
    save(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Navigation Preferences</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Avoid Stairs</Text>
        <Switch value={preferences.avoid_stairs} onValueChange={() => toggle('avoid_stairs')} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Prefer Wide Corridors</Text>
        <Switch value={preferences.prefer_wide_corridors} onValueChange={() => toggle('prefer_wide_corridors')} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Avoid Crowded Areas</Text>
        <Switch value={preferences.avoid_crowds} onValueChange={() => toggle('avoid_crowds')} />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={() => save(preferences)}>
        <Text style={styles.saveText}>{saved ? 'Saved' : 'Save Preferences'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 16, color: colors.text },
  saveButton: { marginTop: 20, backgroundColor: colors.primary, padding: 12, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600' },
});

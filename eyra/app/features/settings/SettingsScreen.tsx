import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import accessibilityService from '../../services/accessibilityService';
import verbosityManager, { VerbosityMode } from '../../services/verbosityManager';
import actionHistoryManager from '../../services/actionHistoryManager';

interface SettingSection {
  title: string;
  items: SettingItem[];
}

interface SettingItem {
  id: string;
  label: string;
  description: string;
  type: 'verbosity' | 'toggle' | 'action';
  value?: any;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<VerbosityMode>('detailed');
  const [autoSuggestions, setAutoSuggestions] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  useEffect(() => {
    initializeSettings();
  }, []);

  const initializeSettings = async () => {
    await verbosityManager.initialize();
    const mode = verbosityManager.getMode();
    setCurrentMode(mode);

    actionHistoryManager.addBreadcrumb('settings', 'Settings');

    accessibilityService.speak(
      'Settings screen. Configure verbosity modes, voice feedback, and accessibility preferences.',
      2,
      false
    );
  };

  const handleModeChange = async (mode: VerbosityMode) => {
    const previousMode = currentMode;

    await accessibilityService.setVerbosityMode(mode);
    setCurrentMode(mode);

    accessibilityService.speak(
      `Verbosity mode changed to ${mode}. ${verbosityManager.getModeDescription(mode)}`,
      2,
      false
    );
    accessibilityService.triggerHaptic('success');

    actionHistoryManager.recordAction({
      type: 'settings_change',
      description: `Changed verbosity to ${mode}`,
      reversible: false,
    });
  };

  const handleToggleSuggestions = () => {
    const newValue = !autoSuggestions;
    setAutoSuggestions(newValue);

    accessibilityService.speak(
      `Auto suggestions ${newValue ? 'enabled' : 'disabled'}`,
      3
    );
    accessibilityService.triggerHaptic('buttonPress');
  };

  const handleToggleHaptics = () => {
    const newValue = !hapticFeedback;
    setHapticFeedback(newValue);

    accessibilityService.speak(
      `Haptic feedback ${newValue ? 'enabled' : 'disabled'}`,
      3
    );
    if (newValue) {
      accessibilityService.triggerHaptic('success');
    }
  };

  const handleResetUsage = async () => {
    accessibilityService.speak('Usage statistics reset feature coming soon.', 2);
    accessibilityService.triggerHaptic('success');
  };

  const handleViewHistory = () => {
    accessibilityService.speak('Action history feature coming soon.', 2);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#43e97b', '#38f9d7']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessible={true}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.backButton} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Verbosity Mode Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="volume-medium-outline" size={24} color="#43e97b" />
            <Text style={styles.sectionTitle}>Verbosity Mode</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Choose how much detail you hear in announcements
          </Text>

          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={[
                styles.modeCard,
                currentMode === 'brief' && styles.modeCardActive,
              ]}
              onPress={() => handleModeChange('brief')}
              accessible={true}
              accessibilityLabel="Brief mode. Minimal announcements for experienced users."
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.modeIcon,
                  currentMode === 'brief' && styles.modeIconActive,
                ]}
              >
                <Ionicons
                  name="flash"
                  size={28}
                  color={currentMode === 'brief' ? '#fff' : '#43e97b'}
                />
              </View>
              <Text
                style={[
                  styles.modeTitle,
                  currentMode === 'brief' && styles.modeTitleActive,
                ]}
              >
                Brief
              </Text>
              <Text
                style={[
                  styles.modeDescription,
                  currentMode === 'brief' && styles.modeDescriptionActive,
                ]}
              >
                Minimal announcements for experienced users
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeCard,
                currentMode === 'detailed' && styles.modeCardActive,
              ]}
              onPress={() => handleModeChange('detailed')}
              accessible={true}
              accessibilityLabel="Detailed mode. Balanced information for regular users."
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.modeIcon,
                  currentMode === 'detailed' && styles.modeIconActive,
                ]}
              >
                <Ionicons
                  name="information-circle"
                  size={28}
                  color={currentMode === 'detailed' ? '#fff' : '#667eea'}
                />
              </View>
              <Text
                style={[
                  styles.modeTitle,
                  currentMode === 'detailed' && styles.modeTitleActive,
                ]}
              >
                Detailed
              </Text>
              <Text
                style={[
                  styles.modeDescription,
                  currentMode === 'detailed' && styles.modeDescriptionActive,
                ]}
              >
                Balanced information for regular users
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeCard,
                currentMode === 'learning' && styles.modeCardActive,
              ]}
              onPress={() => handleModeChange('learning')}
              accessible={true}
              accessibilityLabel="Learning mode. Comprehensive guidance for new users."
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.modeIcon,
                  currentMode === 'learning' && styles.modeIconActive,
                ]}
              >
                <Ionicons
                  name="school"
                  size={28}
                  color={currentMode === 'learning' ? '#fff' : '#f5576c'}
                />
              </View>
              <Text
                style={[
                  styles.modeTitle,
                  currentMode === 'learning' && styles.modeTitleActive,
                ]}
              >
                Learning
              </Text>
              <Text
                style={[
                  styles.modeDescription,
                  currentMode === 'learning' && styles.modeDescriptionActive,
                ]}
              >
                Comprehensive guidance for new users
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Accessibility Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="accessibility-outline" size={24} color="#667eea" />
            <Text style={styles.sectionTitle}>Accessibility</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto Mode Suggestions</Text>
              <Text style={styles.settingSubtext}>
                Recommend verbosity mode based on usage
              </Text>
            </View>
            <Switch
              value={autoSuggestions}
              onValueChange={handleToggleSuggestions}
              trackColor={{ false: '#e0e6ed', true: '#43e97b' }}
              thumbColor={autoSuggestions ? '#fff' : '#f4f4f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <Text style={styles.settingSubtext}>
                Vibration confirmation for actions
              </Text>
            </View>
            <Switch
              value={hapticFeedback}
              onValueChange={handleToggleHaptics}
              trackColor={{ false: '#e0e6ed', true: '#667eea' }}
              thumbColor={hapticFeedback ? '#fff' : '#f4f4f4'}
            />
          </View>
        </View>

        {/* Data & History Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={24} color="#f5576c" />
            <Text style={styles.sectionTitle}>Data & History</Text>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleViewHistory}
            accessible={true}
            accessibilityLabel="View action history"
            accessibilityRole="button"
          >
            <Ionicons name="list-outline" size={22} color="#667eea" />
            <Text style={styles.actionLabel}>View Action History</Text>
            <Ionicons name="chevron-forward" size={20} color="#7f8c8d" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleResetUsage}
            accessible={true}
            accessibilityLabel="Reset usage statistics"
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={22} color="#f5576c" />
            <Text style={styles.actionLabel}>Reset Usage Stats</Text>
            <Ionicons name="chevron-forward" size={20} color="#7f8c8d" />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={24} color="#7f8c8d" />
            <Text style={styles.sectionTitle}>About</Text>
          </View>

          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>Ziya Navigation Assistant</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
            <Text style={styles.aboutDescription}>
              Intelligent eyes-free navigation with adaptive voice feedback and gesture controls.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
    lineHeight: 20,
  },
  modeContainer: {
    gap: 12,
  },
  modeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e0e6ed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modeCardActive: {
    borderColor: '#43e97b',
    backgroundColor: '#43e97b',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  modeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeIconActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  modeTitleActive: {
    color: '#fff',
  },
  modeDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
  modeDescriptionActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  settingSubtext: {
    fontSize: 13,
    color: '#7f8c8d',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 12,
  },
  aboutCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 12,
  },
  aboutDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
});

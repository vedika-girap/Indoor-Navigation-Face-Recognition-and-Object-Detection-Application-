/**
 * Settings Screen - Verbosity & Accessibility Preferences
 * Fully gesture-controlled, voice-first design
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import GestureHandler from '../components/GestureHandler';
import { accessibilityService } from '../services/accessibilityService';
import verbosityManager, { VerbosityMode } from '../services/verbosityManager';
import actionHistoryManager from '../services/actionHistoryManager';
import { colors } from '../theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<VerbosityMode>('detailed');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modes: VerbosityMode[] = ['brief', 'detailed', 'learning'];

  useEffect(() => {
    initializeSettings();
  }, []);

  const initializeSettings = async () => {
    await verbosityManager.initialize();
    const mode = verbosityManager.getMode();
    setCurrentMode(mode);
    setSelectedIndex(modes.indexOf(mode));
    
    // Add breadcrumb
    actionHistoryManager.addBreadcrumb('settings', 'Settings Screen');
    
    // Announce current settings
    accessibilityService.speak(
      `Settings. Current verbosity mode is ${mode}. ${verbosityManager.getModeDescription(mode)}. Swipe left or right to browse modes, double tap to select, shake to exit.`,
      2
    );
  };

  const announceModeDetails = (mode: VerbosityMode) => {
    const description = verbosityManager.getModeDescription(mode);
    const usage = verbosityManager.getRecommendedMode();
    const recommendation = usage === mode ? ' This mode is recommended based on your usage.' : '';
    
    accessibilityService.speak(
      `${mode} mode. ${description}${recommendation}`,
      2
    );
  };

  const handleSwipeRight = () => {
    const newIndex = (selectedIndex + 1) % modes.length;
    setSelectedIndex(newIndex);
    announceModeDetails(modes[newIndex]);
    accessibilityService.triggerHaptic('swipe');
  };

  const handleSwipeLeft = () => {
    const newIndex = selectedIndex === 0 ? modes.length - 1 : selectedIndex - 1;
    setSelectedIndex(newIndex);
    announceModeDetails(modes[newIndex]);
    accessibilityService.triggerHaptic('swipe');
  };

  const handleDoubleTap = async () => {
    const selectedMode = modes[selectedIndex];
    const previousMode = currentMode;
    
    await accessibilityService.setVerbosityMode(selectedMode);
    setCurrentMode(selectedMode);
    accessibilityService.triggerHaptic('success');
    
    // Record action with undo
    await actionHistoryManager.recordAction({
      type: 'settings_change',
      description: `Changed verbosity mode to ${selectedMode}`,
      reversible: true,
      undoDescription: `Verbosity mode reverted to ${previousMode}`,
      data: { previousMode, newMode: selectedMode },
      undo: async () => {
        await accessibilityService.setVerbosityMode(previousMode);
        setCurrentMode(previousMode);
      },
    });
    
    // Return to home after 1 second
    setTimeout(() => {
      router.back();
    }, 1000);
  };

  const handleLongPress = () => {
    accessibilityService.speak(
      `Settings screen. You are currently on ${modes[selectedIndex]} mode. Swipe left or right to browse the three verbosity modes: brief, detailed, and learning. Double tap to select a mode. Shake to exit without saving.`,
      2
    );
    accessibilityService.triggerHaptic('buttonPress');
  };

  const handleShake = () => {
    accessibilityService.speak('Exiting settings. Mode not changed.', 2);
    accessibilityService.triggerHaptic('warning');
    router.back();
  };

  return (
    <GestureHandler
      config={{
        onSwipeLeft: handleSwipeLeft,
        onSwipeRight: handleSwipeRight,
        onDoubleTap: handleDoubleTap,
        onLongPress: handleLongPress,
        onShake: handleShake,
      }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Verbosity Settings</Text>
        
        <View style={styles.modeContainer}>
          {modes.map((mode, index) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeCard,
                selectedIndex === index && styles.selectedCard,
                currentMode === mode && styles.activeCard,
              ]}
              onPress={() => {
                setSelectedIndex(index);
                announceModeDetails(mode);
              }}
              accessible={true}
              accessibilityLabel={`${mode} mode. ${verbosityManager.getModeDescription(mode)}`}
            >
              <Text style={[
                styles.modeTitle,
                selectedIndex === index && styles.selectedText,
              ]}>
                {mode.toUpperCase()}
              </Text>
              
              {currentMode === mode && (
                <Text style={styles.activeIndicator}>● Active</Text>
              )}
              
              <Text style={[
                styles.modeDescription,
                selectedIndex === index && styles.selectedText,
              ]}>
                {verbosityManager.getModeDescription(mode)}
              </Text>
              
              {verbosityManager.getRecommendedMode() === mode && (
                <Text style={styles.recommendedBadge}>Recommended</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionTitle}>Gestures:</Text>
          <Text style={styles.instruction}>◄ ► Swipe: Browse modes</Text>
          <Text style={styles.instruction}>⊙⊙ Double tap: Select mode</Text>
          <Text style={styles.instruction}>⊙ Long press: Help</Text>
          <Text style={styles.instruction}>↯ Shake: Exit</Text>
        </View>

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            Current: {currentMode} | Selected: {modes[selectedIndex]}
          </Text>
        </View>
      </View>
    </GestureHandler>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  modeContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  modeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  activeCard: {
    backgroundColor: colors.success + '20',
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  selectedText: {
    color: colors.white,
  },
  activeIndicator: {
    color: colors.success,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  recommendedBadge: {
    marginTop: 10,
    color: colors.success,
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  instruction: {
    fontSize: 14,
    color: colors.textSecondary,
    marginVertical: 4,
  },
  statusBar: {
    backgroundColor: colors.primaryDark,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  statusText: {
    color: colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
});

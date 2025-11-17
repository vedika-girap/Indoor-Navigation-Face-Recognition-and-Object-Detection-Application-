/**
 * Comprehensive Accessibility Service for Blind Users
 * Handles gestures, haptics, speech queue, and audio beacons
 */

import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { verbosityManager, VerbosityMode } from './verbosityManager';

// Speech Queue Management
interface SpeechItem {
  text: string;
  priority: number; // 1=Critical, 2=High, 3=Medium, 4=Low
  timestamp: number;
  interruptible: boolean;
}

class AccessibilityService {
  private speechQueue: SpeechItem[] = [];
  private speechHistory: SpeechItem[] = [];
  private isSpeaking: boolean = false;
  private currentSpeech: SpeechItem | null = null;
  private voiceEnabled: boolean = true;
  private beepSound: Audio.Sound | null = null;
  private ambientBeepInterval: ReturnType<typeof setInterval> | null = null;

  // Haptic Patterns
  private hapticPatterns = {
    buttonPress: { duration: 50 },
    swipe: { duration: 30 },
    success: [100, 50, 100],
    error: [50, 50, 50, 50, 50],
    warning: [200, 100, 200],
    navigationStep: [80, 40, 80, 40],
    arrival: [150, 50, 150, 50, 150, 50],
    obstacle: [200, 100, 200, 100, 200],
  };

  async initialize() {
    // Load beep sound for ambient feedback (optional)
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/beep.mp3')
      );
      this.beepSound = sound;
    } catch (error) {
      // Beep sound is optional, silently continue
      this.beepSound = null;
    }

    // Start ambient beep (every 5 seconds to confirm app is running)
    this.startAmbientBeep();
  }

  startAmbientBeep() {
    if (this.ambientBeepInterval) return;
    
    this.ambientBeepInterval = setInterval(() => {
      // Quiet beep to confirm app is active
      if (!this.isSpeaking) {
        this.playBeep(0.1); // Low volume
      }
    }, 5000);
  }

  stopAmbientBeep() {
    if (this.ambientBeepInterval) {
      clearInterval(this.ambientBeepInterval);
      this.ambientBeepInterval = null;
    }
  }

  async playBeep(volume: number = 0.5) {
    if (this.beepSound) {
      await this.beepSound.setVolumeAsync(volume);
      await this.beepSound.replayAsync();
    }
  }

  // Haptic Feedback
  async triggerHaptic(pattern: keyof typeof this.hapticPatterns) {
    try {
      const hapticPattern = this.hapticPatterns[pattern];
      
      if (Array.isArray(hapticPattern)) {
        // Custom vibration pattern
        for (let i = 0; i < hapticPattern.length; i++) {
          if (i % 2 === 0) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await this.delay(hapticPattern[i]);
          } else {
            await this.delay(hapticPattern[i]);
          }
        }
      } else {
        // Simple haptic
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.log('Haptic error:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Speech Queue System
  speak(text: string, priority: number = 3, interruptible: boolean = true) {
    if (!this.voiceEnabled && priority > 2) return; // Only critical/high when voice off

    const speechItem: SpeechItem = {
      text,
      priority,
      timestamp: Date.now(),
      interruptible,
    };

    // Add to history
    this.speechHistory.unshift(speechItem);
    if (this.speechHistory.length > 10) {
      this.speechHistory = this.speechHistory.slice(0, 10);
    }

    // Handle by priority
    if (priority === 1) {
      // Critical - interrupt everything
      this.clearQueue();
      Speech.stop();
      this.speakNow(speechItem);
    } else if (priority === 2) {
      // High - interrupt lower priority
      if (this.currentSpeech && this.currentSpeech.priority > 2 && this.currentSpeech.interruptible) {
        Speech.stop();
        this.speechQueue.unshift(speechItem);
        this.processQueue();
      } else {
        this.speechQueue.unshift(speechItem);
        if (!this.isSpeaking) {
          this.processQueue();
        }
      }
    } else {
      // Medium/Low - queue it
      this.speechQueue.push(speechItem);
      if (!this.isSpeaking) {
        this.processQueue();
      }
    }
  }

  private speakNow(item: SpeechItem) {
    this.isSpeaking = true;
    this.currentSpeech = item;

    Speech.speak(item.text, {
      rate: 0.9,
      onDone: () => {
        this.isSpeaking = false;
        this.currentSpeech = null;
        this.processQueue();
      },
      onError: () => {
        this.isSpeaking = false;
        this.currentSpeech = null;
        this.processQueue();
      },
    });
  }

  private processQueue() {
    if (this.isSpeaking || this.speechQueue.length === 0) return;

    // Sort by priority
    this.speechQueue.sort((a, b) => a.priority - b.priority);
    
    const nextItem = this.speechQueue.shift();
    if (nextItem) {
      this.speakNow(nextItem);
    }
  }

  clearQueue() {
    this.speechQueue = [];
  }

  stop() {
    Speech.stop();
    this.isSpeaking = false;
    this.currentSpeech = null;
    this.clearQueue();
  }

  // Replay last N messages
  getHistory(count: number = 5): SpeechItem[] {
    return this.speechHistory.slice(0, count);
  }

  replayLast() {
    if (this.speechHistory.length > 0) {
      const last = this.speechHistory[0];
      this.speak(last.text, 2);
    } else {
      this.speak('No previous message to replay.', 3);
    }
  }

  replayHistory(count: number = 5) {
    const history = this.getHistory(count);
    if (history.length === 0) {
      this.speak('No message history available.', 3);
      return;
    }

    const messages = history.map((item, idx) => 
      `Message ${idx + 1}: ${item.text}`
    ).join('. ');
    
    this.speak(messages, 2, false);
  }

  // Voice control
  setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
    if (!enabled) {
      this.clearQueue();
      Speech.stop();
    }
  }

  isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  // Spatial audio for direction (left/right)
  speakWithDirection(text: string, direction: 'left' | 'right' | 'center', priority: number = 3) {
    // Note: Expo doesn't support true spatial audio yet
    // We'll use text cues instead
    let spatialText = text;
    if (direction === 'left') {
      spatialText = `On your left: ${text}`;
    } else if (direction === 'right') {
      spatialText = `On your right: ${text}`;
    }
    
    this.speak(spatialText, priority);
  }

  // Distance feedback via beeps (faster beeps = closer)
  async playDistanceBeeps(distanceMeters: number) {
    // Beep frequency increases as distance decreases
    const interval = Math.max(100, distanceMeters * 50); // 50ms per meter, min 100ms
    const beepCount = Math.min(10, Math.ceil(50 / distanceMeters)); // More beeps when closer
    
    for (let i = 0; i < beepCount; i++) {
      await this.playBeep(0.3);
      await this.delay(interval);
    }
  }

  // Verbosity Management Integration
  async initializeVerbosity() {
    await verbosityManager.initialize();
  }

  async setVerbosityMode(mode: VerbosityMode) {
    await verbosityManager.setMode(mode);
    const templates = verbosityManager.getTemplates();
    this.speak(
      verbosityManager.format(templates.success(`Verbosity mode changed to ${mode}`)),
      2
    );
  }

  getVerbosityMode(): VerbosityMode {
    return verbosityManager.getMode();
  }

  /**
   * Announce with verbosity formatting
   */
  announceWithVerbosity(templateFn: () => { brief: string; detailed: string; learning: string }, priority: number = 3) {
    const template = templateFn();
    const formatted = verbosityManager.format(template);
    this.speak(formatted, priority);
  }

  /**
   * Check if mode change should be suggested
   */
  async checkVerbositySuggestion(): Promise<void> {
    const suggestion = verbosityManager.shouldSuggestModeChange();
    if (suggestion.suggest && suggestion.message && suggestion.suggestedMode) {
      // Announce suggestion after 2 seconds of silence
      setTimeout(() => {
        if (!this.isSpeaking) {
          this.speak(suggestion.message!, 2);
          // User can swipe right to accept, left to decline
        }
      }, 2000);
    }
  }

  cleanup() {
    this.stopAmbientBeep();
    this.stop();
    if (this.beepSound) {
      this.beepSound.unloadAsync();
    }
  }
}

// Singleton instance
export const accessibilityService = new AccessibilityService();

// Gesture Handler Types
export interface GestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onShake?: () => void;
  onThreeFingerTap?: () => void;
}

export default accessibilityService;

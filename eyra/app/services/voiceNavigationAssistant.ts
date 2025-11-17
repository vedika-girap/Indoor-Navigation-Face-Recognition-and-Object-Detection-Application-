/**
 * Voice Navigation Assistant
 * Simplifies navigation flow with voice-guided prompts
 */

import accessibilityService from './accessibilityService';
import { Alert } from 'react-native';

interface NavigationConfig {
  userId: string;
  onNavigationStart: (source: string, destination: string, mapId: string) => void;
  onDetectionStart: () => void;
  availableMaps: any[];
  availableRooms: Record<string, string[]>; // mapId -> room list
}

class VoiceNavigationAssistant {
  private config: NavigationConfig | null = null;
  private currentStep: 'idle' | 'map' | 'source' | 'destination' = 'idle';
  private selectedMap: any = null;
  private selectedSource: string = '';
  private currentMapRooms: string[] = [];

  initialize(config: NavigationConfig) {
    this.config = config;
  }

  /**
   * Start voice-guided navigation setup
   */
  startNavigationSetup() {
    if (!this.config) {
      accessibilityService.speak('Navigation not configured', 1);
      return;
    }

    accessibilityService.triggerHaptic('success');
    accessibilityService.speak(
      'Navigation setup. I will guide you through floor map and room selection using voice. Swipe right to hear options, double tap to select.',
      2,
      false
    );

    setTimeout(() => {
      this.promptForMap();
    }, 5000);
  }

  /**
   * Step 1: Map Selection
   */
  private promptForMap() {
    if (!this.config || this.config.availableMaps.length === 0) {
      accessibilityService.speak('No floor maps available. Please record a floor map first.', 2);
      return;
    }

    this.currentStep = 'map';
    const maps = this.config.availableMaps;

    if (maps.length === 1) {
      // Auto-select if only one map
      this.selectedMap = maps[0];
      accessibilityService.speak(`Only one map available: ${maps[0].map_id}. Auto-selected.`, 2);
      setTimeout(() => this.promptForSource(), 2000);
      return;
    }

    // Multiple maps - voice menu
    accessibilityService.speak(
      `${maps.length} floor maps available. Swipe right to hear each option. Double tap to select.`,
      2
    );

    this.createVoiceMenu(
      maps.map(m => ({ label: m.map_id, value: m })),
      (selected) => {
        this.selectedMap = selected.value;
        this.currentMapRooms = this.config!.availableRooms[selected.value.map_id] || [];
        accessibilityService.speak(`${selected.label} selected. Loading rooms.`, 2);
        setTimeout(() => this.promptForSource(), 2000);
      }
    );
  }

  /**
   * Step 2: Source Room Selection
   */
  private promptForSource() {
    if (this.currentMapRooms.length === 0) {
      accessibilityService.speak('No rooms found on this map. Cannot navigate.', 2);
      this.reset();
      return;
    }

    this.currentStep = 'source';
    accessibilityService.speak(
      `Select your starting location. ${this.currentMapRooms.length} rooms available. Swipe right to hear options.`,
      2
    );

    this.createVoiceMenu(
      this.currentMapRooms.map(room => ({
        label: room.replace(/_/g, ' '),
        value: room
      })),
      (selected) => {
        this.selectedSource = selected.value;
        accessibilityService.speak(`Starting from ${selected.label}. Now select destination.`, 2);
        setTimeout(() => this.promptForDestination(), 2000);
      }
    );
  }

  /**
   * Step 3: Destination Room Selection
   */
  private promptForDestination() {
    this.currentStep = 'destination';
    
    const destinations = this.currentMapRooms.filter(room => room !== this.selectedSource);
    
    if (destinations.length === 0) {
      accessibilityService.speak('No other rooms available on this map.', 2);
      this.reset();
      return;
    }

    accessibilityService.speak(
      `Select your destination. ${destinations.length} rooms available. Swipe right to hear options.`,
      2
    );

    this.createVoiceMenu(
      destinations.map(room => ({
        label: room.replace(/_/g, ' '),
        value: room
      })),
      (selected) => {
        accessibilityService.speak(
          `Destination: ${selected.label}. Planning route from ${this.selectedSource.replace(/_/g, ' ')} to ${selected.label}.`,
          2
        );
        accessibilityService.triggerHaptic('success');
        
        // Start navigation
        if (this.config) {
          this.config.onNavigationStart(
            this.selectedSource,
            selected.value,
            this.selectedMap.map_id
          );
        }
        this.reset();
      }
    );
  }

  /**
   * Create a voice-guided menu with gesture navigation
   * Returns a cleanup function
   */
  private createVoiceMenu(
    options: Array<{ label: string; value: any }>,
    onSelect: (selected: { label: string; value: any }) => void
  ): () => void {
    let currentIndex = 0;

    // Announce first option
    const announceOption = (index: number) => {
      accessibilityService.speak(
        `Option ${index + 1} of ${options.length}: ${options[index].label}`,
        2
      );
    };

    announceOption(0);

    // Setup gesture handlers
    const gestureConfig = {
      onSwipeRight: () => {
        currentIndex = (currentIndex + 1) % options.length;
        announceOption(currentIndex);
        accessibilityService.triggerHaptic('swipe');
      },
      onSwipeLeft: () => {
        currentIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
        announceOption(currentIndex);
        accessibilityService.triggerHaptic('swipe');
      },
      onDoubleTap: () => {
        accessibilityService.triggerHaptic('success');
        onSelect(options[currentIndex]);
      },
      onSwipeDown: () => {
        announceOption(currentIndex);
      },
      onLongPress: () => {
        accessibilityService.speak(
          `Voice menu. Current option ${currentIndex + 1} of ${options.length}: ${options[currentIndex].label}. Swipe right for next, left for previous, double tap to select.`,
          2
        );
      },
      onShake: () => {
        accessibilityService.speak('Menu cancelled', 2);
        this.reset();
      },
    };

    // Store gesture config (in real implementation, would attach to GestureHandler)
    // For now, this is a placeholder - you'd need to pass this to the actual UI
    return () => {
      // Cleanup function
    };
  }

  /**
   * Start detection-only mode (no navigation)
   */
  startDetectionOnly() {
    if (!this.config) return;
    
    accessibilityService.speak(
      'Detection mode activated. Point your camera at objects, people, or places. I will announce everything I detect.',
      2
    );
    
    accessibilityService.triggerHaptic('success');
    this.config.onDetectionStart();
  }

  /**
   * Reset assistant state
   */
  reset() {
    this.currentStep = 'idle';
    this.selectedMap = null;
    this.selectedSource = '';
    this.currentMapRooms = [];
  }

  /**
   * Get current step for UI display
   */
  getCurrentStep() {
    return this.currentStep;
  }
}

export const voiceNavigationAssistant = new VoiceNavigationAssistant();
export default voiceNavigationAssistant;

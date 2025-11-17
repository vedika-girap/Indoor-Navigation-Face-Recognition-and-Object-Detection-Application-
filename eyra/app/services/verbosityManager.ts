/**
 * Verbosity Manager - Progressive Disclosure System
 * Adapts announcement detail level based on user experience
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type VerbosityMode = 'brief' | 'detailed' | 'learning';

interface AnnouncementTemplate {
  brief: string;
  detailed: string;
  learning: string;
}

class VerbosityManager {
  private currentMode: VerbosityMode = 'detailed'; // Default to detailed
  private usageCount: number = 0;
  private readonly STORAGE_KEY = 'ziya_verbosity_mode';
  private readonly USAGE_COUNT_KEY = 'ziya_usage_count';

  async initialize() {
    try {
      // Load saved mode
      const savedMode = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (savedMode && ['brief', 'detailed', 'learning'].includes(savedMode)) {
        this.currentMode = savedMode as VerbosityMode;
      }

      // Load usage count for auto-graduation
      const savedCount = await AsyncStorage.getItem(this.USAGE_COUNT_KEY);
      if (savedCount) {
        this.usageCount = parseInt(savedCount, 10);
      }

      // Auto-graduate based on usage
      await this.autoGraduate();
    } catch (error) {
      console.error('Failed to load verbosity settings:', error);
    }
  }

  async setMode(mode: VerbosityMode) {
    this.currentMode = mode;
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to save verbosity mode:', error);
    }
  }

  getMode(): VerbosityMode {
    return this.currentMode;
  }

  async incrementUsage() {
    this.usageCount++;
    try {
      await AsyncStorage.setItem(this.USAGE_COUNT_KEY, this.usageCount.toString());
      await this.autoGraduate();
    } catch (error) {
      console.error('Failed to save usage count:', error);
    }
  }

  private async autoGraduate() {
    // Auto-graduate from Learning → Detailed → Brief
    if (this.currentMode === 'learning' && this.usageCount >= 10) {
      await this.setMode('detailed');
      return 'detailed';
    }
    if (this.currentMode === 'detailed' && this.usageCount >= 50) {
      await this.setMode('brief');
      return 'brief';
    }
    return null;
  }

  /**
   * Format announcement based on current verbosity mode
   */
  format(template: AnnouncementTemplate | string): string {
    if (typeof template === 'string') {
      // If simple string, apply mode-specific rules
      return this.applyModeRules(template);
    }

    // If template object, return appropriate version
    return template[this.currentMode];
  }

  private applyModeRules(text: string): string {
    switch (this.currentMode) {
      case 'brief':
        // Remove unnecessary words
        return text
          .replace(/Please /gi, '')
          .replace(/You are at /gi, '')
          .replace(/detected/gi, '')
          .replace(/\. You can/gi, ',')
          .trim();

      case 'learning':
        // Add helpful context
        if (text.includes('detected') && !text.includes('This is')) {
          const object = text.split(' ')[0];
          return `${text} This is an obstacle that you should avoid.`;
        }
        return text;

      case 'detailed':
      default:
        return text;
    }
  }

  /**
   * Pre-defined announcement templates
   */
  getTemplates() {
    return {
      obstacleDetected: (object: string, direction: string) => ({
        brief: `${object}, ${direction}`,
        detailed: `${object} detected ${direction}. Move to avoid.`,
        learning: `${object} detected ${direction}. This is an obstacle in your path. You should move slightly away from this direction to avoid collision.`
      }),

      navigationInstruction: (action: string, distance: string, location: string) => ({
        brief: `${action}. ${distance}.`,
        detailed: `${action} in ${distance} toward ${location}.`,
        learning: `Navigation instruction: ${action} in ${distance}. You are heading toward ${location}. Listen carefully for the next instruction.`
      }),

      waypoint: (room: string, instruction: string) => ({
        brief: `${room}. ${instruction}.`,
        detailed: `You are at ${room}. ${instruction}`,
        learning: `Waypoint reached. You have arrived at ${room}. Your next instruction is: ${instruction}. Take your time to orient yourself.`
      }),

      arrival: (destination: string, time: number) => ({
        brief: `Arrived. ${time} minutes.`,
        detailed: `You have arrived at ${destination}. Journey completed in ${time} minutes.`,
        learning: `Congratulations! You have successfully arrived at your destination: ${destination}. The journey took ${time} minutes. You can now stop or start a new navigation.`
      }),

      buttonPress: (buttonName: string) => ({
        brief: buttonName,
        detailed: `${buttonName} button pressed`,
        learning: `You pressed the ${buttonName} button. This button controls ${this.getButtonDescription(buttonName)}.`
      }),

      gestureDetected: (gesture: string) => ({
        brief: gesture,
        detailed: `${gesture} gesture detected`,
        learning: `${gesture} gesture detected. This gesture ${this.getGestureDescription(gesture)}.`
      }),

      error: (action: string) => ({
        brief: `Error. ${action}`,
        detailed: `An error occurred. ${action}`,
        learning: `Something went wrong. Don't worry, this is normal. ${action}. If you need help, long press anywhere on the screen.`
      }),

      success: (action: string) => ({
        brief: `Done`,
        detailed: `${action} completed`,
        learning: `Success! ${action} completed successfully. You can continue with the next step.`
      })
    };
  }

  private getButtonDescription(buttonName: string): string {
    const descriptions: Record<string, string> = {
      'voice': 'enabling or disabling voice announcements',
      'pause': 'pausing or resuming object detection announcements',
      'repeat': 'replaying the last announcement you heard',
      'battery': 'activating battery saver mode to extend usage time',
      'navigation': 'starting or stopping turn-by-turn navigation',
      'back': 'going back to the previous screen',
    };
    return descriptions[buttonName.toLowerCase()] || 'a specific function';
  }

  private getGestureDescription(gesture: string): string {
    const descriptions: Record<string, string> = {
      'swipe right': 'moves to the next option in the menu',
      'swipe left': 'moves to the previous option',
      'swipe up': 'quickly activates the current selection',
      'swipe down': 'replays the current context or screen information',
      'double tap': 'selects or activates the current item',
      'long press': 'provides detailed help about your current location',
      'shake': 'cancels the current action or exits to the previous screen',
      'three finger tap': 'replays the last 5 announcements you heard'
    };
    return descriptions[gesture.toLowerCase()] || 'performs a specific action';
  }

  /**
   * Get mode description for settings
   */
  getModeDescription(mode: VerbosityMode): string {
    const descriptions = {
      brief: 'Minimal announcements. Only essential information. Best for experienced users.',
      detailed: 'Standard announcements. Clear and informative. Recommended for most users.',
      learning: 'Comprehensive explanations. Describes everything in detail. Best for first-time users.'
    };
    return descriptions[mode];
  }

  /**
   * Get usage-based recommendation
   */
  getRecommendedMode(): VerbosityMode {
    if (this.usageCount < 10) return 'learning';
    if (this.usageCount < 50) return 'detailed';
    return 'brief';
  }

  /**
   * Check if mode change is recommended
   */
  shouldSuggestModeChange(): { suggest: boolean; suggestedMode?: VerbosityMode; message?: string } {
    const recommended = this.getRecommendedMode();
    if (recommended !== this.currentMode) {
      const messages = {
        brief: 'You have used the app 50 times. Would you like to switch to Brief mode for faster announcements?',
        detailed: 'You have used the app 10 times. Would you like to switch to Detailed mode for more concise announcements?',
        learning: 'Would you like to switch to Learning mode for more detailed explanations?'
      };
      return {
        suggest: true,
        suggestedMode: recommended,
        message: messages[recommended]
      };
    }
    return { suggest: false };
  }
}

export const verbosityManager = new VerbosityManager();
export default verbosityManager;

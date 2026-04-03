/**
 * Action History Manager - Undo System & Error Recovery
 * Tracks all user actions and provides rollback capabilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { accessibilityService } from './accessibilityService';

export type ActionType = 
  | 'navigation_start'
  | 'navigation_stop'
  | 'mode_change'
  | 'room_selection'
  | 'map_selection'
  | 'settings_change'
  | 'detection_toggle'
  | 'voice_toggle';

export interface Action {
  id: string;
  type: ActionType;
  timestamp: number;
  description: string;
  reversible: boolean;
  undoDescription?: string;
  data?: any; // Store state needed for undo
  undo?: () => Promise<void>;
}

export interface BreadcrumbItem {
  screen: string;
  timestamp: number;
  description: string;
}

class ActionHistoryManager {
  private actionStack: Action[] = [];
  private breadcrumbs: BreadcrumbItem[] = [];
  private maxHistorySize: number = 20;
  private maxBreadcrumbs: number = 10;
  private undoEnabled: boolean = true;
  private lastUndoTime: number = 0;
  private readonly STORAGE_KEY = 'ziya_action_history';

  /**
   * Record a new action
   */
  async recordAction(action: Omit<Action, 'id' | 'timestamp'>): Promise<string> {
    const newAction: Action = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.actionStack.push(newAction);

    // Trim history if too large
    if (this.actionStack.length > this.maxHistorySize) {
      this.actionStack = this.actionStack.slice(-this.maxHistorySize);
    }

    // Save to storage (async, don't await)
    this.saveHistory();

    return newAction.id;
  }

  /**
   * Add breadcrumb (navigation trail)
   */
  addBreadcrumb(screen: string, description: string) {
    const breadcrumb: BreadcrumbItem = {
      screen,
      timestamp: Date.now(),
      description,
    };

    this.breadcrumbs.push(breadcrumb);

    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  /**
   * Undo last reversible action
   */
  async undoLastAction(): Promise<boolean> {
    // Prevent rapid undo spam
    const now = Date.now();
    if (now - this.lastUndoTime < 1000) {
      accessibilityService.speak('Please wait before undoing again', 2);
      return false;
    }
    this.lastUndoTime = now;

    if (!this.undoEnabled) {
      accessibilityService.speak('Undo is currently disabled', 2);
      return false;
    }

    // Find last reversible action
    const reversibleActions = this.actionStack.filter(a => a.reversible);
    if (reversibleActions.length === 0) {
      accessibilityService.speak('No actions to undo', 2);
      await accessibilityService.triggerHaptic('error');
      return false;
    }

    const lastAction = reversibleActions[reversibleActions.length - 1];

    try {
      // Execute undo function if provided
      if (lastAction.undo) {
        await lastAction.undo();
      }

      // Remove from stack
      this.actionStack = this.actionStack.filter(a => a.id !== lastAction.id);

      // Announce
      const undoMsg = lastAction.undoDescription || `Undone: ${lastAction.description}`;
      accessibilityService.speak(undoMsg, 1);
      await accessibilityService.triggerHaptic('success');

      // Save updated history
      this.saveHistory();

      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      accessibilityService.speak('Undo failed. Action could not be reversed.', 1);
      await accessibilityService.triggerHaptic('error');
      return false;
    }
  }

  /**
   * Get last N actions
   */
  getRecentActions(count: number = 5): Action[] {
    return this.actionStack.slice(-count).reverse();
  }

  /**
   * Get action by ID
   */
  getAction(id: string): Action | undefined {
    return this.actionStack.find(a => a.id === id);
  }

  /**
   * Clear all history
   */
  async clearHistory() {
    this.actionStack = [];
    this.breadcrumbs = [];
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    accessibilityService.speak('History cleared', 2);
  }

  /**
   * Get breadcrumb trail
   */
  getBreadcrumbs(): BreadcrumbItem[] {
    return this.breadcrumbs.slice().reverse();
  }

  /**
   * Announce breadcrumb trail
   */
  announceBreadcrumbs() {
    if (this.breadcrumbs.length === 0) {
      accessibilityService.speak('No navigation history', 2);
      return;
    }

    const trail = this.breadcrumbs
      .slice(-5)
      .reverse()
      .map((b, i) => {
        if (i === 0) return `You are at: ${b.description}`;
        return b.description;
      })
      .join('. Then: ');

    accessibilityService.speak(trail, 2);
  }

  /**
   * Go back in breadcrumb trail
   */
  async goBackInTrail(steps: number = 1): Promise<BreadcrumbItem | null> {
    if (this.breadcrumbs.length < steps + 1) {
      accessibilityService.speak('Cannot go back further', 2);
      return null;
    }

    // Remove current and intermediate breadcrumbs
    const removed = this.breadcrumbs.splice(-steps);
    const target = this.breadcrumbs[this.breadcrumbs.length - 1];

    accessibilityService.speak(`Going back to ${target.description}`, 2);
    return target;
  }

  /**
   * Enable/disable undo
   */
  setUndoEnabled(enabled: boolean) {
    this.undoEnabled = enabled;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoEnabled && this.actionStack.some(a => a.reversible);
  }

  /**
   * Get undo description
   */
  getUndoDescription(): string | null {
    const reversibleActions = this.actionStack.filter(a => a.reversible);
    if (reversibleActions.length === 0) return null;

    const lastAction = reversibleActions[reversibleActions.length - 1];
    return lastAction.undoDescription || `Undo: ${lastAction.description}`;
  }

  /**
   * Save history to storage
   */
  private async saveHistory() {
    try {
      // Only save essential data (not undo functions)
      const saveData = {
        actions: this.actionStack.map(a => ({
          id: a.id,
          type: a.type,
          timestamp: a.timestamp,
          description: a.description,
          reversible: a.reversible,
          undoDescription: a.undoDescription,
          data: a.data,
        })),
        breadcrumbs: this.breadcrumbs,
      };

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(saveData));
    } catch (error) {
      console.error('Failed to save action history:', error);
    }
  }

  /**
   * Load history from storage
   */
  async loadHistory() {
    try {
      const saved = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        
        // Restore actions (without undo functions - those are context-specific)
        this.actionStack = data.actions || [];
        this.breadcrumbs = data.breadcrumbs || [];
      }
    } catch (error) {
      console.error('Failed to load action history:', error);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const reversibleCount = this.actionStack.filter(a => a.reversible).length;
    const recentActions = this.actionStack.filter(a => 
      Date.now() - a.timestamp < 3600000 // Last hour
    ).length;

    return {
      totalActions: this.actionStack.length,
      reversibleActions: reversibleCount,
      breadcrumbCount: this.breadcrumbs.length,
      recentActions,
      oldestAction: this.actionStack[0]?.timestamp || null,
      newestAction: this.actionStack[this.actionStack.length - 1]?.timestamp || null,
    };
  }

  /**
   * Error recovery: retry last action
   */
  async retryLastAction(): Promise<boolean> {
    if (this.actionStack.length === 0) {
      accessibilityService.speak('No actions to retry', 2);
      return false;
    }

    const lastAction = this.actionStack[this.actionStack.length - 1];
    
    accessibilityService.speak(`Retrying: ${lastAction.description}`, 2);
    
    // Note: Actual retry logic depends on action type
    // This is a placeholder - implement specific retry in context
    return true;
  }

  /**
   * Check for stuck state (same action repeated)
   */
  detectStuckState(): boolean {
    if (this.actionStack.length < 3) return false;

    const recent = this.actionStack.slice(-3);
    const allSameType = recent.every(a => a.type === recent[0].type);
    const allRecent = recent.every(a => Date.now() - a.timestamp < 10000); // Within 10 seconds

    return allSameType && allRecent;
  }

  /**
   * Announce if user seems stuck
   */
  announceIfStuck() {
    if (this.detectStuckState()) {
      accessibilityService.speak(
        'You seem to be repeating the same action. Would you like help? Long press anywhere for assistance.',
        2
      );
    }
  }
}

export const actionHistoryManager = new ActionHistoryManager();
export default actionHistoryManager;

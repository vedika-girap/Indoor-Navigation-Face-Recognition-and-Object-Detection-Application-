/**
 * Error Recovery Service - Smart Error Handling & Recovery
 * Provides graceful degradation and recovery mechanisms
 */

import { accessibilityService } from './accessibilityService';
import actionHistoryManager from './actionHistoryManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ErrorContext {
  operation: string;
  error: any;
  timestamp: number;
  recoverable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  action: () => Promise<boolean>;
  requiresUserInput: boolean;
}

class ErrorRecoveryService {
  private errorLog: ErrorContext[] = [];
  private maxLogSize: number = 50;
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries: number = 3;
  private readonly STORAGE_KEY = 'ziya_error_log';

  /**
   * Handle error with automatic recovery attempts
   */
  async handleError(
    operation: string,
    error: any,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    autoRecover: boolean = true
  ): Promise<boolean> {
    const errorContext: ErrorContext = {
      operation,
      error: this.serializeError(error),
      timestamp: Date.now(),
      recoverable: this.isRecoverable(error),
      severity,
    };

    // Log error
    this.logError(errorContext);

    // Announce error based on severity
    await this.announceError(errorContext);

    // Attempt recovery if enabled
    if (autoRecover && errorContext.recoverable) {
      return await this.attemptRecovery(errorContext);
    }

    return false;
  }

  /**
   * Announce error to user based on severity
   */
  private async announceError(context: ErrorContext) {
    let message = '';
    let priority = 2;

    switch (context.severity) {
      case 'critical':
        message = `Critical error: ${context.operation} failed. The app may not work correctly.`;
        priority = 1;
        await accessibilityService.triggerHaptic('error');
        break;

      case 'high':
        message = `Error: ${context.operation} failed. Please try again.`;
        priority = 1;
        await accessibilityService.triggerHaptic('warning');
        break;

      case 'medium':
        message = `${context.operation} failed. Retrying automatically.`;
        priority = 2;
        break;

      case 'low':
        // Only log, don't announce
        return;
    }

    accessibilityService.speak(message, priority);
  }

  /**
   * Attempt automatic recovery
   */
  private async attemptRecovery(context: ErrorContext): Promise<boolean> {
    const strategies = this.getRecoveryStrategies(context);

    for (const strategy of strategies) {
      try {
        accessibilityService.speak(`Attempting recovery: ${strategy.description}`, 3);
        const success = await strategy.action();

        if (success) {
          accessibilityService.speak('Recovery successful. Continuing.', 2);
          await accessibilityService.triggerHaptic('success');
          return true;
        }
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
      }
    }

    // All strategies failed
    accessibilityService.speak(
      'Automatic recovery failed. Long press for help.',
      2
    );
    await accessibilityService.triggerHaptic('error');
    return false;
  }

  /**
   * Get recovery strategies based on error context
   */
  private getRecoveryStrategies(context: ErrorContext): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];

    // Network error strategies
    if (this.isNetworkError(context.error)) {
      strategies.push({
        name: 'retry',
        description: 'Retrying operation',
        action: async () => {
          const attempts = this.retryAttempts.get(context.operation) || 0;
          if (attempts >= this.maxRetries) {
            return false;
          }
          this.retryAttempts.set(context.operation, attempts + 1);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
          return false; // Caller should retry the actual operation
        },
        requiresUserInput: false,
      });

      strategies.push({
        name: 'offline_mode',
        description: 'Switching to offline mode',
        action: async () => {
          // Enable offline mode
          await AsyncStorage.setItem('offline_mode', 'true');
          return true;
        },
        requiresUserInput: false,
      });
    }

    // Camera permission error
    if (context.operation.includes('camera')) {
      strategies.push({
        name: 'request_permission',
        description: 'Requesting camera permission again',
        action: async () => {
          // Permission request should be handled by caller
          return false;
        },
        requiresUserInput: true,
      });
    }

    // Storage error
    if (context.operation.includes('storage')) {
      strategies.push({
        name: 'clear_cache',
        description: 'Clearing app cache',
        action: async () => {
          try {
            // Clear some cache (not critical data)
            await AsyncStorage.removeItem('temp_cache');
            return true;
          } catch {
            return false;
          }
        },
        requiresUserInput: false,
      });
    }

    // Generic retry strategy
    strategies.push({
      name: 'generic_retry',
      description: 'Waiting and retrying',
      action: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false; // Let caller retry
      },
      requiresUserInput: false,
    });

    return strategies;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(error: any): boolean {
    // Network errors are usually recoverable
    if (this.isNetworkError(error)) return true;

    // Permission errors require user action
    if (error?.message?.includes('permission')) return false;

    // Storage errors might be recoverable
    if (error?.message?.includes('storage')) return true;

    // Unknown errors - assume recoverable
    return true;
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    if (!error) return false;

    const networkKeywords = ['network', 'fetch', 'timeout', 'connection', 'offline'];
    const errorString = JSON.stringify(error).toLowerCase();

    return networkKeywords.some(keyword => errorString.includes(keyword));
  }

  /**
   * Serialize error for storage
   */
  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return error;
  }

  /**
   * Log error
   */
  private logError(context: ErrorContext) {
    this.errorLog.push(context);

    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Save to storage (async, don't await)
    this.saveErrorLog();
  }

  /**
   * Save error log to storage
   */
  private async saveErrorLog() {
    try {
      const logData = this.errorLog.map(e => ({
        operation: e.operation,
        error: e.error,
        timestamp: e.timestamp,
        severity: e.severity,
      }));

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(logData));
    } catch (error) {
      console.error('Failed to save error log:', error);
    }
  }

  /**
   * Load error log from storage
   */
  async loadErrorLog() {
    try {
      const saved = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.errorLog = data.map((e: any) => ({
          ...e,
          recoverable: false, // Don't know if recoverable from saved data
        }));
      }
    } catch (error) {
      console.error('Failed to load error log:', error);
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count: number = 10): ErrorContext[] {
    return this.errorLog.slice(-count).reverse();
  }

  /**
   * Clear error log
   */
  async clearErrorLog() {
    this.errorLog = [];
    this.retryAttempts.clear();
    await AsyncStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const last24Hours = this.errorLog.filter(
      e => Date.now() - e.timestamp < 86400000
    );

    const bySeverity = {
      critical: last24Hours.filter(e => e.severity === 'critical').length,
      high: last24Hours.filter(e => e.severity === 'high').length,
      medium: last24Hours.filter(e => e.severity === 'medium').length,
      low: last24Hours.filter(e => e.severity === 'low').length,
    };

    return {
      totalErrors: this.errorLog.length,
      last24Hours: last24Hours.length,
      bySeverity,
      mostRecentError: this.errorLog[this.errorLog.length - 1] || null,
    };
  }

  /**
   * Suggest action based on error patterns
   */
  async suggestAction() {
    const stats = this.getErrorStats();

    // Too many errors recently
    if (stats.last24Hours > 10) {
      accessibilityService.speak(
        'Multiple errors detected. Consider restarting the app or checking your internet connection. Long press for help.',
        2
      );
    }

    // Critical errors
    if (stats.bySeverity.critical > 0) {
      accessibilityService.speak(
        'Critical errors detected. Some features may not work. Long press for help.',
        1
      );
    }
  }

  /**
   * Create error report for debugging
   */
  generateErrorReport(): string {
    const stats = this.getErrorStats();
    const recent = this.getRecentErrors(5);

    let report = '=== Ziya Error Report ===\n\n';
    report += `Total Errors: ${stats.totalErrors}\n`;
    report += `Last 24 Hours: ${stats.last24Hours}\n`;
    report += `Critical: ${stats.bySeverity.critical}\n`;
    report += `High: ${stats.bySeverity.high}\n`;
    report += `Medium: ${stats.bySeverity.medium}\n`;
    report += `Low: ${stats.bySeverity.low}\n\n`;

    report += '=== Recent Errors ===\n';
    recent.forEach((e, i) => {
      report += `\n${i + 1}. ${e.operation}\n`;
      report += `   Severity: ${e.severity}\n`;
      report += `   Time: ${new Date(e.timestamp).toLocaleString()}\n`;
      report += `   Error: ${JSON.stringify(e.error, null, 2)}\n`;
    });

    return report;
  }
}

export const errorRecoveryService = new ErrorRecoveryService();
export default errorRecoveryService;

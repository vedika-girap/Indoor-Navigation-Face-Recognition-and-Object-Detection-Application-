/**
 * Voice Navigation Debug Script
 * 
 * This script helps diagnose why voice navigation is not working.
 * Run this to get a comprehensive report of the voice navigation system status.
 */

import { voiceNavigationService } from '../services/voiceNavigation';
import { speechRecognitionService } from '../services/speechRecognition';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export interface DebugResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

export class VoiceNavigationDebugger {
  private results: DebugResult[] = [];

  private addResult(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: any) {
    this.results.push({ category, test, status, message, details });
    console.log(`[${status}] ${category} - ${test}: ${message}`);
    if (details) {
      console.log('Details:', details);
    }
  }

  /**
   * Test basic service availability
   */
  async testServiceAvailability(): Promise<void> {
    console.log('\n🔍 Testing Service Availability...');

    // Test voice navigation service
    try {
      const isListening = voiceNavigationService.getListeningStatus();
      this.addResult(
        'Services', 
        'VoiceNavigationService', 
        'PASS', 
        `Service available. Currently listening: ${isListening}`
      );
    } catch (error) {
      this.addResult(
        'Services', 
        'VoiceNavigationService', 
        'FAIL', 
        'Voice navigation service not available',
        error
      );
    }

    // Test speech recognition service
    try {
      const isAvailable = speechRecognitionService.isAvailable();
      const isListening = speechRecognitionService.getListeningStatus();
      this.addResult(
        'Services', 
        'SpeechRecognitionService', 
        isAvailable ? 'PASS' : 'WARNING', 
        `Available: ${isAvailable}, Listening: ${isListening}`,
        { platform: Platform.OS }
      );
    } catch (error) {
      this.addResult(
        'Services', 
        'SpeechRecognitionService', 
        'FAIL', 
        'Speech recognition service not available',
        error
      );
    }

    // Test expo-speech
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      this.addResult(
        'Services', 
        'Expo Speech', 
        'PASS', 
        `Text-to-speech available. ${voices.length} voices found`
      );
    } catch (error) {
      this.addResult(
        'Services', 
        'Expo Speech', 
        'FAIL', 
        'Text-to-speech not available',
        error
      );
    }
  }

  /**
   * Test platform capabilities
   */
  testPlatformCapabilities(): void {
    console.log('\n🔍 Testing Platform Capabilities...');

    // Check platform
    this.addResult(
      'Platform', 
      'Current Platform', 
      'PASS', 
      `Running on ${Platform.OS}`,
      { 
        platform: Platform.OS, 
        version: Platform.Version 
      }
    );

    // Check web speech API (for web)
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const hasWebSpeech = !!(window as any).webkitSpeechRecognition || !!(window as any).SpeechRecognition;
        this.addResult(
          'Platform', 
          'Web Speech API', 
          hasWebSpeech ? 'PASS' : 'FAIL', 
          hasWebSpeech ? 'Web Speech API is available' : 'Web Speech API not supported'
        );

        // Check HTTPS requirement
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
        this.addResult(
          'Platform', 
          'HTTPS/Localhost', 
          isSecure ? 'PASS' : 'WARNING', 
          isSecure ? 'Secure context available' : 'HTTPS required for speech recognition in production'
        );
      }
    }
  }

  /**
   * Test voice command processing
   */
  testVoiceCommands(): void {
    console.log('\n🔍 Testing Voice Commands...');

    // Test command registration
    try {
      const testCommands = [
        {
          commands: ['test command'],
          action: () => console.log('Test command executed'),
          description: 'Test command for debugging'
        }
      ];

      voiceNavigationService.addCommands(testCommands);
      this.addResult(
        'Commands', 
        'Command Registration', 
        'PASS', 
        'Commands can be registered successfully'
      );

      // Test command processing
  const testResult = voiceNavigationService.processVoiceInput('ziya test command');
      this.addResult(
        'Commands', 
        'Command Processing', 
        testResult ? 'PASS' : 'WARNING', 
        testResult ? 'Commands process successfully' : 'Command processing returned false'
      );

      voiceNavigationService.clearCommands();
    } catch (error) {
      this.addResult(
        'Commands', 
        'Voice Commands', 
        'FAIL', 
        'Error in voice command system',
        error
      );
    }
  }

  /**
   * Test speech recognition
   */
  async testSpeechRecognition(): Promise<void> {
    console.log('\n🔍 Testing Speech Recognition...');

    return new Promise((resolve) => {
      let callbacksReceived = {
        onStart: false,
        onResult: false,
        onEnd: false
      };

      const timeout = setTimeout(() => {
        this.addResult(
          'Speech Recognition', 
          'Callback System', 
          'WARNING', 
          'Speech recognition test timed out',
          callbacksReceived
        );
        resolve();
      }, 3000);

      // Setup test callbacks
      speechRecognitionService.setCallbacks({
        onStart: () => {
          callbacksReceived.onStart = true;
          this.addResult(
            'Speech Recognition', 
            'Start Callback', 
            'PASS', 
            'onStart callback received'
          );
        },
        onResult: (result) => {
          callbacksReceived.onResult = true;
          this.addResult(
            'Speech Recognition', 
            'Result Callback', 
            'PASS', 
            'onResult callback received',
            result
          );
        },
        onEnd: () => {
          callbacksReceived.onEnd = true;
          this.addResult(
            'Speech Recognition', 
            'End Callback', 
            'PASS', 
            'onEnd callback received'
          );
          clearTimeout(timeout);
          resolve();
        },
        onError: (error) => {
          this.addResult(
            'Speech Recognition', 
            'Error Callback', 
            'WARNING', 
            'onError callback received',
            error
          );
        }
      });

      // Test simulation
      try {
  speechRecognitionService.simulateVoiceInput('ziya test');
      } catch (error) {
        this.addResult(
          'Speech Recognition', 
          'Simulation', 
          'FAIL', 
          'Failed to simulate voice input',
          error
        );
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  /**
   * Test UI integration
   */
  testUIIntegration(): void {
    console.log('\n🔍 Testing UI Integration...');

    // Test UI callbacks
    try {
      let callbackCalled = false;
      voiceNavigationService.setUICallbacks({
        onWakeWordDetected: () => {
          callbackCalled = true;
        }
      });

      this.addResult(
        'UI Integration', 
        'UI Callbacks', 
        'PASS', 
        'UI callbacks can be set'
      );
    } catch (error) {
      this.addResult(
        'UI Integration', 
        'UI Callbacks', 
        'FAIL', 
        'Failed to set UI callbacks',
        error
      );
    }
  }

  /**
   * Run comprehensive debug
   */
  async runFullDebug(): Promise<DebugResult[]> {
    console.log('🚀 Starting Voice Navigation Debug...\n');
    
    this.results = [];
    
    await this.testServiceAvailability();
    this.testPlatformCapabilities();
    this.testVoiceCommands();
    await this.testSpeechRecognition();
    this.testUIIntegration();

    console.log('\n📊 Debug Summary:');
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      warnings: this.results.filter(r => r.status === 'WARNING').length,
      failed: this.results.filter(r => r.status === 'FAIL').length
    };

    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`⚠️  Warnings: ${summary.warnings}`);
    console.log(`❌ Failed: ${summary.failed}`);

    if (summary.failed > 0) {
      console.log('\n❌ Critical Issues Found:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`- ${r.category}: ${r.test} - ${r.message}`));
    }

    if (summary.warnings > 0) {
      console.log('\n⚠️  Warnings:');
      this.results
        .filter(r => r.status === 'WARNING')
        .forEach(r => console.log(`- ${r.category}: ${r.test} - ${r.message}`));
    }

    return this.results;
  }

  /**
   * Get specific recommendations based on debug results
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const failures = this.results.filter(r => r.status === 'FAIL');
    const warnings = this.results.filter(r => r.status === 'WARNING');

    if (failures.some(f => f.test === 'Web Speech API')) {
      recommendations.push('Web Speech API not available. Consider using a polyfill or cloud speech service.');
    }

    if (warnings.some(w => w.test === 'HTTPS/Localhost')) {
      recommendations.push('Speech recognition requires HTTPS in production. Use localhost for development.');
    }

    if (failures.some(f => f.category === 'Services')) {
      recommendations.push('Core services not available. Check imports and service initialization.');
    }

    if (warnings.some(w => w.test === 'Command Processing')) {
      recommendations.push('Voice commands not processing correctly. Check wake word detection and command matching.');
    }

    if (failures.length === 0 && warnings.length === 0) {
      recommendations.push('All tests passed! Voice navigation should be working correctly.');
    }

    return recommendations;
  }
}

// Export debug function for easy use
export async function debugVoiceNavigation(): Promise<{
  results: DebugResult[];
  recommendations: string[];
}> {
  const debugInstance = new VoiceNavigationDebugger();
  const results = await debugInstance.runFullDebug();
  const recommendations = debugInstance.getRecommendations();
  
  return { results, recommendations };
}

// Export singleton for use in development
export const voiceNavigationDebugger = new VoiceNavigationDebugger();
/**
 * Voice Navigation System Test
 * This file demonstrates how to test the voice navigation functionality
 */

import { voiceNavigationService, createNavigationCommands } from '../services/voiceNavigation';
import { speechRecognitionService } from '../services/speechRecognition';

// Mock navigation object for testing
const mockNavigation = {
  navigate: (screen: string) => {
    console.log(`Navigation: Going to ${screen}`);
  },
  goBack: () => {
    console.log('Navigation: Going back');
  }
};

/**
 * Test voice navigation setup
 */
export function testVoiceNavigationSetup() {
  console.log('🎤 Testing Voice Navigation Setup...');
  
  // Create navigation commands
  const commands = createNavigationCommands(mockNavigation);
  
  // Add home screen commands
  voiceNavigationService.addCommands([
    ...commands.home,
    ...commands.general
  ]);
  
  console.log('✅ Voice navigation commands configured');
  
  // Test speech recognition availability
  const isAvailable = speechRecognitionService.isAvailable();
  console.log(`📱 Speech recognition available: ${isAvailable}`);
  
  return isAvailable;
}

/**
 * Test voice command processing
 */
export function testVoiceCommands() {
  console.log('🎤 Testing Voice Commands...');
  
  const testCommands = [
    'ziya go home',
    'ziya indoor navigation',
    'ziya menu',
    'ziya normal mode',
    'ziya help',
    'ziya go back',
    'ziya stop listening'
  ];
  
  testCommands.forEach((command, index) => {
    setTimeout(() => {
      console.log(`Testing command: "${command}"`);
      const result = voiceNavigationService.processVoiceInput(command);
      console.log(`Command processed: ${result}`);
    }, index * 1000);
  });
}

/**
 * Test speech recognition simulation
 */
export function testSpeechSimulation() {
  console.log('🎤 Testing Speech Recognition Simulation...');
  
  // Setup callbacks for testing
  speechRecognitionService.setCallbacks({
    onResult: (result) => {
      console.log('Speech result:', result);
    },
    onError: (error) => {
      console.error('Speech error:', error);
    },
    onStart: () => {
      console.log('Speech recognition started');
    },
    onEnd: () => {
      console.log('Speech recognition ended');
    }
  });
  
  // Simulate voice input
  setTimeout(() => {
  speechRecognitionService.simulateVoiceInput('ziya go home');
  }, 1000);
  
  setTimeout(() => {
  speechRecognitionService.simulateVoiceInput('ziya indoor navigation');
  }, 3000);
}

/**
 * Run all voice navigation tests
 */
export function runAllVoiceTests() {
  console.log('🚀 Starting Voice Navigation Tests...');
  
  // Test setup
  const setupSuccess = testVoiceNavigationSetup();
  
  if (setupSuccess) {
    // Test commands
    setTimeout(() => {
      testVoiceCommands();
    }, 2000);
    
    // Test simulation
    setTimeout(() => {
      testSpeechSimulation();
    }, 5000);
  } else {
    console.log('⚠️  Voice navigation setup failed - running in fallback mode');
  }
  
  console.log('✅ Voice navigation tests completed');
}

// Export for use in development
export const VoiceNavigationTests = {
  setup: testVoiceNavigationSetup,
  commands: testVoiceCommands,
  simulation: testSpeechSimulation,
  runAll: runAllVoiceTests
};
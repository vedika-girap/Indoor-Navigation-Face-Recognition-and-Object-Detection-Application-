/**
 * Wake Word Animation Demo
 * 
 * This demo shows how the voice navigation system now responds to the wake word "Ziya"
 * with visual animations and feedback.
 */

import { voiceNavigationService } from '../services/voiceNavigation';
import { speechRecognitionService } from '../services/speechRecognition';

/**
 * Demo: Wake Word Detection Flow
 * 
 * 1. User says "Ziya" → Wake word animation triggers (gold button + ear emoji)
 * 2. User continues with command → Command ready state (green button + speech emoji)
 * 3. Command executes → Normal listening state returns
 */
export function demoWakeWordFlow() {
  console.log('🎤 Starting Wake Word Animation Demo...');
  
  // Setup voice navigation (this would normally be done in your screen)
  const mockNavigation = {
    navigate: (screen: string) => console.log(`📱 Navigating to: ${screen}`),
    goBack: () => console.log('📱 Going back')
  };

  // Demo sequence
  const demoCommands = [
    'ziya',                    // Just wake word
    'ziya go home',            // Wake word + immediate command
    'ziya indoor navigation',  // Wake word + navigation command
    'ziya help'                // Wake word + help command
  ];

  console.log('🎯 Demo Commands:', demoCommands);

  // Simulate each command with delays
  demoCommands.forEach((command, index) => {
    setTimeout(() => {
      console.log(`\n--- Testing: "${command}" ---`);
      speechRecognitionService.simulateVoiceInput(command);
    }, index * 4000); // 4 second intervals
  });
}

/**
 * Visual Animation States:
 * 
 * 1. LISTENING (Blue): 🎤 Regular pulse animation
 *    - Button: Blue (#4A90E2)
 *    - Text: "Listening..."
 * 
 * 2. WAKE WORD DETECTED (Gold): 👂 Rapid scale animation
 *    - Button: Gold (#FFD700)
 *    - Icon: Ear emoji
 *    - Text: "Ziya Activated!"
 *    - Audio: "Yes?" (quick acknowledgment)
 * 
 * 3. COMMAND READY (Green): 💬 Ready state
 *    - Button: Spring green (#00FF7F)
 *    - Icon: Speech bubble emoji
 *    - Text: "Ready for command..."
 * 
 * Animation Timing:
 * - Wake word animation: 700ms total (rapid pulse)
 * - State timeout: 3 seconds
 * - Audio feedback: Immediate
 */

export const WakeWordAnimationStates = {
  LISTENING: {
    color: '#4A90E2',
    icon: '🎤',
    text: 'Listening...',
    animation: 'pulse'
  },
  WAKE_WORD: {
    color: '#FFD700',
    icon: '👂',
  text: 'Ziya Activated!',
    animation: 'rapid-pulse',
    audio: 'Yes?'
  },
  COMMAND_READY: {
    color: '#00FF7F',
    icon: '💬',
    text: 'Ready for command...',
    animation: 'steady'
  }
};

/**
 * Integration with Screens:
 * 
 * The GlobalVoiceListener component automatically handles these animations
 * when voice navigation is active. No additional setup required in screens.
 * 
 * The animation system works as follows:
 * 1. SpeechRecognitionService detects "Ziya" in transcript
 * 2. Triggers onWakeWordDetected callback
 * 3. VoiceNavigationService calls UI callback
 * 4. GlobalVoiceListener updates visual state
 * 5. Animation plays with color/icon changes
 * 6. Audio feedback plays
 * 7. Auto-reset after 3 seconds
 */

export function testWakeWordIntegration() {
  console.log('🔧 Testing Wake Word Integration...');
  
  // Test wake word detection
  const testCases = [
    { input: 'hello world', expectWakeWord: false },
    { input: 'ziya', expectWakeWord: true },
    { input: 'hey ziya go home', expectWakeWord: true },
    { input: 'ZIYA HELP ME', expectWakeWord: true },
    { input: 'ziya ziya ziya', expectWakeWord: true }
  ];

  testCases.forEach((testCase, index) => {
    setTimeout(() => {
      console.log(`\nTest ${index + 1}: "${testCase.input}"`);
      console.log(`Expected wake word: ${testCase.expectWakeWord}`);
      
      // This would trigger the wake word detection in real usage
      speechRecognitionService.simulateVoiceInput(testCase.input);
    }, index * 2000);
  });
}

// Export demo functions
export const WakeWordDemo = {
  flow: demoWakeWordFlow,
  integration: testWakeWordIntegration,
  states: WakeWordAnimationStates
};
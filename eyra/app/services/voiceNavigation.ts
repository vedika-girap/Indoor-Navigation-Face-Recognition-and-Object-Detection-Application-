import * as Speech from 'expo-speech';
import { Alert } from 'react-native';
import { speechRecognitionService, SpeechRecognitionResult } from './speechRecognition';

export interface VoiceCommand {
  commands: string[];
  action: () => void;
  description: string;
}

export interface VoiceNavigationOptions {
  enabled?: boolean;
  wakeWord?: string;
  timeout?: number;
  confirmVoiceActions?: boolean;
}

export class VoiceNavigationService {
  private commands: VoiceCommand[] = [];
  private isListening: boolean = false;
  private options: VoiceNavigationOptions;
  private lastTranscript: string = '';
  private uiCallbacks: {
    onWakeWordDetected?: () => void;
    onCommandReady?: () => void;
    onListeningStateChanged?: (isListening: boolean) => void;
  } = {};

  constructor(options: VoiceNavigationOptions = {}) {
    this.options = {
      enabled: true,
      wakeWord: 'ziya',
      timeout: 5000,
      confirmVoiceActions: true,
      ...options
    };

    // Setup speech recognition callbacks
    speechRecognitionService.setCallbacks({
      onResult: (result: SpeechRecognitionResult) => this.handleSpeechResult(result),
      onError: (error: string) => this.handleSpeechError(error),
      onStart: () => this.handleSpeechStart(),
      onEnd: () => this.handleSpeechEnd(),
      onWakeWordDetected: () => this.handleWakeWordDetected(),
      onCommandReady: () => this.handleCommandReady()
    });

    // Ensure speech recognition service uses the same wake word
    speechRecognitionService.setWakeWord(this.options.wakeWord!.toLowerCase());
  }

  /**
   * Handle speech recognition results
   */
  private handleSpeechResult(result: SpeechRecognitionResult): void {
    if (!result.isFinal) {
      this.lastTranscript = result.transcript;
      return;
    }

    const transcript = result.transcript.toLowerCase().trim();
    console.log('Voice input received:', transcript);
    
    // Process the final transcript
    this.processVoiceInput(transcript);
  }

  /**
   * Handle speech recognition errors
   */
  private handleSpeechError(error: string): void {
    console.error('Speech recognition error:', error);
    Speech.speak('Sorry, there was an error with voice recognition. Please try again.');
    this.isListening = false;
  }

  /**
   * Handle speech recognition start
   */
  private handleSpeechStart(): void {
    this.isListening = true;
    this.uiCallbacks.onListeningStateChanged?.(true);
    console.log('Speech recognition started');
  }

  /**
   * Handle speech recognition end
   */
  private handleSpeechEnd(): void {
    this.isListening = false;
    this.uiCallbacks.onListeningStateChanged?.(false);
    console.log('Speech recognition ended');
  }

  /**
   * Set UI callbacks for visual feedback
   */
  setUICallbacks(callbacks: {
    onWakeWordDetected?: () => void;
    onCommandReady?: () => void;
    onListeningStateChanged?: (isListening: boolean) => void;
  }): void {
    this.uiCallbacks = callbacks;
  }

  /**
   * Handle wake word detection
   */
  private handleWakeWordDetected(): void {
  console.log(`Wake word "${this.options.wakeWord}" detected!`);
    Speech.speak('Yes?', { rate: 1.2 }); // Quick acknowledgment
    
    // Trigger wake word animation in UI
    this.uiCallbacks.onWakeWordDetected?.();
  }

  /**
   * Handle command ready state
   */
  private handleCommandReady(): void {
    console.log('Command ready for processing');
    this.uiCallbacks.onCommandReady?.();
  }

  /**
   * Add navigation commands for the current screen
   */
  addCommands(commands: VoiceCommand[]): void {
    this.commands = commands;
  }

  /**
   * Clear all commands (useful when navigating to a new screen)
   */
  clearCommands(): void {
    this.commands = [];
  }

  /**
   * Speak available commands to the user
   */
  announceCommands(): void {
    if (!this.options.enabled || this.commands.length === 0) return;

    const commandList = this.commands
      .map(cmd => cmd.description)
      .join(', ');
    
    Speech.speak(`Available voice commands: ${commandList}. Say "${this.options.wakeWord}" followed by your command.`);
  }

  /**
   * Process voice input and execute matching commands
   */
  processVoiceInput(input: string): boolean {
    if (!this.options.enabled) return false;

    const normalizedInput = input.toLowerCase().trim();
    
    // Check if input contains wake word
    if (!normalizedInput.includes(this.options.wakeWord!.toLowerCase())) {
      return false;
    }

    // Remove wake word and process command
    const command = normalizedInput
      .replace(this.options.wakeWord!.toLowerCase(), '')
      .trim();

    // Find matching command
    const matchingCommand = this.commands.find(cmd =>
      cmd.commands.some(c => command.includes(c.toLowerCase()))
    );

    if (matchingCommand) {
      if (this.options.confirmVoiceActions) {
        Speech.speak(`Executing: ${matchingCommand.description}`);
      }
      
      // Execute the command after a brief delay to allow speech to complete
      setTimeout(() => {
        try {
          matchingCommand.action();
          return true;
        } catch (error) {
          console.error('Voice command execution error:', error);
          Speech.speak('Sorry, there was an error executing that command.');
          return false;
        }
      }, 500);
      
      return true;
    } else {
      Speech.speak(`Sorry, I didn't understand "${command}". Try saying "help" to hear available commands.`);
      return false;
    }
  }

  /**
   * Start listening for voice commands
   */
  async startListening(): Promise<void> {
    if (!this.options.enabled) {
      Speech.speak('Voice navigation is disabled');
      return;
    }

    if (this.isListening) {
      Speech.speak('Already listening for voice commands');
      return;
    }

    try {
      Speech.speak(`Voice navigation activated. Say "${this.options.wakeWord}" followed by your command.`);
      await speechRecognitionService.startListening({
        language: 'en-US',
        timeout: this.options.timeout,
        interimResults: true
      });
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      
      // Fallback to test interface
      this.showTestInterface();
    }
  }

  /**
   * Show test interface for voice commands (fallback)
   */
  private showTestInterface(): void {
    const availableCommands = this.commands.map(cmd => 
      `${this.options.wakeWord} ${cmd.commands[0]}`
    );

    Alert.alert(
      'Voice Navigation (Test Mode)',
      'Choose a command to simulate voice input:',
      [
        ...availableCommands.slice(0, 6).map(cmd => ({
          text: cmd,
          onPress: () => {
            Speech.speak(`Simulating: ${cmd}`);
            speechRecognitionService.simulateVoiceInput(cmd);
          }
        })),
        {
          text: 'Type Custom Command',
          onPress: () => this.showCustomCommandInput()
        },
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => this.stopListening()
        }
      ]
    );
  }

  /**
   * Show custom command input
   */
  private showCustomCommandInput(): void {
    Alert.prompt(
      'Custom Voice Command',
      `Type a command (e.g., "${this.options.wakeWord} go home"):`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Execute',
          onPress: (input) => {
            if (input && input.trim()) {
              speechRecognitionService.simulateVoiceInput(input.trim());
            }
          }
        }
      ],
      'plain-text',
      `${this.options.wakeWord} `
    );
  }

  /**
   * Stop listening for voice commands
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    speechRecognitionService.stopListening();
    this.isListening = false;
    Speech.speak('Voice navigation stopped.');
  }

  /**
   * Show test commands for development/demo purposes
   */
  private showTestCommands(): void {
    const testCommands = this.commands.map(cmd => 
      `${this.options.wakeWord} ${cmd.commands[0]}`
    );

    Alert.alert(
      'Test Voice Commands',
      'Choose a command to simulate:',
      [
        ...testCommands.map(cmd => ({
          text: cmd,
          onPress: () => this.processVoiceInput(cmd)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }

  /**
   * Get current listening status
   */
  getListeningStatus(): boolean {
    return this.isListening;
  }

  /**
   * Toggle voice navigation on/off
   */
  toggle(): void {
    this.options.enabled = !this.options.enabled;
    Speech.speak(this.options.enabled ? 'Voice navigation enabled' : 'Voice navigation disabled');
  }
}

// Create a singleton instance for global use
export const voiceNavigationService = new VoiceNavigationService();

// Navigation command templates for common screens
export const createNavigationCommands = (navigation: any) => {
  return {
    home: [
      {
        commands: ['go home', 'home screen', 'main screen'],
        action: () => navigation.navigate('Home'),
        description: 'Go to home screen'
      },
      {
        commands: ['indoor navigation', 'navigation', 'navigate'],
        action: () => navigation.navigate('IndoorNavigation'),
        description: 'Open indoor navigation'
      },
      {
        commands: ['main menu', 'menu'],
        action: () => navigation.navigate('MainMenu'),
        description: 'Open main menu'
      },
      {
        commands: ['normal mode', 'camera mode', 'detection mode'],
        action: () => navigation.navigate('NormalMode'),
        description: 'Open normal detection mode'
      },
      {
        commands: ['set floor map', 'floor map', 'map settings'],
        action: () => navigation.navigate('SetFloorMap'),
        description: 'Open floor map settings'
      }
    ],
    
    general: [
      {
        commands: ['help', 'what can you do', 'commands'],
        action: () => voiceNavigationService.announceCommands(),
        description: 'List available commands'
      },
      {
        commands: ['go back', 'back', 'previous'],
        action: () => navigation.goBack(),
        description: 'Go back to previous screen'
      },
      {
        commands: ['stop listening', 'disable voice', 'quiet'],
        action: () => voiceNavigationService.stopListening(),
        description: 'Stop voice navigation'
      }
    ]
  };
};
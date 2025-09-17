import * as Speech from 'expo-speech';
import { Alert, Platform } from 'react-native';

// Note: Expo doesn't have built-in speech recognition, but we can simulate it
// In a real implementation, you would use react-native-voice or @react-native-async-storage/async-storage
// with a speech recognition service like Google Speech API or Azure Speech Services

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechRecognitionOptions {
  language?: string;
  timeout?: number;
  interimResults?: boolean;
  maxResults?: number;
}

export class SpeechRecognitionService {
  private isListening: boolean = false;
  private wakeWord: string = 'ziya';
  private callbacks: {
    onResult?: (result: SpeechRecognitionResult) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onWakeWordDetected?: () => void;
    onCommandReady?: () => void;
  } = {};
  private wakeWordDetected: boolean = false;

  constructor() {
    // Check if speech recognition is supported
    if (Platform.OS === 'web') {
      // Web Speech API is available in browsers
      this.initWebSpeechAPI();
    }
  }

  /**
   * Set the wake word used to activate command mode
   */
  setWakeWord(word: string) {
    if (word) {
      this.wakeWord = word.toLowerCase().trim();
    }
  }

  private initWebSpeechAPI() {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        this.isListening = true;
        this.wakeWordDetected = false; // Reset wake word state
        this.callbacks.onStart?.();
      };
      
  recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        const confidence = event.results[last][0].confidence;
        const isFinal = event.results[last].isFinal;
        
        // Check for wake word detection
        const normalizedTranscript = transcript.toLowerCase().trim();
        if (normalizedTranscript.includes(this.wakeWord) && !this.wakeWordDetected) {
          this.wakeWordDetected = true;
          this.callbacks.onWakeWordDetected?.();
          
          // If there's more content after the wake word, treat it as command ready
          const afterWakeWord = normalizedTranscript.split(this.wakeWord)[1]?.trim();
          if (afterWakeWord && afterWakeWord.length > 0) {
            this.callbacks.onCommandReady?.();
          }
        } else if (this.wakeWordDetected && normalizedTranscript.includes(this.wakeWord)) {
          // Wake word already detected, this is a command
          this.callbacks.onCommandReady?.();
        }
        
        this.callbacks.onResult?.({
          transcript,
          confidence,
          isFinal
        });
      };
      
      recognition.onerror = (event: any) => {
        this.callbacks.onError?.(event.error);
      };
      
      recognition.onend = () => {
        this.isListening = false;
        this.wakeWordDetected = false; // Reset wake word state
        this.callbacks.onEnd?.();
      };
      
      (this as any).recognition = recognition;
    }
  }

  setCallbacks(callbacks: {
    onResult?: (result: SpeechRecognitionResult) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onWakeWordDetected?: () => void;
    onCommandReady?: () => void;
  }) {
    this.callbacks = callbacks;
  }

  /**
   * Reset wake word detection state
   */
  resetWakeWordState(): void {
    this.wakeWordDetected = false;
  }

  /**
   * Check if speech recognition is available on the current platform
   */
  isAvailable(): boolean {
    if (Platform.OS === 'web') {
      return !!(window as any).webkitSpeechRecognition || !!(window as any).SpeechRecognition;
    }
    
    // For mobile, we assume it's available (handled by expo-speech and native APIs)
    return true;
  }

  async startListening(options: SpeechRecognitionOptions = {}): Promise<void> {
    if (this.isListening) {
      return;
    }

    try {
      if (Platform.OS === 'web' && (this as any).recognition) {
        // Use Web Speech API
        (this as any).recognition.start();
      } else {
        // For mobile platforms, show a text input modal as fallback
        this.showTextInputFallback();
      }
    } catch (error) {
      this.callbacks.onError?.(`Failed to start listening: ${error}`);
    }
  }

  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    if (Platform.OS === 'web' && (this as any).recognition) {
      (this as any).recognition.stop();
    }
    
    this.isListening = false;
    this.callbacks.onEnd?.();
  }

  getListeningStatus(): boolean {
    return this.isListening;
  }

  private showTextInputFallback(): void {
    // Fallback for mobile platforms without speech recognition
    Alert.prompt(
      'Voice Command',
      'Speech recognition is not available. Please type your command:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => this.callbacks.onEnd?.()
        },
        {
          text: 'Submit',
          onPress: (text) => {
            if (text && text.trim()) {
              this.callbacks.onResult?.({
                transcript: text.trim(),
                confidence: 1.0,
                isFinal: true
              });
            }
            this.callbacks.onEnd?.();
          }
        }
      ],
      'plain-text',
      '',
      'default'
    );
  }

  // Simulated speech recognition for demo purposes
  simulateVoiceInput(text: string): void {
    this.callbacks.onStart?.();
    this.wakeWordDetected = false; // Reset state
    
    const normalizedText = text.toLowerCase().trim();
    
    // Simulate wake word detection if the wakeWord is present
    if (normalizedText.includes(this.wakeWord)) {
      setTimeout(() => {
        this.wakeWordDetected = true;
        this.callbacks.onWakeWordDetected?.();
        
        // Check if there's a command after wake word
        const afterWakeWord = normalizedText.split(this.wakeWord)[1]?.trim();
        if (afterWakeWord && afterWakeWord.length > 0) {
          setTimeout(() => {
            this.callbacks.onCommandReady?.();
          }, 300);
        }
      }, 200);
    }
    
    // Simulate processing delay
    setTimeout(() => {
      this.callbacks.onResult?.({
        transcript: text,
        confidence: 0.95,
        isFinal: true
      });
      
      setTimeout(() => {
        this.callbacks.onEnd?.();
      }, 100);
    }, 500);
  }
}

// Export singleton instance
export const speechRecognitionService = new SpeechRecognitionService();
declare module 'react-native-voice' {
  export interface SpeechStartEvent {
    error?: boolean;
  }

  export interface SpeechEndEvent {
    error?: boolean;
  }

  export interface SpeechErrorEvent {
    error?: {
      code?: string;
      message?: string;
    };
  }

  export interface SpeechResultsEvent {
    value?: string[];
  }

  export interface SpeechVolumeChangedEvent {
    value?: number;
  }

  export interface SpeechRecognizedEvent {
    isFinal?: boolean;
  }

  class Voice {
    static onSpeechStart: ((e: SpeechStartEvent) => void) | null;
    static onSpeechRecognized: ((e: SpeechRecognizedEvent) => void) | null;
    static onSpeechEnd: ((e: SpeechEndEvent) => void) | null;
    static onSpeechError: ((e: SpeechErrorEvent) => void) | null;
    static onSpeechResults: ((e: SpeechResultsEvent) => void) | null;
    static onSpeechPartialResults: ((e: SpeechResultsEvent) => void) | null;
    static onSpeechVolumeChanged: ((e: SpeechVolumeChangedEvent) => void) | null;

    static isAvailable(): Promise<0 | 1>;
    static start(locale: string, options?: Record<string, any>): Promise<void>;
    static stop(): Promise<void>;
    static cancel(): Promise<void>;
    static destroy(): Promise<void>;
    static removeAllListeners(): void;
    static isRecognizing(): Promise<0 | 1>;
    static getSpeechRecognitionServices(): Promise<string[]>;
  }

  export default Voice;
}

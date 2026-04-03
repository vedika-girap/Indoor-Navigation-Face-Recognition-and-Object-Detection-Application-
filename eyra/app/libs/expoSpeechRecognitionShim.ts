import { useEffect } from 'react';

// Try to load the real native module if it's available (in a dev-client or custom build).
// If it's not available we fall back to a safe no-op shim so the app doesn't crash in
// Expo Go or in JS-only test environments.
let RealModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  RealModule = require('expo-speech-recognition');
  // If require succeeded but module has a .default export, use it
  if (RealModule && RealModule.default) RealModule = RealModule.default;
} catch (e) {
  RealModule = null;
}

const noop = async () => undefined;

const shimModule = {
  async requestPermissionsAsync() {
    return { granted: true } as const;
  },
  start: async (_opts?: any) => {
    console.info('[expo-speech-recognition shim] start called with', _opts);
    return;
  },
  stop: async () => {
    console.info('[expo-speech-recognition shim] stop called');
    return;
  },
};

export const ExpoSpeechRecognitionModule: any = RealModule || shimModule;
export const isNativeSpeechRecognitionAvailable = !!RealModule;

// Hook: if native implementation exposes a hook, forward to it; otherwise provide a no-op hook
export function useSpeechRecognitionEvent(event: string, cb: (event: any) => void) {
  if (RealModule && typeof RealModule.useSpeechRecognitionEvent === 'function') {
    return RealModule.useSpeechRecognitionEvent(event, cb);
  }

  useEffect(() => {
    // no-op: no native events available in shim
    console.debug('[expo-speech-recognition shim] useSpeechRecognitionEvent installed for', event);
    return () => {};
  }, [event, cb]);
}

export default ExpoSpeechRecognitionModule;

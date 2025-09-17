import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Text, TouchableOpacity } from 'react-native';
import * as Speech from 'expo-speech';
import { voiceNavigationService } from '../services/voiceNavigation';

interface GlobalVoiceListenerProps {
  children: React.ReactNode;
}

export const GlobalVoiceListener: React.FC<GlobalVoiceListenerProps> = ({ children }) => {
  const [isListening, setIsListening] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [commandReady, setCommandReady] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [wakeWordAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Setup voice navigation UI callbacks
    voiceNavigationService.setUICallbacks({
      onWakeWordDetected: () => {
        setWakeWordDetected(true);
        startWakeWordAnimation();
        // Reset wake word state after 3 seconds
        setTimeout(() => {
          setWakeWordDetected(false);
          setCommandReady(false);
        }, 3000);
      },
      onCommandReady: () => {
        setCommandReady(true);
      },
      onListeningStateChanged: (listening: boolean) => {
        setIsListening(listening);
      }
    });

    return () => {
      // Clear callbacks on unmount
      voiceNavigationService.setUICallbacks({});
    };
  }, []);

  useEffect(() => {
    if (isListening) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isListening]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startWakeWordAnimation = () => {
    // Special animation for wake word detection - rapid pulse with color change
    Animated.sequence([
      Animated.timing(wakeWordAnim, {
        toValue: 1.5,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(wakeWordAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(wakeWordAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(wakeWordAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.setValue(1);
  };

  const toggleVoiceNavigation = () => {
    if (isListening) {
      voiceNavigationService.stopListening();
      Speech.speak('Voice navigation stopped');
    } else {
      voiceNavigationService.startListening();
    }
  };

  return (
    <View style={styles.container}>
      {children}
      
      {/* Global Voice Navigation Indicator */}
      <View style={styles.voiceIndicator}>
        <TouchableOpacity
          style={[
            styles.voiceButton,
            isListening && styles.voiceButtonActive,
            wakeWordDetected && styles.voiceButtonWakeWord,
            commandReady && styles.voiceButtonCommandReady
          ]}
          onPress={toggleVoiceNavigation}
          accessibilityLabel="Voice navigation toggle"
          accessibilityHint={isListening ? "Tap to stop voice navigation" : "Tap to start voice navigation"}
        >
          <Animated.View
            style={[
              styles.voiceIcon,
              { 
                transform: [
                  { scale: pulseAnim },
                  { scale: wakeWordDetected ? wakeWordAnim : 1 }
                ] 
              },
              isListening && styles.voiceIconActive,
              wakeWordDetected && styles.voiceIconWakeWord,
              commandReady && styles.voiceIconCommandReady
            ]}
          >
            <Text style={[
              styles.voiceIconText, 
              isListening && styles.voiceIconTextActive,
              wakeWordDetected && styles.voiceIconTextWakeWord,
              commandReady && styles.voiceIconTextCommandReady
            ]}>
              {wakeWordDetected ? '👂' : commandReady ? '💬' : '🎤'}
            </Text>
          </Animated.View>
        </TouchableOpacity>
        
        {isListening && (
          <Text style={styles.listeningText}>
            {wakeWordDetected ? 'Ziya Activated!' : commandReady ? 'Ready for command...' : 'Listening...'}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  voiceIndicator: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  voiceButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  voiceButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  voiceButtonWakeWord: {
    backgroundColor: '#FFD700', // Gold color for wake word
  },
  voiceButtonCommandReady: {
    backgroundColor: '#00FF7F', // Spring green for command ready
  },
  voiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  voiceIconActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  voiceIconWakeWord: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  voiceIconCommandReady: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  voiceIconText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  voiceIconTextActive: {
    color: '#FFFFFF',
  },
  voiceIconTextWakeWord: {
    color: '#FFFFFF',
  },
  voiceIconTextCommandReady: {
    color: '#FFFFFF',
  },
  listeningText: {
    marginTop: 8,
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 4,
  },
});

export default GlobalVoiceListener;
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { voiceNavigationService } from '../services/voiceNavigation';
import { speechRecognitionService } from '../services/speechRecognition';
import { debugVoiceNavigation } from '../debug/voiceNavigationDebugger';
import * as Speech from 'expo-speech';

export default function VoiceTestScreen() {
  const [debugResults, setDebugResults] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [voiceStatus, setVoiceStatus] = useState<string>('Ready');

  useEffect(() => {
    // Setup voice navigation callbacks
    voiceNavigationService.setUICallbacks({
      onWakeWordDetected: () => {
        setVoiceStatus('Wake word detected!');
        Speech.speak('Wake word detected');
      },
      onCommandReady: () => {
        setVoiceStatus('Command ready');
      },
      onListeningStateChanged: (listening: boolean) => {
        setIsListening(listening);
        setVoiceStatus(listening ? 'Listening...' : 'Stopped');
      }
    });

    // Setup speech recognition callbacks
    speechRecognitionService.setCallbacks({
      onResult: (result) => {
        setLastCommand(result.transcript);
        console.log('Speech result:', result);
      },
      onError: (error) => {
        setVoiceStatus(`Error: ${error}`);
        console.error('Speech error:', error);
      },
      onStart: () => {
        setVoiceStatus('Speech recognition started');
      },
      onEnd: () => {
        setVoiceStatus('Speech recognition ended');
      }
    });

    // Setup test commands
    const testCommands = [
      {
        commands: ['test', 'hello'],
        action: () => {
          Speech.speak('Test command executed successfully!');
          setVoiceStatus('Test command executed');
        },
        description: 'Test voice command'
      },
      {
        commands: ['go home', 'home'],
        action: () => {
          Speech.speak('Going to home screen');
          setVoiceStatus('Home command executed');
        },
        description: 'Go to home screen'
      }
    ];

    voiceNavigationService.addCommands(testCommands);

    return () => {
      voiceNavigationService.clearCommands();
    };
  }, []);

  const runDebug = async () => {
    try {
      const results = await debugVoiceNavigation();
      setDebugResults(results);
      console.log('Debug results:', results);
    } catch (error) {
      console.error('Debug failed:', error);
      setVoiceStatus(`Debug failed: ${error}`);
    }
  };

  const startListening = async () => {
    try {
      await voiceNavigationService.startListening();
      setVoiceStatus('Starting voice navigation...');
    } catch (error) {
      console.error('Failed to start listening:', error);
      setVoiceStatus(`Failed to start: ${error}`);
    }
  };

  const stopListening = () => {
    voiceNavigationService.stopListening();
    setVoiceStatus('Voice navigation stopped');
  };

  const testSpeechSynthesis = () => {
    Speech.speak('Speech synthesis is working!');
    setVoiceStatus('Testing speech synthesis');
  };

  const testVoiceInput = (command: string) => {
    speechRecognitionService.simulateVoiceInput(command);
    setVoiceStatus(`Simulated: ${command}`);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Voice Navigation Test</Text>
      
      <View style={styles.statusSection}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={[styles.status, isListening && styles.statusListening]}>
          {voiceStatus}
        </Text>
        <Text style={styles.info}>
          Listening: {isListening ? 'YES' : 'NO'}
        </Text>
        <Text style={styles.info}>
          Last Command: {lastCommand || 'None'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Voice Controls</Text>
        <TouchableOpacity style={styles.button} onPress={startListening}>
          <Text style={styles.buttonText}>Start Listening</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={stopListening}>
          <Text style={styles.buttonText}>Stop Listening</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={testSpeechSynthesis}>
          <Text style={styles.buttonText}>Test Speech Output</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Commands</Text>
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={() => testVoiceInput('ziya test')}
        >
          <Text style={styles.buttonText}>Simulate: "Ziya Test"</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={() => testVoiceInput('ziya go home')}
        >
          <Text style={styles.buttonText}>Simulate: "Ziya Go Home"</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={() => testVoiceInput('ziya hello')}
        >
          <Text style={styles.buttonText}>Simulate: "Ziya Hello"</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diagnostics</Text>
        <TouchableOpacity style={styles.debugButton} onPress={runDebug}>
          <Text style={styles.buttonText}>Run Full Diagnostic</Text>
        </TouchableOpacity>
        
        {debugResults && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Debug Results:</Text>
            <Text style={styles.resultsText}>
              Total: {debugResults.results?.length || 0} tests
            </Text>
            <Text style={styles.resultsText}>
              Passed: {debugResults.results?.filter((r: any) => r.status === 'PASS').length || 0}
            </Text>
            <Text style={styles.resultsText}>
              Failed: {debugResults.results?.filter((r: any) => r.status === 'FAIL').length || 0}
            </Text>
            
            {debugResults.recommendations?.map((rec: string, index: number) => (
              <Text key={index} style={styles.recommendation}>
                • {rec}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        <Text style={styles.instruction}>
          1. Tap "Start Listening" to activate voice navigation
        </Text>
        <Text style={styles.instruction}>
          2. Say "Ziya" followed by a command (e.g., "Ziya test")
        </Text>
        <Text style={styles.instruction}>
          3. Watch for visual feedback and listen for audio responses
        </Text>
        <Text style={styles.instruction}>
          4. Use simulation buttons to test without speaking
        </Text>
        <Text style={styles.instruction}>
          5. Run diagnostics to troubleshoot issues
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#e8f4fd',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  statusListening: {
    color: '#4A90E2',
  },
  info: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  button: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  debugButton: {
    backgroundColor: '#FFA500',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultsText: {
    fontSize: 14,
    marginBottom: 2,
  },
  recommendation: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
});

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  StatusBar,
  LayoutAnimation,
  UIManager,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { BlurView } from 'expo-blur';
import * as Speech from 'expo-speech';

import accessibilityService from '../../services/accessibilityService';
import verbosityManager from '../../services/verbosityManager';
import actionHistoryManager from '../../services/actionHistoryManager';
import offlineManager from '../../services/offlineManager';
import errorRecoveryService from '../../services/errorRecoveryService';
import { calculateRoute, type RoomWaypoint } from '../../services/indoorNavigationService';
import { listFloorMaps, type FloorMap } from '../../services/floorMapService';
import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';
import { DEMO_USER_ID } from '../../constants/user';

const { width, height } = Dimensions.get('window');

interface Detection {
  label: string;
  confidence: number;
  bbox?: number[];
  type?: 'object' | 'face'; // Add type to distinguish
}

interface DetectionStats {
  totalDetections: number;
  avgConfidence: number;
  categories: { [key: string]: number };
  faces: number; // Track face count
}

export default function DetectionScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  
  // Detection state
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastAnnouncement, setLastAnnouncement] = useState<string>('');
  const [stats, setStats] = useState<DetectionStats>({ totalDetections: 0, avgConfidence: 0, categories: {}, faces: 0 });
  const [detectionRange, setDetectionRange] = useState<'short' | 'medium' | 'all'>('medium');
  const [showRangeSelector, setShowRangeSelector] = useState(true);
  const [backendConnected, setBackendConnected] = useState(true);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<RoomWaypoint[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentInstruction, setCurrentInstruction] = useState('');
  const [showNavSetup, setShowNavSetup] = useState(false);
  const [availableMaps, setAvailableMaps] = useState<FloorMap[]>([]);
  const [selectedMap, setSelectedMap] = useState<FloorMap | null>(null);
  const [sourceRoom, setSourceRoom] = useState('');
  const [destinationRoom, setDestinationRoom] = useState('');
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  
  // Performance tracking
  const lastFrameTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<any>(null);
  const announcedObjectsRef = useRef<Map<string, number>>(new Map());
  const prevDetectionsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    initializeDetection();
    return cleanup;
  }, []);

  // Auto-speak navigation instructions when step changes
  useEffect(() => {
    if (isNavigating && currentRoute.length > 0 && currentInstruction) {
      const waypoint = currentRoute[currentStep];
      const stepInfo = (waypoint as any).steps ? `Walk ${(waypoint as any).steps} steps` : '';
      const turnInfo = (waypoint as any).turn_instruction || '';
      
      let fullInstruction = '';
      if (currentStep === 0) {
        // First instruction
        fullInstruction = stepInfo 
          ? `Navigation started. ${stepInfo} and ${turnInfo}. ${currentInstruction}. Click Next when you complete each step.`
          : `Navigation started. ${currentInstruction}. Click Next when you complete each step.`;
      } else {
        // Subsequent instructions
        fullInstruction = stepInfo ? `${stepInfo} and ${turnInfo}. ${currentInstruction}` : currentInstruction;
      }
      
      Speech.speak(fullInstruction, {
        language: 'en',
        pitch: 1.0,
        rate: 0.85,
      });
    }
  }, [currentStep, isNavigating]);


  const initializeDetection = async () => {
    actionHistoryManager.addBreadcrumb('detection', 'Object Detection');
    
    accessibilityService.speak(
      'Object detection activated. Point your camera at objects, people, or obstacles. ' +
      'Tap navigation button to start turn by turn directions.',
      2,
      false
    );

    // Load maps for navigation
    await loadAvailableMaps();

    // Start continuous detection
    startContinuousDetection();
  };

  const loadAvailableMaps = async () => {
    try {
      const maps = await listFloorMaps(DEMO_USER_ID);
      setAvailableMaps(maps);
    } catch (error) {
      console.error('Failed to load maps:', error);
    }
  };

  const extractRoomsFromMap = (map: FloorMap): string[] => {
    const rooms = new Set<string>();
    if (map.metadata?.labels) {
      map.metadata.labels.forEach((label: any) => {
        // Check both 'label' and 'room_label' fields
        const roomName = label.label || label.room_label;
        if (roomName) {
          let cleanName = roomName;
          // Remove segment suffixes
          cleanName = cleanName.replace(/_seg\d+$/i, '');
          cleanName = cleanName.replace(/segment\s*\d+/gi, '');
          cleanName = cleanName.replace(/\s+/g, ' ').trim();
          if (cleanName) rooms.add(cleanName);
        }
      });
    }
    return Array.from(rooms).sort();
  };

  const startNavigation = async () => {
    if (!selectedMap || !sourceRoom || !destinationRoom) {
      Alert.alert('Missing Information', 'Please select map, source, and destination.');
      return;
    }

    try {
      accessibilityService.speak('Calculating route...', 2);
      const routeData: any = await calculateRoute(DEMO_USER_ID, selectedMap.map_id, sourceRoom, destinationRoom);
      
      console.log('Route calculation response:', routeData);
      
      // Backend returns { route: [...] } not { waypoints: [...] }
      const waypoints = routeData?.route || [];
      
      if (waypoints && waypoints.length > 0) {
        setCurrentRoute(waypoints);
        setCurrentStep(0);
        setIsNavigating(true);
        setShowNavSetup(false);
        
        const firstWaypoint = waypoints[0];
        const firstInstruction = firstWaypoint.instruction || `Head to ${firstWaypoint.room_label}`;
        setCurrentInstruction(firstInstruction);
        
        // Voice will be handled by useEffect when currentStep/currentInstruction changes
        accessibilityService.triggerHaptic('success');
      } else {
        Alert.alert('No Route', 'Could not find a route to destination. Make sure the map has been processed with room labels.');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to calculate route. Check if map is processed.');
    }
  };

  const nextStep = () => {
    if (currentStep < currentRoute.length - 1) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);
      const waypoint = currentRoute[nextStepIndex];
      const instruction = waypoint.instruction || `Continue to ${waypoint.room_label}`;
      setCurrentInstruction(instruction);
      
      // Voice will be handled by useEffect when currentStep changes
      accessibilityService.triggerHaptic('navigationStep');
    } else {
      setIsNavigating(false);
      const arrivalMessage = 'You have arrived at your destination!';
      Speech.speak(arrivalMessage, {
        language: 'en',
        pitch: 1.0,
        rate: 0.85,
      });
      accessibilityService.triggerHaptic('success');
    }
  };

  const stopNavigation = () => {
    Speech.stop(); // Stop any ongoing speech
    setIsNavigating(false);
    setCurrentRoute([]);
    setCurrentStep(0);
    setCurrentInstruction('');
    accessibilityService.speak('Navigation stopped', 2);
  };

  const cleanup = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
    accessibilityService.stop();
  };

  const startContinuousDetection = () => {
    // Adaptive frame rate based on performance
    const isLowPower = offlineManager.isOfflineMode();
    const interval = isLowPower ? 2000 : 800; // Reduced from 700ms for battery
    
    frameIntervalRef.current = setInterval(() => {
      if (!isProcessing) {
        captureAndDetect();
      }
    }, interval);
  };

  const captureAndDetect = async () => {
    if (!cameraRef.current || isProcessing) return;

    // Check camera permission
    if (!permission?.granted) {
      console.warn('Camera permission not granted');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Add timeout for camera capture
      const capturePromise = cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
        skipProcessing: true, // Skip processing for faster capture
      });

      // Timeout after 5 seconds
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Camera capture timeout')), 5000)
      );

      const photo = await Promise.race([capturePromise, timeoutPromise]);

      if (!photo || !photo.uri) {
        console.warn('No photo captured or invalid URI');
        return;
      }

      // Resize for faster processing
      const resized = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.7, format: SaveFormat.JPEG }
      );

      // Detect objects with network error handling
      const results = await detectObjects(resized.uri);
      
      if (results) {
        processDetections(results);
        setBackendConnected(true);
        setConsecutiveErrors(0);
      } else {
        // Increment error counter
        setConsecutiveErrors(prev => prev + 1);
        if (consecutiveErrors > 3) {
          setBackendConnected(false);
        }
      }
    } catch (error: any) {
      console.error('Detection error:', error);
      
      // Handle specific errors
      if (error.message?.includes('timeout')) {
        console.warn('Camera capture timeout - camera may be busy');
      } else if (error.message?.includes('Failed to capture')) {
        console.warn('Camera capture failed - retrying on next interval');
      } else {
        // Only log non-critical errors, don't show to user
        await errorRecoveryService.handleError('Object detection', error, 'low', false);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const detectObjects = async (imageUri: string): Promise<Detection[] | null> => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'frame.jpg',
      } as any);
      formData.append('user_id', DEMO_USER_ID);

      // Add timeout for network request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(API_ENDPOINTS.combinedDetection, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Detection API error:', response.status, errorText);
        
        // Return empty array instead of throwing to keep app running
        if (response.status === 500) {
          console.warn('Backend error - continuing with empty detections');
          return [];
        }
        return null;
      }

      const data = await response.json();
      
      // Combine objects and faces
      const combinedDetections: Detection[] = [];
      
      // Add object detections
      if (data.detections && Array.isArray(data.detections)) {
        data.detections.forEach((det: any) => {
          combinedDetections.push({
            label: det.label || det.class,
            confidence: det.confidence || det.score || 0,
            bbox: det.bbox,
            type: 'object',
          });
        });
      }
      
      // Add face detections
      if (data.faces && Array.isArray(data.faces)) {
        data.faces.forEach((face: any) => {
          const faceName = face.name || face.label || 'Unknown Person';
          combinedDetections.push({
            label: faceName,
            confidence: face.confidence || 0.9,
            bbox: face.bbox,
            type: 'face',
          });
        });
      }
      
      return combinedDetections;
    } catch (error: any) {
      // Handle network errors gracefully
      if (error.name === 'AbortError') {
        console.warn('Detection request timeout - backend may be slow');
      } else if (error.message?.includes('Network request failed')) {
        console.error('Network connection lost - check if backend is running');
      } else {
        console.error('Detection API error:', error);
      }
      return null;
    }
  };

  const processDetections = useCallback((newDetections: Detection[]) => {
    // Filter by detection range based on confidence
    let filteredDetections = newDetections;
    
    if (detectionRange === 'short') {
      // High confidence only (close objects)
      filteredDetections = newDetections.filter(d => d.confidence >= 0.7);
    } else if (detectionRange === 'medium') {
      // Medium to high confidence (moderate distance)
      filteredDetections = newDetections.filter(d => d.confidence >= 0.5);
    }
    // 'all' shows everything (no filter)
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetections(filteredDetections);
    updateStats(filteredDetections);
    announceDetections(filteredDetections);
  }, [detectionRange]);

  const updateStats = (newDetections: Detection[]) => {
    const categories: { [key: string]: number } = {};
    let totalConfidence = 0;

    newDetections.forEach((det) => {
      const category = det.label.split(' ')[0]; // First word as category
      categories[category] = (categories[category] || 0) + 1;
      totalConfidence += det.confidence;
    });

    const faceCount = newDetections.filter(d => d.type === 'face').length;
    
    setStats({
      totalDetections: newDetections.length,
      avgConfidence: newDetections.length > 0 ? totalConfidence / newDetections.length : 0,
      categories,
      faces: faceCount,
    });
  };

  const announceDetections = (newDetections: Detection[]) => {
    if (!voiceEnabled || newDetections.length === 0) return;

    const now = Date.now();
    const currentLabels = newDetections.map((d) => d.label);
    
    // Find new objects (not announced recently)
    const newObjects = newDetections.filter((det) => {
      const lastTime = announcedObjectsRef.current.get(det.label) || 0;
      return now - lastTime > 5000; // Announce every 5 seconds max
    });

    if (newObjects.length === 0) return;

    // Separate objects and faces for better announcement
    const objects = newObjects.filter(d => d.type === 'object');
    const faces = newObjects.filter(d => d.type === 'face');
    
    let announcement = '';
    
    if (objects.length > 0) {
      const objectList = objects.map((d) => d.label).join(', ');
      announcement += `Detected ${objects.length} object${objects.length > 1 ? 's' : ''}: ${objectList}. `;
    }
    
    if (faces.length > 0) {
      const faceList = faces.map((d) => d.label).join(', ');
      announcement += `Recognized ${faces.length} face${faces.length > 1 ? 's' : ''}: ${faceList}. `;
    }

    // Use expo-speech for clearer announcements
    Speech.speak(announcement, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
    });
    
    setLastAnnouncement(announcement);

    // Update announcement times
    newObjects.forEach((det) => {
      announcedObjectsRef.current.set(det.label, now);
    });

    prevDetectionsRef.current = currentLabels;
  };

  const categorizeByPosition = (detections: Detection[]): string => {
    // Simple spatial categorization based on bounding box
    const positions: string[] = [];
    
    detections.forEach((det) => {
      if (!det.bbox) return;
      
      const [x, y, w, h] = det.bbox;
      const centerX = x + w / 2;
      
      if (centerX < width * 0.33) {
        positions.push('left');
      } else if (centerX > width * 0.67) {
        positions.push('right');
      } else {
        positions.push('center');
      }
    });

    const unique = [...new Set(positions)];
    if (unique.length === 0) return 'ahead';
    if (unique.length === 1) return unique[0];
    return unique.join(' and ');
  };

  const speakWithPriority = (text: string, priority: number = 3) => {
    if (!voiceEnabled && priority > 2) return;
    
    setLastAnnouncement(text);
    accessibilityService.speak(text, priority, priority > 2);
  };

  const toggleVoice = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    
    actionHistoryManager.recordAction({
      type: 'voice_toggle',
      description: `Voice ${newState ? 'enabled' : 'disabled'}`,
      reversible: false,
    });

    accessibilityService.speak(
      newState ? 'Voice feedback enabled' : 'Voice feedback disabled',
      2,
      false
    );
    accessibilityService.triggerHaptic('success');
  };

  const handleBack = () => {
    accessibilityService.speak('Going back to home', 2, false);
    router.back();
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#667eea" />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          Ziya needs camera access to detect objects and obstacles around you.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        {/* Top Controls */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent']}
          style={styles.topGradient}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleBack}
              accessible={true}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.titleText}>Object Detection</Text>

            <TouchableOpacity
              style={[styles.iconButton, !voiceEnabled && styles.iconButtonMuted]}
              onPress={toggleVoice}
              accessible={true}
              accessibilityLabel={voiceEnabled ? 'Voice on, tap to mute' : 'Voice off, tap to unmute'}
              accessibilityRole="button"
            >
              <Ionicons
                name={voiceEnabled ? 'volume-high' : 'volume-mute'}
                size={28}
                color={voiceEnabled ? '#fff' : '#ff6b6b'}
              />
            </TouchableOpacity>
          </View>
          
          {/* Connection Status Indicator */}
          {!backendConnected && (
            <View style={styles.connectionWarning}>
              <Ionicons name="cloud-offline" size={16} color="#ff6b6b" />
              <Text style={styles.connectionWarningText}>Backend Disconnected</Text>
            </View>
          )}
        </LinearGradient>

        {/* Range Selector - Shows on first load */}
        {showRangeSelector && !isNavigating && (
          <BlurView intensity={90} style={styles.rangeSelectorCard}>
            <View style={styles.rangeSelectorHeader}>
              <Ionicons name="eye-outline" size={24} color="#667eea" />
              <Text style={styles.rangeSelectorTitle}>Detection Range</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowRangeSelector(false);
                  Speech.speak('Range selector hidden', { language: 'en', pitch: 1.0, rate: 0.9 });
                }}
                style={styles.rangeCloseBtn}
              >
                <Ionicons name="close" size={20} color="#7f8c8d" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.rangeSelectorSubtitle}>Select detection distance</Text>
            
            <View style={styles.rangeOptions}>
              <TouchableOpacity
                style={[styles.rangeOption, detectionRange === 'short' && styles.rangeOptionSelected]}
                onPress={() => {
                  setDetectionRange('short');
                  Speech.speak('Short range selected. Only nearby objects will be detected.', {
                    language: 'en',
                    pitch: 1.0,
                    rate: 0.9,
                  });
                  accessibilityService.triggerHaptic('success');
                }}
              >
                <Ionicons 
                  name="locate" 
                  size={28} 
                  color={detectionRange === 'short' ? '#fff' : '#667eea'} 
                />
                <Text style={[styles.rangeOptionText, detectionRange === 'short' && styles.rangeOptionTextSelected]}>
                  Short
                </Text>
                <Text style={[styles.rangeOptionDesc, detectionRange === 'short' && styles.rangeOptionDescSelected]}>
                  Near only
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rangeOption, detectionRange === 'medium' && styles.rangeOptionSelected]}
                onPress={() => {
                  setDetectionRange('medium');
                  Speech.speak('Medium range selected. Nearby and moderate distance objects will be detected.', {
                    language: 'en',
                    pitch: 1.0,
                    rate: 0.9,
                  });
                  accessibilityService.triggerHaptic('success');
                }}
              >
                <Ionicons 
                  name="radio-button-on" 
                  size={28} 
                  color={detectionRange === 'medium' ? '#fff' : '#50c878'} 
                />
                <Text style={[styles.rangeOptionText, detectionRange === 'medium' && styles.rangeOptionTextSelected]}>
                  Medium
                </Text>
                <Text style={[styles.rangeOptionDesc, detectionRange === 'medium' && styles.rangeOptionDescSelected]}>
                  Balanced
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rangeOption, detectionRange === 'all' && styles.rangeOptionSelected]}
                onPress={() => {
                  setDetectionRange('all');
                  Speech.speak('All range selected. All objects in view will be detected.', {
                    language: 'en',
                    pitch: 1.0,
                    rate: 0.9,
                  });
                  accessibilityService.triggerHaptic('success');
                }}
              >
                <Ionicons 
                  name="scan" 
                  size={28} 
                  color={detectionRange === 'all' ? '#fff' : '#f5576c'} 
                />
                <Text style={[styles.rangeOptionText, detectionRange === 'all' && styles.rangeOptionTextSelected]}>
                  All
                </Text>
                <Text style={[styles.rangeOptionDesc, detectionRange === 'all' && styles.rangeOptionDescSelected]}>
                  Full view
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        )}

        {/* Range Toggle Button - Mini button when hidden */}
        {!showRangeSelector && !isNavigating && (
          <TouchableOpacity
            style={styles.rangeToggleBtn}
            onPress={() => setShowRangeSelector(true)}
          >
            <BlurView intensity={80} style={styles.rangeToggleContent}>
              <Ionicons name="eye" size={20} color="#667eea" />
              <Text style={styles.rangeToggleText}>
                {detectionRange === 'short' ? 'Near' : detectionRange === 'medium' ? 'Medium' : 'All'}
              </Text>
            </BlurView>
          </TouchableOpacity>
        )}

        {/* Detection Stats Card */}
        {detections.length > 0 && (
          <BlurView intensity={80} style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="scan-outline" size={24} color="#667eea" />
                <Text style={styles.statValue}>{stats.totalDetections}</Text>
                <Text style={styles.statLabel}>Objects</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="speedometer-outline" size={24} color="#50c878" />
                <Text style={styles.statValue}>
                  {(stats.avgConfidence * 100).toFixed(0)}%
                </Text>
                <Text style={styles.statLabel}>Confidence</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={24} color="#FFB74D" />
                <Text style={styles.statValue}>
                  {stats.faces}
                </Text>
                <Text style={styles.statLabel}>Faces</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="albums-outline" size={24} color="#f5576c" />
                <Text style={styles.statValue}>
                  {Object.keys(stats.categories).length}
                </Text>
                <Text style={styles.statLabel}>Categories</Text>
              </View>
            </View>
          </BlurView>
        )}

        {/* Detection List */}
        {detections.length > 0 && (
          <View style={styles.detectionList}>
            {detections.slice(0, 5).map((det, index) => (
              <BlurView key={index} intensity={70} style={styles.detectionItem}>
                <View style={[
                  styles.detectionIndicator,
                  det.type === 'face' && styles.faceIndicator
                ]} />
                <Ionicons 
                  name={det.type === 'face' ? 'person-circle-outline' : 'cube-outline'} 
                  size={16} 
                  color={det.type === 'face' ? '#FFB74D' : '#667eea'} 
                  style={styles.detectionIcon}
                />
                <Text style={styles.detectionLabel}>{det.label}</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {(det.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              </BlurView>
            ))}
            {detections.length > 5 && (
              <BlurView intensity={70} style={styles.moreIndicator}>
                <Text style={styles.moreText}>
                  +{detections.length - 5} more detections
                </Text>
              </BlurView>
            )}
          </View>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingBadge}>
            <View style={styles.processingDot} />
            <Text style={styles.processingText}>Scanning...</Text>
          </View>
        )}

        {/* Bottom Gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.bottomGradient}
        >
          {/* Navigation Controls */}
          {isNavigating ? (
            <BlurView intensity={90} style={styles.navControls}>
              <View style={styles.navHeader}>
                <View style={styles.navProgress}>
                  <Text style={styles.navStepText}>
                    Step {currentStep + 1} of {currentRoute.length}
                  </Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${((currentStep + 1) / currentRoute.length) * 100}%` }]} />
                  </View>
                </View>
                <TouchableOpacity onPress={stopNavigation} style={styles.navStopBtn}>
                  <Ionicons name="close-circle" size={28} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
              
              {/* Current waypoint info */}
              <View style={styles.waypointCard}>
                <View style={styles.waypointHeader}>
                  <Ionicons name="location" size={24} color="#667eea" />
                  <Text style={styles.waypointTitle}>
                    {currentRoute[currentStep]?.room_label?.replace(/_/g, ' ').toUpperCase() || 'Current Location'}
                  </Text>
                </View>
                
                {/* Step count and direction */}
                {(currentRoute[currentStep] as any)?.steps && (
                  <View style={styles.stepInfoRow}>
                    <View style={styles.stepBadge}>
                      <Ionicons name="footsteps" size={18} color="#667eea" />
                      <Text style={styles.stepCount}>
                        {(currentRoute[currentStep] as any).steps} steps
                      </Text>
                    </View>
                    <View style={styles.directionBadge}>
                      <Ionicons 
                        name={
                          (currentRoute[currentStep] as any).direction === 'right' ? 'arrow-forward' :
                          (currentRoute[currentStep] as any).direction === 'left' ? 'arrow-back' :
                          (currentRoute[currentStep] as any).direction === 'up' ? 'arrow-up' :
                          'arrow-down'
                        } 
                        size={18} 
                        color="#50c878" 
                      />
                      <Text style={styles.directionText}>
                        {(currentRoute[currentStep] as any).turn_instruction || 'go straight'}
                      </Text>
                    </View>
                  </View>
                )}
                
                <Text style={styles.navInstruction}>{currentInstruction}</Text>
              </View>
              
              <View style={styles.navButtonRow}>
                <TouchableOpacity 
                  style={styles.repeatBtn} 
                  onPress={() => {
                    const waypoint = currentRoute[currentStep];
                    const stepInfo = (waypoint as any).steps ? `Walk ${(waypoint as any).steps} steps` : '';
                    const turnInfo = (waypoint as any).turn_instruction || '';
                    const fullInstruction = stepInfo ? `${stepInfo} and ${turnInfo}. ${currentInstruction}` : currentInstruction;
                    Speech.speak(fullInstruction, { language: 'en', pitch: 1.0, rate: 0.85 });
                    accessibilityService.triggerHaptic('buttonPress');
                  }}
                >
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.repeatGradient}>
                    <Ionicons name="volume-high" size={20} color="#fff" />
                    <Text style={styles.repeatText}>Repeat</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.navNextBtn} onPress={nextStep}>
                  <LinearGradient colors={['#50c878', '#48b56a']} style={styles.navNextGradient}>
                    <Text style={styles.navNextText}>
                      {currentStep < currentRoute.length - 1 ? 'Completed - Next' : 'Arrive'}
                    </Text>
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </BlurView>
          ) : (
            <>
              {lastAnnouncement && (
                <BlurView intensity={80} style={styles.announcementBox}>
                  <Ionicons name="volume-medium-outline" size={20} color="#fff" />
                  <Text style={styles.announcementText} numberOfLines={2}>
                    {lastAnnouncement}
                  </Text>
                </BlurView>
              )}
              
              <TouchableOpacity 
                style={styles.navButton} 
                onPress={() => setShowNavSetup(true)}
              >
                <BlurView intensity={80} style={styles.navButtonContent}>
                  <Ionicons name="navigate" size={24} color="#667eea" />
                  <Text style={styles.navButtonText}>Start Navigation</Text>
                </BlurView>
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>

        {/* Navigation Setup Modal */}
        {showNavSetup && (
          <View style={styles.modalOverlay}>
            <BlurView intensity={90} style={styles.navSetupModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Indoor Navigation</Text>
                <TouchableOpacity onPress={() => setShowNavSetup(false)}>
                  <Ionicons name="close" size={28} color="#2c3e50" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Select Map</Text>
              {availableMaps.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="map-outline" size={32} color="#7f8c8d" />
                  <Text style={styles.emptyStateText}>No maps available. Upload and process a map first.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mapScroll}>
                  {availableMaps.map((map) => (
                    <TouchableOpacity
                      key={map.map_id}
                      style={[styles.mapCard, selectedMap?.map_id === map.map_id && styles.mapCardSelected]}
                      onPress={() => {
                        setSelectedMap(map);
                        const rooms = extractRoomsFromMap(map);
                        setAvailableRooms(rooms);
                        setSourceRoom('');
                        setDestinationRoom('');
                        if (rooms.length === 0) {
                          Alert.alert('No Rooms', 'This map has no room labels. Please process it first.');
                        }
                      }}
                    >
                      <Ionicons name="map" size={24} color={selectedMap?.map_id === map.map_id ? '#667eea' : '#7f8c8d'} />
                      <Text style={[styles.mapCardText, selectedMap?.map_id === map.map_id && styles.mapCardTextSelected]}>
                        {map.map_name || 'Unnamed Map'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {selectedMap && (
                <>
                  <Text style={styles.modalSubtitle}>From</Text>
                  {availableRooms.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="business-outline" size={24} color="#7f8c8d" />
                      <Text style={styles.emptyStateText}>No rooms found in this map</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroll}>
                      {availableRooms.map((room) => (
                        <TouchableOpacity
                          key={`source-${room}`}
                          style={[styles.roomChip, sourceRoom === room && styles.roomChipSelected]}
                          onPress={() => setSourceRoom(room)}
                        >
                          <Text style={[styles.roomChipText, sourceRoom === room && styles.roomChipTextSelected]}>
                            {room}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  <Text style={styles.modalSubtitle}>To</Text>
                  {availableRooms.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="location-outline" size={24} color="#7f8c8d" />
                      <Text style={styles.emptyStateText}>No rooms found in this map</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroll}>
                      {availableRooms.filter(r => r !== sourceRoom).map((room) => (
                        <TouchableOpacity
                          key={`dest-${room}`}
                          style={[styles.roomChip, destinationRoom === room && styles.roomChipSelected]}
                          onPress={() => setDestinationRoom(room)}
                        >
                          <Text style={[styles.roomChipText, destinationRoom === room && styles.roomChipTextSelected]}>
                            {room}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}

              {sourceRoom && destinationRoom && (
                <TouchableOpacity style={styles.startNavBtn} onPress={startNavigation}>
                  <LinearGradient colors={['#50c878', '#48b56a']} style={styles.startNavGradient}>
                    <Ionicons name="navigate" size={20} color="#fff" />
                    <Text style={styles.startNavText}>Start Navigation</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </BlurView>
          </View>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f7fa',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonMuted: {
    backgroundColor: 'rgba(255,107,107,0.3)',
  },
  connectionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginTop: 8,
    gap: 6,
  },
  connectionWarningText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statsCard: {
    position: 'absolute',
    top: 130,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
  },
  detectionList: {
    position: 'absolute',
    top: 230,
    left: 20,
    right: 20,
  },
  detectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  detectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#50c878',
    marginRight: 12,
  },
  faceIndicator: {
    backgroundColor: '#FFB74D',
  },
  detectionIcon: {
    marginRight: 8,
  },
  detectionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  confidenceBadge: {
    backgroundColor: 'rgba(102,126,234,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  moreIndicator: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  moreText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  processingBadge: {
    position: 'absolute',
    top: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  processingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  processingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    justifyContent: 'flex-end',
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  announcementBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  announcementText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    marginLeft: 12,
    lineHeight: 20,
  },
  navButton: {
    marginTop: 12,
  },
  navButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 8,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  navControls: {
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navProgress: {
    flex: 1,
    marginRight: 12,
  },
  navStepText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#50c878',
    borderRadius: 2,
  },
  navStopBtn: {
    padding: 4,
  },
  navInstruction: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2c3e50',
    lineHeight: 22,
  },
  navNextBtn: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  navNextGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  navNextText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  navSetupModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: height * 0.7,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    marginTop: 16,
    marginBottom: 8,
  },
  mapScroll: {
    marginBottom: 8,
  },
  mapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
    gap: 8,
  },
  mapCardSelected: {
    backgroundColor: '#e8f0fe',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  mapCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  mapCardTextSelected: {
    color: '#667eea',
  },
  roomScroll: {
    marginBottom: 8,
  },
  roomChip: {
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  roomChipSelected: {
    backgroundColor: '#667eea',
  },
  roomChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  roomChipTextSelected: {
    color: '#fff',
  },
  startNavBtn: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  startNavGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  startNavText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  waypointCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    gap: 12,
  },
  waypointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  waypointTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1,
  },
  stepInfoRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  stepCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  directionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#50c878',
    textTransform: 'capitalize',
  },
  navButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  repeatBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  repeatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  repeatText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  rangeSelectorCard: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  rangeSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rangeSelectorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 10,
    flex: 1,
  },
  rangeCloseBtn: {
    padding: 4,
  },
  rangeSelectorSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  rangeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  rangeOption: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rangeOptionSelected: {
    backgroundColor: '#667eea',
    borderColor: '#764ba2',
  },
  rangeOptionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
  },
  rangeOptionTextSelected: {
    color: '#fff',
  },
  rangeOptionDesc: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  rangeOptionDescSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  rangeToggleBtn: {
    position: 'absolute',
    top: 80,
    right: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  rangeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  rangeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
});

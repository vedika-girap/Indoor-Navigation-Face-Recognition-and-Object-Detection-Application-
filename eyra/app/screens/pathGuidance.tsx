import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  StatusBar,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { BlurView } from 'expo-blur';
import * as Speech from 'expo-speech';

import { API_ENDPOINTS } from '../config/api';
import { DEMO_USER_ID } from '../constants/user';

const { width, height } = Dimensions.get('window');

interface Detection {
  label: string;
  confidence: number;
  bbox: number[];
  type?: 'object' | 'face';
}

interface ObstacleZone {
  position: 'left' | 'center' | 'right';
  distance: 'near' | 'medium' | 'far';
  objects: string[];
  danger: 'high' | 'medium' | 'low';
}

export default function PathGuidanceScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);
  const canvasRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  
  // Detection state
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isActive, setIsActive] = useState(false);
  
  // Path guidance state
  const [obstacleZones, setObstacleZones] = useState<ObstacleZone[]>([]);
  const [pathClear, setPathClear] = useState(true);
  const [currentDirection, setCurrentDirection] = useState<'forward' | 'left' | 'right' | 'stop'>('forward');
  const [lastAlert, setLastAlert] = useState<string>('');
  const [detectionCount, setDetectionCount] = useState(0);
  
  // Performance tracking
  const frameIntervalRef = useRef<any>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const announcedObstaclesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (permission?.granted) {
      Speech.speak('Path guidance screen. Starting obstacle detection. Voice alerts enabled.');
      // Auto-start guidance when camera is ready
      setTimeout(() => {
        setIsActive(true);
      }, 1000);
    }
    
    return () => {
      cleanup();
      Speech.stop();
    };
  }, [permission?.granted]);

  useEffect(() => {
    if (isActive && permission?.granted) {
      Speech.speak('Path guidance activated. Scanning for obstacles.');
      startContinuousDetection();
    } else {
      cleanup();
    }
  }, [isActive, permission?.granted]);

  const cleanup = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
  };

  const startContinuousDetection = () => {
    // Capture at 1.5 second intervals for responsive path guidance
    const interval = 1500;
    
    frameIntervalRef.current = setInterval(() => {
      if (!isProcessing) {
        captureAndDetect();
      }
    }, interval);
  };

  const captureAndDetect = async () => {
    if (!cameraRef.current || isProcessing) return;

    if (!permission?.granted) {
      return;
    }

    setIsProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
        skipProcessing: true,
      });

      if (!photo || !photo.uri) return;

      // Resize image for faster processing
      const resized = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.7, format: SaveFormat.JPEG }
      );

      const formData = new FormData();
      formData.append('file', {
        uri: resized.uri,
        type: 'image/jpeg',
        name: 'frame.jpg',
      } as any);

      formData.append('user_id', DEMO_USER_ID);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for face recognition

      const response = await fetch(API_ENDPOINTS.combinedDetection, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Detection failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Process only object detections for path guidance
      const objectDetections = result.detections || [];
      const detectionsList = objectDetections.map((d: any) => ({
        label: d.label,
        confidence: d.confidence,
        bbox: d.bbox,
        type: 'object' as const,
      }));

      // Analyze depth map for unidentified obstacles
      const depthObstacles = await analyzeDepthProximity(resized.uri);
      const combinedDetections = [...detectionsList, ...depthObstacles];

      processPathDetections(combinedDetections);
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[PATH] Detection timeout - face recognition may be slow');
        // Continue operation, don't show error to user
      } else {
        console.error('[PATH] Detection error:', error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeDepthProximity = async (imageUri: string): Promise<Detection[]> => {
    try {
      // Reduce image size for faster processing
      const processed = await manipulateAsync(
        imageUri,
        [{ resize: { width: 160, height: 120 } }],
        { compress: 0.5, format: SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(processed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Simple grid analysis for proximity
      // Bottom third of frame is most important for navigation
      const depthDetections: Detection[] = [];
      
      // Analyze bottom grid zones (simulate depth by position)
      const bottomZones = [
        { x: 0, y: 0.6, w: 0.33, h: 0.4, zone: 'left' },
        { x: 0.33, y: 0.6, w: 0.34, h: 0.4, zone: 'center' },
        { x: 0.67, y: 0.6, w: 0.33, h: 0.4, zone: 'right' },
      ];

      bottomZones.forEach((zone, idx) => {
        // Objects in bottom 40% are considered close
        // Create proximity detection for each zone
        const bbox = [
          zone.x * width,
          zone.y * height,
          (zone.x + zone.w) * width,
          (zone.y + zone.h) * height,
        ];

        depthDetections.push({
          label: 'proximity-obstacle',
          confidence: 0.85,
          bbox,
          type: 'object',
        });
      });

      return depthDetections;
    } catch (error) {
      console.log('[DEPTH] Proximity analysis failed:', error);
      return [];
    }
  };

  const processPathDetections = useCallback((newDetections: Detection[]) => {
    setDetections(newDetections);
    setDetectionCount(prev => prev + 1);
    
    // Analyze obstacles in different zones
    const zones = analyzeObstacleZones(newDetections);
    setObstacleZones(zones);
    
    // Determine path safety
    const hasDanger = zones.some(z => z.danger === 'high');
    setPathClear(!hasDanger);
    
    // Calculate best direction
    const direction = calculateDirection(zones);
    setCurrentDirection(direction);
    
    // Provide voice guidance
    announcePathGuidance(zones, direction);
    
    // Draw path visualization
    drawPathVisualization(newDetections, zones);
  }, []);

  const analyzeObstacleZones = (detections: Detection[]): ObstacleZone[] => {
    const zones: ObstacleZone[] = [];
    
    // Divide camera view into 3 zones: left, center, right
    const leftObjects: { label: string; danger: 'high' | 'medium' | 'low' }[] = [];
    const centerObjects: { label: string; danger: 'high' | 'medium' | 'low' }[] = [];
    const rightObjects: { label: string; danger: 'high' | 'medium' | 'low' }[] = [];
    
    detections.forEach((det) => {
      if (!det.bbox || det.bbox.length < 4) return;
      
      const [x1, y1, x2, y2] = det.bbox;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const objectWidth = x2 - x1;
      const objectHeight = y2 - y1;
      const objectArea = objectWidth * objectHeight;
      const screenArea = width * height;
      
      // Calculate relative size (percentage of screen)
      const relativeSize = objectArea / screenArea;
      
      // Bottom position indicates closer objects (perspective)
      const bottomY = y2;
      const bottomRatio = bottomY / height;
      
      // Improved distance estimation
      // Proximity obstacles are always considered close
      // Objects in bottom 40% with >8% screen area = NEAR
      // Objects in bottom 70% with >4% screen area = MEDIUM
      // Everything else = FAR
      let distance: 'near' | 'medium' | 'far';
      let danger: 'high' | 'medium' | 'low';
      
      if (det.label === 'proximity-obstacle') {
        // Proximity detection = obstacle very close
        distance = 'near';
        danger = 'high';
      } else if (bottomRatio > 0.6 && relativeSize > 0.08) {
        distance = 'near';
        danger = 'high';
      } else if (bottomRatio > 0.4 && relativeSize > 0.04) {
        distance = 'medium';
        danger = 'medium';
      } else {
        distance = 'far';
        danger = 'low';
      }
      
      // Center zone obstacles are more dangerous
      const isCenter = centerX >= width * 0.35 && centerX <= width * 0.65;
      if (isCenter && danger === 'medium') {
        danger = 'high';
      }
      
      // Determine zone (left, center, right)
      if (centerX < width * 0.35) {
        leftObjects.push({ label: det.label, danger });
      } else if (centerX > width * 0.65) {
        rightObjects.push({ label: det.label, danger });
      } else {
        centerObjects.push({ label: det.label, danger });
      }
    });
    
    // Create zone objects based on highest danger in each zone
    if (leftObjects.length > 0) {
      const maxDanger = leftObjects.some(o => o.danger === 'high') ? 'high' : 
                        leftObjects.some(o => o.danger === 'medium') ? 'medium' : 'low';
      zones.push({
        position: 'left',
        distance: maxDanger === 'high' ? 'near' : maxDanger === 'medium' ? 'medium' : 'far',
        objects: leftObjects.map(o => o.label),
        danger: maxDanger,
      });
    }
    
    if (centerObjects.length > 0) {
      const maxDanger = centerObjects.some(o => o.danger === 'high') ? 'high' : 
                        centerObjects.some(o => o.danger === 'medium') ? 'medium' : 'low';
      zones.push({
        position: 'center',
        distance: maxDanger === 'high' ? 'near' : maxDanger === 'medium' ? 'medium' : 'far',
        objects: centerObjects.map(o => o.label),
        danger: maxDanger,
      });
    }
    
    if (rightObjects.length > 0) {
      const maxDanger = rightObjects.some(o => o.danger === 'high') ? 'high' : 
                        rightObjects.some(o => o.danger === 'medium') ? 'medium' : 'low';
      zones.push({
        position: 'right',
        distance: maxDanger === 'high' ? 'near' : maxDanger === 'medium' ? 'medium' : 'far',
        objects: rightObjects.map(o => o.label),
        danger: maxDanger,
      });
    }
    
    return zones;
  };

  const calculateDirection = (zones: ObstacleZone[]): 'forward' | 'left' | 'right' | 'stop' => {
    const centerZone = zones.find(z => z.position === 'center');
    const leftZone = zones.find(z => z.position === 'left');
    const rightZone = zones.find(z => z.position === 'right');
    
    // All zones blocked at high danger = STOP
    if (centerZone?.danger === 'high' && leftZone?.danger === 'high' && rightZone?.danger === 'high') {
      return 'stop';
    }
    
    // Center has high danger, find safest alternative
    if (centerZone?.danger === 'high') {
      const leftDanger = leftZone?.danger || 'low';
      const rightDanger = rightZone?.danger || 'low';
      
      // Both sides clear, prefer right (standard convention)
      if (leftDanger === 'low' && rightDanger === 'low') {
        return 'right';
      }
      
      // One side safer
      if (leftDanger === 'low') {
        return 'left';
      } else if (rightDanger === 'low') {
        return 'right';
      }
      
      // Both sides medium, choose one with fewer objects
      if (leftDanger === 'medium' && rightDanger === 'medium') {
        const leftCount = leftZone?.objects.length || 0;
        const rightCount = rightZone?.objects.length || 0;
        return leftCount <= rightCount ? 'left' : 'right';
      }
      
      // One side has medium danger
      if (leftDanger === 'medium') {
        return 'left';
      } else if (rightDanger === 'medium') {
        return 'right';
      }
      
      // Shouldn't reach here, but default to stop
      return 'stop';
    }
    
    // Center clear or medium danger, proceed forward
    return 'forward';
  };

  const announcePathGuidance = (zones: ObstacleZone[], direction: 'forward' | 'left' | 'right' | 'stop') => {
    if (!voiceEnabled) return;
    
    const now = Date.now();
    
    // Progressive rate limiting based on danger
    const highDanger = zones.some(z => z.danger === 'high');
    const minInterval = highDanger ? 2000 : 4000; // 2s for high danger, 4s for others
    
    if (now - lastAlertTimeRef.current < minInterval) return;
    
    let announcement = '';
    let vibrationPattern: number[] = [];
    
    // Priority 1: Center zone high danger (immediate threat)
    const centerZone = zones.find(z => z.position === 'center');
    if (centerZone?.danger === 'high') {
      const obstacleLabel = centerZone.objects[0];
      const obstacle = obstacleLabel === 'proximity-obstacle' ? 'obstacle' : obstacleLabel;
      const distance = centerZone.distance === 'near' ? 'very close' : 'ahead';
      announcement = `Danger! ${obstacle} ${distance}. `;
      vibrationPattern = [200, 100, 200, 100, 200];
    }
    
    // Priority 2: Side zones high danger
    else {
      const highDangerZones = zones.filter(z => z.danger === 'high');
      if (highDangerZones.length > 0) {
        const zone = highDangerZones[0];
        const obstacleLabel = zone.objects[0];
        const obstacle = obstacleLabel === 'proximity-obstacle' ? 'obstacle' : obstacleLabel;
        announcement = `Warning! ${obstacle} on your ${zone.position}. `;
        vibrationPattern = [150, 100, 150];
      }
    }
    
    // Priority 3: Medium danger
    if (!announcement) {
      const mediumDangerZones = zones.filter(z => z.danger === 'medium');
      if (mediumDangerZones.length > 0) {
        const zone = mediumDangerZones[0];
        const obstacleLabel = zone.objects[0];
        const obstacle = obstacleLabel === 'proximity-obstacle' ? 'obstacle' : obstacleLabel;
        announcement = `Caution. ${obstacle} on your ${zone.position}. `;
        vibrationPattern = [100];
      }
    }
    
    // Add direction guidance
    if (direction === 'stop') {
      announcement += 'Stop immediately. Path completely blocked.';
      vibrationPattern = [300, 100, 300, 100, 300];
    } else if (direction === 'left') {
      announcement += 'Move left.';
      vibrationPattern = vibrationPattern.length > 0 ? vibrationPattern : [100, 50, 100];
    } else if (direction === 'right') {
      announcement += 'Move right.';
      vibrationPattern = vibrationPattern.length > 0 ? vibrationPattern : [100, 50, 100];
    } else if (direction === 'forward') {
      if (zones.length === 0) {
        announcement = 'Path clear. Safe to proceed.';
      } else if (!announcement) {
        announcement = 'Continue forward with caution.';
      } else {
        announcement += 'Proceed slowly.';
      }
    }
    
    if (announcement) {
      console.log('[VOICE] Speaking:', announcement);
      Speech.speak(announcement, { rate: 0.9, pitch: 1.0 });
      setLastAlert(announcement);
      lastAlertTimeRef.current = now;
      
      if (vibrationPattern.length > 0) {
        console.log('[HAPTIC] Vibrating with pattern:', vibrationPattern);
        Vibration.vibrate(vibrationPattern);
      }
    } else {
      console.log('[VOICE] No announcement - zones:', zones.length, 'direction:', direction);
    }
  };

  const drawPathVisualization = (detections: Detection[], zones: ObstacleZone[]) => {
    // Visual indicators are handled by zone components
    // Future enhancement: Could add AR-style overlay with bounding boxes
  };

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    if (newState) {
      Speech.speak('Voice guidance enabled. You will hear obstacle alerts.', { rate: 0.9 });
    } else {
      Speech.speak('Voice guidance disabled', { rate: 0.9 });
    }
  };

  const toggleActive = () => {
    const newState = !isActive;
    setIsActive(newState);
    if (newState) {
      Speech.speak('Path guidance resumed. Scanning for obstacles.', { rate: 0.9 });
    } else {
      Speech.speak('Path guidance paused.', { rate: 0.9 });
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#fff" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Path guidance needs camera access to detect obstacles and guide you safely.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        {/* Header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent']}
          style={styles.header}
        >
          <TouchableOpacity
            onPress={() => {
              cleanup();
              Speech.speak('Returning to menu');
              router.back();
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Path Guidance</Text>
          
          <TouchableOpacity onPress={toggleVoice} style={styles.voiceButton}>
            <Ionicons
              name={voiceEnabled ? 'volume-high' : 'volume-mute'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </LinearGradient>

        {/* Zone Indicators */}
        <View style={styles.zoneIndicators}>
          {/* Left Zone */}
          <View style={[
            styles.zoneIndicator,
            obstacleZones.find(z => z.position === 'left')?.danger === 'high' && styles.zoneHigh,
            obstacleZones.find(z => z.position === 'left')?.danger === 'medium' && styles.zoneMedium,
          ]}>
            <Text style={styles.zoneText}>LEFT</Text>
          </View>
          
          {/* Center Zone */}
          <View style={[
            styles.zoneIndicator,
            styles.centerZone,
            obstacleZones.find(z => z.position === 'center')?.danger === 'high' && styles.zoneHigh,
            obstacleZones.find(z => z.position === 'center')?.danger === 'medium' && styles.zoneMedium,
          ]}>
            <Text style={styles.zoneText}>CENTER</Text>
          </View>
          
          {/* Right Zone */}
          <View style={[
            styles.zoneIndicator,
            obstacleZones.find(z => z.position === 'right')?.danger === 'high' && styles.zoneHigh,
            obstacleZones.find(z => z.position === 'right')?.danger === 'medium' && styles.zoneMedium,
          ]}>
            <Text style={styles.zoneText}>RIGHT</Text>
          </View>
        </View>

        {/* Path Status */}
        <BlurView intensity={80} tint="dark" style={styles.pathStatusCard}>
          <Ionicons
            name={pathClear ? 'checkmark-circle' : 'warning'}
            size={32}
            color={pathClear ? '#50c878' : '#ff6b6b'}
          />
          <View>
            <Text style={styles.pathStatusText}>
              {pathClear ? 'Path Clear' : 'Obstacles Detected'}
            </Text>
            <Text style={styles.detectionCountText}>
              Scans: {detectionCount}
            </Text>
          </View>
        </BlurView>

        {/* Direction Indicator */}
        <View style={styles.directionContainer}>
          <LinearGradient
            colors={
              currentDirection === 'stop'
                ? ['#ff6b6b', '#ee5a6f']
                : currentDirection === 'forward'
                ? ['#50c878', '#48b56a']
                : ['#f093fb', '#f5576c']
            }
            style={styles.directionIndicator}
          >
            <Ionicons
              name={
                currentDirection === 'stop'
                  ? 'hand-left'
                  : currentDirection === 'forward'
                  ? 'arrow-up'
                  : currentDirection === 'left'
                  ? 'arrow-back'
                  : 'arrow-forward'
              }
              size={48}
              color="#fff"
            />
            <Text style={styles.directionText}>
              {currentDirection === 'stop'
                ? 'STOP'
                : currentDirection === 'forward'
                ? 'FORWARD'
                : currentDirection === 'left'
                ? 'TURN LEFT'
                : 'TURN RIGHT'}
            </Text>
          </LinearGradient>
        </View>

        {/* Obstacle List */}
        {obstacleZones.length > 0 && (
          <BlurView intensity={70} tint="dark" style={styles.obstacleList}>
            <Text style={styles.obstacleTitle}>Detected Obstacles</Text>
            {obstacleZones.map((zone, index) => (
              <View key={index} style={styles.obstacleZone}>
                <View style={styles.obstacleHeader}>
                  <Text style={styles.obstaclePosition}>{zone.position.toUpperCase()}</Text>
                  <View style={[
                    styles.dangerBadge,
                    zone.danger === 'high' && styles.dangerHigh,
                    zone.danger === 'medium' && styles.dangerMedium,
                  ]}>
                    <Text style={styles.dangerText}>{zone.danger}</Text>
                  </View>
                </View>
                <Text style={styles.obstacleObjects}>
                  {zone.objects.slice(0, 3).join(', ')}
                </Text>
              </View>
            ))}
          </BlurView>
        )}

        {/* Last Alert */}
        {lastAlert && (
          <BlurView intensity={80} tint="dark" style={styles.alertBox}>
            <Ionicons name="megaphone" size={20} color="#f093fb" />
            <Text style={styles.alertText}>{lastAlert}</Text>
          </BlurView>
        )}

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            onPress={toggleActive}
            style={styles.activateButton}
          >
            <LinearGradient
              colors={isActive ? ['#ff6b6b', '#ee5a6f'] : ['#50c878', '#48b56a']}
              style={styles.activateGradient}
            >
              <Ionicons
                name={isActive ? 'pause' : 'play'}
                size={24}
                color="#fff"
              />
              <Text style={styles.activateText}>
                {isActive ? 'Pause Guidance' : 'Start Guidance'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
    padding: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  permissionButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 30,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  voiceButton: {
    padding: 8,
  },
  zoneIndicators: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    gap: 8,
  },
  zoneIndicator: {
    flex: 1,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  centerZone: {
    flex: 1.2,
  },
  zoneHigh: {
    backgroundColor: 'rgba(255, 107, 107, 0.4)',
    borderColor: '#ff6b6b',
  },
  zoneMedium: {
    backgroundColor: 'rgba(255, 193, 7, 0.4)',
    borderColor: '#ffc107',
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  pathStatusCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 200 : 180,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  pathStatusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  detectionCountText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  directionContainer: {
    position: 'absolute',
    bottom: 200,
    alignSelf: 'center',
  },
  directionIndicator: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  directionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  obstacleList: {
    position: 'absolute',
    bottom: 340,
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 16,
    maxHeight: 200,
    overflow: 'hidden',
  },
  obstacleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  obstacleZone: {
    marginBottom: 12,
  },
  obstacleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  obstaclePosition: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f093fb',
  },
  dangerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dangerHigh: {
    backgroundColor: 'rgba(255, 107, 107, 0.8)',
  },
  dangerMedium: {
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
  },
  dangerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  obstacleObjects: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  alertBox: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 260 : 240,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  activateButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  activateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  activateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});

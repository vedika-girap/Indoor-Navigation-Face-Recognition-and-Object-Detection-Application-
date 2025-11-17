import { useRouter } from 'expo-router';
import {
  CameraCapturedPicture,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import Constants from "expo-constants";
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from "react-native";
import { DEMO_USER_ID } from '../constants/user';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { colors } from '../theme';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { listFloorMaps, type FloorMap } from '../services/floorMapService';
import verbosityManager from '../services/verbosityManager';
import actionHistoryManager from '../services/actionHistoryManager';
import offlineManager from '../services/offlineManager';
import errorRecoveryService from '../services/errorRecoveryService';
import accessibilityService from '../services/accessibilityService';

export default function NormalModeScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [faces, setFaces] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceNames, setFaceNames] = useState<string[]>([]);
  const [savingFaces, setSavingFaces] = useState<boolean[]>([]);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastFrameMs, setLastFrameMs] = useState<number | null>(null);
  const lastAnnouncementRef = useRef<number>(0);
  const lastAnnouncedTextRef = useRef<string>('');
  const prevUnknownCountRef = useRef<number>(0);
  const prevObjectsRef = useRef<string[]>([]);
  const prevRecognizedFacesRef = useRef<string[]>([]);
  const announcedObjectsTimeRef = useRef<Map<string, number>>(new Map()); // Track when each object was last announced
  
  // Navigation mode state
  const [navigationMode, setNavigationMode] = useState(false);
  const [selectedMap, setSelectedMap] = useState<FloorMap | null>(null);
  const [sourceRoom, setSourceRoom] = useState<string>('');
  const [destinationRoom, setDestinationRoom] = useState<string>('');
  const [currentPosition, setCurrentPosition] = useState<any>(null);
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [availableMaps, setAvailableMaps] = useState<FloorMap[]>([]);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [plannedRoute, setPlannedRoute] = useState<any>(null);
  const [currentRouteStep, setCurrentRouteStep] = useState<number>(0);
  const [lastUsedRoute, setLastUsedRoute] = useState<{map: FloorMap, source: string, destination: string} | null>(null);
  const [batterySaverMode, setBatterySaverMode] = useState<boolean>(false);
  const [lastDistanceAnnouncement, setLastDistanceAnnouncement] = useState<number>(0);
  const announcedNavWaypointsRef = useRef<Set<string>>(new Set());
  const navigationStartTimeRef = useRef<number | null>(null);
  const lastObstacleWarningRef = useRef<number>(0);
  
  // Speech management (Iteration 2)
  const [speechQueue, setSpeechQueue] = useState<Array<{text: string, priority: number}>>([]);
  const [lastAnnouncement, setLastAnnouncement] = useState<string>('');
  const [detectionsPaused, setDetectionsPaused] = useState(false);
  const isSpeakingRef = useRef(false);
  const speechQueueRef = useRef<Array<{text: string, priority: number}>>([]);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    // Load available maps for navigation
    loadAvailableMaps();
    
    // Add breadcrumb
    actionHistoryManager.addBreadcrumb('detection', 'Object Detection Mode');
    
    // Announce screen capabilities with more detail
    accessibilityService.speak('Camera detection mode activated. Point your camera at objects, people, or places. I will announce everything I detect. Tap the top left to toggle voice. Tap the navigation button to enable indoor navigation with turn by turn directions and obstacle warnings.', 2, false);
    
    // Cleanup: Stop speech when leaving screen
    return () => {
      accessibilityService.stop();
    };
  }, []);

  const loadAvailableMaps = async () => {
    try {
      // Try with cache fallback
      const cacheKey = `maps_${DEMO_USER_ID}`;
      
      if (offlineManager.isOfflineMode()) {
        // Try cache first when offline
        const cached = await offlineManager.getCachedData(cacheKey);
        if (cached) {
          setAvailableMaps(cached);
          speakWithPriority('Using cached map data', 3);
          return;
        } else {
          speakWithPriority('No cached maps available. Connect to internet to download maps.', 2);
          return;
        }
      }
      
      // Online - fetch and cache
      const maps = await listFloorMaps(DEMO_USER_ID);
      setAvailableMaps(maps);
      
      // Cache for offline use
      await offlineManager.cacheData(cacheKey, maps, 604800000); // 7 days
    } catch (error) {
      console.error('Failed to load maps:', error);
      await errorRecoveryService.handleError('Load floor maps', error, 'medium', true);
      
      // Try cache as fallback
      const cached = await offlineManager.getCachedData(`maps_${DEMO_USER_ID}`);
      if (cached) {
        setAvailableMaps(cached);
      }
    }
  };

  // Prioritized speech system using accessibilityService
  // Priority: 1=Critical (emergency), 2=High (navigation), 3=Medium (objects), 4=Low (info)
  const speakWithPriority = (text: string, priority: number = 3) => {
    if (!voiceEnabled && priority > 2) return; // Only critical/high priority when voice off
    
    setLastAnnouncement(text);
    
    // Use accessibilityService for consistent speech queue and haptic feedback
    accessibilityService.speak(text, priority, priority > 2);
  };

  const repeatLastAnnouncement = () => {
    if (lastAnnouncement) {
      accessibilityService.speak(lastAnnouncement, 2, false);
    } else {
      accessibilityService.speak('No previous announcement to repeat.', 3);
    }
  };

  const calculateDistanceToDestination = () => {
    if (!plannedRoute || !currentPosition || !destinationRoom) return null;
    
    const totalWaypoints = plannedRoute.waypoints?.length || 0;
    if (totalWaypoints === 0) return null;
    
    // Estimate: assume 5 meters between waypoints
    const remainingWaypoints = totalWaypoints - currentRouteStep;
    const estimatedDistance = remainingWaypoints * 5;
    
    return estimatedDistance;
  };

  const announceDistanceProgress = () => {
    const distance = calculateDistanceToDestination();
    if (distance === null) return;
    
    // Announce at milestones: 50m, 30m, 20m, 10m
    if (distance <= 10 && lastDistanceAnnouncement > 10) {
      speakWithPriority('10 meters to destination', 2);
      setLastDistanceAnnouncement(10);
    } else if (distance <= 20 && lastDistanceAnnouncement > 20) {
      speakWithPriority('20 meters to destination', 2);
      setLastDistanceAnnouncement(20);
    } else if (distance <= 30 && lastDistanceAnnouncement > 30) {
      speakWithPriority('30 meters to destination', 2);
      setLastDistanceAnnouncement(30);
    } else if (distance <= 50 && lastDistanceAnnouncement > 50) {
      speakWithPriority('50 meters to destination', 2);
      setLastDistanceAnnouncement(50);
    }
    
    // Halfway announcement
    const totalWaypoints = plannedRoute.waypoints?.length || 0;
    if (currentRouteStep === Math.floor(totalWaypoints / 2) && lastDistanceAnnouncement !== 999) {
      speakWithPriority('Halfway to destination', 2);
      setLastDistanceAnnouncement(999);
    }
  };

  const classifyObstacleUrgency = (label: string, confidence: number): 'critical' | 'high' | 'medium' => {
    const lowerLabel = label.toLowerCase();
    
    // Critical obstacles (immediate danger)
    const criticalObstacles = ['person', 'car', 'truck', 'bicycle', 'motorcycle', 'bus', 'stairs', 'staircase'];
    if (criticalObstacles.some(obstacle => lowerLabel.includes(obstacle))) {
      return 'critical';
    }
    
    // High priority (significant obstacles)
    const highPriorityObstacles = ['chair', 'table', 'door', 'wall', 'pole', 'column', 'desk'];
    if (highPriorityObstacles.some(obstacle => lowerLabel.includes(obstacle)) && confidence > 0.6) {
      return 'high';
    }
    
    // Medium priority (minor obstacles)
    return 'medium';
  };

  const announceObstacleWithUrgency = (label: string, confidence: number, direction: string) => {
    const urgency = classifyObstacleUrgency(label, confidence);
    
    // Import verbosity templates
    const { obstacleDetected } = verbosityManager.getTemplates();
    const template = obstacleDetected(label, direction);
    
    let priority = 1;
    
    if (urgency === 'critical') {
      // Override with critical message regardless of verbosity
      speakWithPriority(`STOP! ${label} ${direction}!`, 1);
    } else if (urgency === 'high') {
      priority = 1;
      speakWithPriority(verbosityManager.format(template), priority);
    } else {
      priority = 2;
      speakWithPriority(verbosityManager.format(template), priority);
    }
  };

  const loadAvailableRooms = async (mapId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.listWaypoints(DEMO_USER_ID, mapId));
      const result = await response.json();
      
      if (result.success && result.waypoints) {
        const uniqueRooms = [...new Set(result.waypoints.map((wp: any) => wp.room_label))];
        setAvailableRooms(uniqueRooms);
        return uniqueRooms;
      }
      return [];
    } catch (error) {
      console.error('Failed to load rooms:', error);
      return [];
    }
  };

  const planNavigationRoute = async () => {
    if (!sourceRoom || !destinationRoom || !selectedMap) return;
    
    try {
      speakWithPriority('Planning route. Please wait.', 2);
      
      const response = await fetch(API_ENDPOINTS.planRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: DEMO_USER_ID,
          map_id: selectedMap.map_id,
          start_room: sourceRoom,
          end_room: destinationRoom,
        }),
      });

      const result = await response.json();
      
      if (result.success && result.route) {
        setPlannedRoute(result.route);
        setCurrentRouteStep(0);
        
        // Save this route for quick resume
        setLastUsedRoute({
          map: selectedMap,
          source: sourceRoom,
          destination: destinationRoom,
        });
        
        const firstInstruction = result.route.instructions?.[0] || 'Start walking';
        setCurrentInstruction(firstInstruction);
        navigationStartTimeRef.current = Date.now();
        setLastDistanceAnnouncement(999999); // Reset distance tracking
        speakWithPriority(`Route planned. ${result.route.waypoints?.length || 0} waypoints. ${firstInstruction}`, 2);
      } else {
        speakWithPriority('No route found. Please ensure waypoints exist for both rooms.', 2);
        Alert.alert('No Route', 'Unable to find a path between these rooms.');
      }
    } catch (error) {
      console.error('Route planning error:', error);
      speakWithPriority('Error planning route.', 2);
    }
  };

  const quickStartLastRoute = async () => {
    if (!lastUsedRoute) return;
    
    speakWithPriority(`Resuming last route from ${lastUsedRoute.source.replace(/_/g, ' ')} to ${lastUsedRoute.destination.replace(/_/g, ' ')}`, 2);
    
    setSelectedMap(lastUsedRoute.map);
    setSourceRoom(lastUsedRoute.source);
    setDestinationRoom(lastUsedRoute.destination);
    setNavigationMode(true);
    
    // Record action with undo capability
    await actionHistoryManager.recordAction({
      type: 'navigation_start',
      description: `Started navigation from ${lastUsedRoute.source} to ${lastUsedRoute.destination}`,
      reversible: true,
      undoDescription: 'Navigation stopped',
      undo: async () => {
        setNavigationMode(false);
        setPlannedRoute(null);
        setCurrentPosition(null);
        setCurrentInstruction('');
        speakWithPriority('Navigation stopped', 2);
      },
    });
    
    actionHistoryManager.addBreadcrumb('navigation', `Navigation: ${lastUsedRoute.source} → ${lastUsedRoute.destination}`);
    
    // Plan the route
    try {
      const response = await fetch(API_ENDPOINTS.planRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: DEMO_USER_ID,
          map_id: lastUsedRoute.map.map_id,
          start_room: lastUsedRoute.source,
          end_room: lastUsedRoute.destination,
        }),
      });

      const result = await response.json();
      
      if (result.success && result.route) {
        setPlannedRoute(result.route);
        setCurrentRouteStep(0);
        const firstInstruction = result.route.instructions?.[0] || 'Start walking';
        setCurrentInstruction(firstInstruction);
        speakWithPriority(`Navigation started. ${firstInstruction}`, 2);
      }
    } catch (error) {
      console.error('Quick start error:', error);
      speakWithPriority('Error starting navigation.', 2);
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    // Start capturing frames with battery saver support
    // Ensure isProcessing prevents overlapping requests.
    if (permission?.granted) {
      // Get interval from offline manager (adapts to battery saver)
      const detectionInterval = offlineManager.isBatterySaverActive() ? 2000 : 700;
      intervalId = setInterval(() => {
        if (!isProcessing) {
          captureAndAnalyzeFrame();
        }
      }, detectionInterval);
    }

    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }
    };
  }, [permission, isProcessing, batterySaverMode]);

  const captureAndAnalyzeFrame = async () => {
    if (cameraRef.current) {
      setIsProcessing(true);
      try {
        // Capture picture with low overhead
        const startTs = Date.now();
        const photo: CameraCapturedPicture = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: false,
          skipProcessing: true,
        });

        // Resize and compress the image to reduce upload latency
        const resized = await manipulateAsync(
          photo.uri,
          [{ resize: { width: 640 } }],
          { compress: 0.6, format: SaveFormat.JPEG }
        );

        const formData = new FormData();
        formData.append('file', {
          uri: resized.uri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        } as any);
        // include user id so backend can use user-specific faces (optional)
        formData.append('user_id', DEMO_USER_ID);

        // Helper: fetch with retries (exponential backoff)
        const fetchWithRetry = async (url: string, options: any, attempts = 3) => {
          let attempt = 0;
          let lastError: any = null;
          while (attempt < attempts) {
            try {
              if (attempt > 0) console.log(`Retry attempt ${attempt} for ${url}`);
              const resp = await fetch(url, options);
              if (!resp.ok) {
                // treat non-2xx as an error worth retrying
                lastError = new Error(`HTTP ${resp.status}`);
                attempt++;
                const backoff = 200 * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, backoff));
                continue;
              }
              return resp;
            } catch (err) {
              lastError = err;
              attempt++;
              const backoff = 200 * Math.pow(2, attempt);
              await new Promise(r => setTimeout(r, backoff));
            }
          }
          throw lastError;
        };

        // Call combined backend endpoint (object + face) with retry
        const combinedResp = await fetchWithRetry(API_ENDPOINTS.combinedDetection, { method: 'POST', body: formData });
        const combinedResult = await combinedResp.json();
        const objResult = { detections: combinedResult.detections || [] };
        const faceResult = { faces: combinedResult.faces || [] };

        const frameMs = Date.now() - startTs;
        setLastFrameMs(frameMs);
        console.log('⏱️ Frame processed in', frameMs, 'ms');

        setDetections(objResult.detections || []);
        const newFaces = faceResult.faces || [];
        setFaces(newFaces);
        setLastPhotoUri(resized.uri); // Store the smaller photo URI for later use when saving faces
        
        // Navigation mode: Match position and check obstacles
        if (navigationMode && selectedMap) {
          await handleNavigationMatching(resized.uri, objResult.detections || []);
        }

        // Enhanced voice announcements for blind users
        const nowTs = Date.now();
        if (voiceEnabled && !detectionsPaused) {
          try {
            // Check for backend-provided announcement first
            const backendAnnouncement = (combinedResult && (combinedResult as any).announcement) || '';
            if (backendAnnouncement && backendAnnouncement !== lastAnnouncedTextRef.current) {
              console.log('🔈 Announcing (backend):', backendAnnouncement);
              speakWithPriority(backendAnnouncement, 3);
              lastAnnouncedTextRef.current = backendAnnouncement;
              lastAnnouncementRef.current = nowTs;
            } else {
              // Build intelligent announcement on client
              let immediateAnnouncements: string[] = [];
              let regularAnnouncements: string[] = [];
              
              // Get current objects
              const currentObjects = (objResult.detections || [])
                .slice(0, 5)
                .map((d: any) => d.label.toLowerCase());
              
              // Detect NEW objects that haven't been announced in the last 3 seconds
              const now = Date.now();
              const announcedTimes = announcedObjectsTimeRef.current;
              
              // Clean up old entries (older than 3 seconds)
              for (const [obj, time] of Array.from(announcedTimes.entries())) {
                if (now - time > 3000) {
                  announcedTimes.delete(obj);
                }
              }
              
              // Filter objects: must be new AND not announced in last 3 seconds
              const newObjects = currentObjects.filter((obj: string) => {
                const lastAnnounced = announcedTimes.get(obj);
                const isNew = !prevObjectsRef.current.includes(obj);
                const notRecentlyAnnounced = !lastAnnounced || (now - lastAnnounced > 3000);
                return isNew && notRecentlyAnnounced;
              });
              
              if (newObjects.length > 0) {
                const objectNames = newObjects.map((obj: string) => obj.replace(/_/g, ' ')).join(', ');
                speakWithPriority(`${objectNames} detected`, 3);
                // Mark these objects as announced
                newObjects.forEach((obj: string) => announcedTimes.set(obj, now));
              }
              
              // Update previous objects
              prevObjectsRef.current = currentObjects;
              
              // Process faces
              if ((newFaces || []).length > 0) {
                const recognizedNow: string[] = [];
                let unknownCount = 0;
                
                for (const f of newFaces) {
                  const name = f.name || f.face_name || '';
                  if (name && name.toLowerCase().indexOf('unknown') === -1) {
                    recognizedNow.push(name);
                  } else {
                    unknownCount++;
                  }
                }
                
                // Detect NEW recognized faces
                const newRecognized = recognizedNow.filter(name => !prevRecognizedFacesRef.current.includes(name));
                if (newRecognized.length > 0) {
                  immediateAnnouncements.push(`Person recognized: ${newRecognized.join(', ')}`);
                }
                
                // Detect NEW unknown faces
                if (unknownCount > prevUnknownCountRef.current) {
                  const newUnknown = unknownCount - prevUnknownCountRef.current;
                  immediateAnnouncements.push(newUnknown === 1 ? 'New unknown face detected' : `${newUnknown} new unknown faces detected`);
                }
                
                // Update references
                prevRecognizedFacesRef.current = recognizedNow;
                prevUnknownCountRef.current = unknownCount;
                
                // Regular status update (throttled to every 3 seconds)
                if (nowTs - lastAnnouncementRef.current > 3000) {
                  if (recognizedNow.length > 0) {
                    regularAnnouncements.push(`Currently viewing: ${recognizedNow.join(', ')}`);
                  }
                  if (unknownCount > 0) {
                    regularAnnouncements.push(`${unknownCount} unknown ${unknownCount === 1 ? 'face' : 'faces'} in view`);
                  }
                }
              } else {
                // No faces detected - reset face tracking
                if (prevRecognizedFacesRef.current.length > 0 || prevUnknownCountRef.current > 0) {
                  // Faces disappeared
                  prevRecognizedFacesRef.current = [];
                  prevUnknownCountRef.current = 0;
                }
              }
              
              // Regular object status (throttled)
              if (currentObjects.length > 0 && nowTs - lastAnnouncementRef.current > 3000) {
                const objectSummary = currentObjects.slice(0, 3).map((obj: string) => obj.replace(/_/g, ' ')).join(', ');
                regularAnnouncements.push(`Objects in view: ${objectSummary}`);
              }
              
              // Announce immediately for new detections
              if (immediateAnnouncements.length > 0) {
                const immediateText = immediateAnnouncements.join('. ');
                console.log('🔈 Immediate announcement:', immediateText);
                Speech.speak(immediateText, { rate: 0.95 });
              }
              
              // Announce regular updates (throttled)
              if (regularAnnouncements.length > 0 && nowTs - lastAnnouncementRef.current > 3000) {
                const regularText = regularAnnouncements.join('. ');
                console.log('🔈 Status update:', regularText);
                Speech.speak(regularText, { rate: 0.9 });
                lastAnnouncementRef.current = nowTs;
              }
            }
          } catch (e) {
            console.warn('Error building/announcing text', e);
          }
        }
        // Initialize name and saving arrays for each face
        setFaceNames(new Array(newFaces.length).fill(''));
        setSavingFaces(new Array(newFaces.length).fill(false));
      } catch (error) {
        console.error("Error during capture and analysis:", error);
        // More detailed error logging
        if (error instanceof TypeError && error.message === 'Network request failed') {
          console.error("Network request failed - check if backend server is running on:", API_BASE_URL);
          Speech.speak("Unable to connect to detection server. Please check the connection.");
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleNavigationMatching = async (imageUri: string, detectedObjects: any[]) => {
    try {
      // Match position for navigation
      const formData = new FormData();
      formData.append('user_id', DEMO_USER_ID);
      formData.append('map_id', selectedMap!.map_id);
      formData.append('current_image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'nav_position.jpg',
      } as any);
      
      if (currentPosition?.waypoint_id) {
        formData.append('expected_waypoint', currentPosition.waypoint_id);
      }

      const response = await fetch(API_ENDPOINTS.matchPositionEnhanced, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success && result.matched) {
        const position = result.position;
        const hasPositionChanged = !currentPosition || currentPosition.waypoint_id !== position.waypoint_id;
        
        setCurrentPosition(position);
        
        if (hasPositionChanged && voiceEnabled) {
          // Check if we reached a waypoint in our planned route
          if (plannedRoute && plannedRoute.waypoints) {
            const currentWaypointIndex = plannedRoute.waypoints.findIndex(
              (wp: any) => wp.waypoint_id === position.waypoint_id
            );
            
            if (currentWaypointIndex >= 0 && currentWaypointIndex !== currentRouteStep) {
              setCurrentRouteStep(currentWaypointIndex);
              
              // Get instruction for this step
              const instruction = plannedRoute.instructions?.[currentWaypointIndex] || '';
              setCurrentInstruction(instruction);
              
              if (!announcedNavWaypointsRef.current.has(position.waypoint_id)) {
                const roomName = position.room_label.replace(/_/g, ' ');
                
                // Use verbosity-aware waypoint announcement
                const { waypoint } = verbosityManager.getTemplates();
                const waypointTemplate = waypoint(roomName, instruction);
                speakWithPriority(verbosityManager.format(waypointTemplate), 2);
                
                announcedNavWaypointsRef.current.add(position.waypoint_id);
                
                // Check if destination reached
                if (currentWaypointIndex === plannedRoute.waypoints.length - 1) {
                  // Calculate journey stats
                  const journeyTime = navigationStartTimeRef.current 
                    ? Math.round((Date.now() - navigationStartTimeRef.current) / 60000)
                    : 0;
                  
                  // Use verbosity-aware arrival announcement
                  const { arrival } = verbosityManager.getTemplates();
                  const arrivalTemplate = arrival(destinationRoom || 'destination', journeyTime);
                  speakWithPriority(verbosityManager.format(arrivalTemplate), 1);
                  
                  // Reset navigation
                  setNavigationMode(false);
                  setCurrentPosition(null);
                  setCurrentInstruction('');
                  announcedNavWaypointsRef.current.clear();
                  navigationStartTimeRef.current = null;
                  setLastDistanceAnnouncement(0);
                  return;
                }
                
                // Announce distance progress
                announceDistanceProgress();
              }
            }
          } else {
            // No planned route - use waypoint type for generic instructions
            let instruction = '';
            if (position.waypoint_type === 'CORNER') {
              instruction = 'Approaching a corner.';
            } else if (position.waypoint_type === 'DOOR') {
              instruction = 'Approaching a door.';
            } else if (position.waypoint_type === 'JUNCTION') {
              instruction = 'Approaching a junction.';
            }
            
            const roomName = position.room_label.replace(/_/g, ' ');
            const posDesc = position.position_description || '';
            
            if (!announcedNavWaypointsRef.current.has(position.waypoint_id)) {
              speakWithPriority(`${instruction} You are at ${roomName}. ${posDesc}`, 2);
              announcedNavWaypointsRef.current.add(position.waypoint_id);
              setCurrentInstruction(instruction || posDesc);
            }
          }
        }
      }
      
      // Check for obstacles in path with SPATIAL AWARENESS and urgency classification
      const nowTs = Date.now();
      if (voiceEnabled && nowTs - lastObstacleWarningRef.current > 3000) {
        const obstacles = detectedObjects.filter(obj => 
          ['person', 'chair', 'table', 'door', 'wall', 'bicycle', 'car', 'truck', 'pole', 'stairs'].includes(obj.label.toLowerCase()) &&
          obj.confidence > 0.5
        );
        
        if (obstacles.length > 0) {
          // Categorize obstacles by position in frame
          const centerObstacles = obstacles.filter(obj => obj.x > 0.35 && obj.x < 0.65);
          const leftObstacles = obstacles.filter(obj => obj.x <= 0.35);
          const rightObstacles = obstacles.filter(obj => obj.x >= 0.65);
          
          // Prioritize by urgency within each region
          const sortByUrgency = (objs: any[]) => objs.sort((a, b) => {
            const urgencyOrder = { critical: 3, high: 2, medium: 1 };
            const urgencyA = classifyObstacleUrgency(a.label, a.confidence);
            const urgencyB = classifyObstacleUrgency(b.label, b.confidence);
            return urgencyOrder[urgencyB] - urgencyOrder[urgencyA];
          });
          
          // Announce most urgent in each region with spatial direction
          let announced = false;
          
          // CENTER is highest priority (directly in path)
          if (centerObstacles.length > 0 && !announced) {
            const mostUrgent = sortByUrgency(centerObstacles)[0];
            announceObstacleWithUrgency(mostUrgent.label, mostUrgent.confidence, 'directly ahead');
            announced = true;
          }
          // LEFT obstacles
          else if (leftObstacles.length > 0 && !announced) {
            const mostUrgent = sortByUrgency(leftObstacles)[0];
            const direction = mostUrgent.x < 0.2 ? 'on your far left' : 'on your left';
            announceObstacleWithUrgency(mostUrgent.label, mostUrgent.confidence, direction);
            announced = true;
          }
          // RIGHT obstacles
          else if (rightObstacles.length > 0 && !announced) {
            const mostUrgent = sortByUrgency(rightObstacles)[0];
            const direction = mostUrgent.x > 0.8 ? 'on your far right' : 'on your right';
            announceObstacleWithUrgency(mostUrgent.label, mostUrgent.confidence, direction);
            announced = true;
          }
          
          if (announced) {
            lastObstacleWarningRef.current = nowTs;
          }
        }
      }
    } catch (error) {
      console.error('Navigation matching error:', error);
    }
  };

  const saveFace = async (faceIndex: number) => {
    const faceName = faceNames[faceIndex];
    if (!faceName.trim()) {
      Alert.alert('Error', 'Please enter a name for the face');
      if (voiceEnabled) Speech.speak('Please enter a name for the face before saving');
      return;
    }

    if (!lastPhotoUri) {
      Alert.alert('Error', 'No photo available. Please detect faces first.');
      if (voiceEnabled) Speech.speak('No photo available. Please detect faces first.');
      return;
    }

    // Announce saving action
    if (voiceEnabled) Speech.speak(`Saving face for ${faceName}`);

    // Set saving state for this face
    setSavingFaces(prev => {
      const newState = [...prev];
      newState[faceIndex] = true;
      return newState;
    });

    try {
      const face = faces[faceIndex];
      
      // Generate unique face_id
      const faceId = `face_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const formData = new FormData();
      
      // Use the stored photo URI from the last detection
      formData.append('file', {
        uri: lastPhotoUri,
        type: 'image/jpeg',
        name: 'face.jpg',
      } as any);
      
      formData.append('user_id', DEMO_USER_ID);
      formData.append('face_id', faceId);
      formData.append('face_name', faceName.trim());
      
      // Add metadata with bounding box and confidence if available
      const metadata = {
        bounding_box: face.bounding_box,
        confidence: face.confidence || null,
      };
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch(API_ENDPOINTS.saveUserFace, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert('Success', `Face for '${faceName}' saved successfully!`);
        if (voiceEnabled) Speech.speak(`Face for ${faceName} saved successfully. They will be recognized in future detections.`);
        
        // Clear the name input for this face
        setFaceNames(prev => {
          const newNames = [...prev];
          newNames[faceIndex] = '';
          return newNames;
        });
      } else {
        Alert.alert('Error', result.message || 'Failed to save face');
        if (voiceEnabled) Speech.speak('Failed to save face. Please try again.');
      }
    } catch (error) {
      console.error('Error saving face:', error);
      Alert.alert('Error', 'Failed to save face. Please try again.');
      if (voiceEnabled) Speech.speak('Error occurred while saving face. Please try again.');
    } finally {
      // Clear saving state for this face
      setSavingFaces(prev => {
        const newState = [...prev];
        newState[faceIndex] = false;
        return newState;
      });
    }
  };

  if (!permission) {
    return (
      <View style={styles.defaultView}>
        <Text style={styles.loadingText}>Loading Camera Permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.defaultView}>
        <Text style={styles.permissionText}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={styles.permissionButton}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Enhanced Voice Toggle for Accessibility */}
      <View style={styles.voiceStatusContainer}>
        <TouchableOpacity
          style={[styles.voiceToggleButton, voiceEnabled && styles.voiceToggleButtonActive]}
          onPress={async () => {
            const newState = !voiceEnabled;
            setVoiceEnabled(newState);
            speakWithPriority(newState ? 'Voice assistance enabled. All detections will be announced.' : 'Voice assistance disabled. Only critical navigation alerts will be spoken.', 2);
            
            // Record action with undo
            await actionHistoryManager.recordAction({
              type: 'voice_toggle',
              description: `Voice ${newState ? 'enabled' : 'disabled'}`,
              reversible: true,
              undoDescription: `Voice ${newState ? 'disabled' : 'enabled'}`,
              data: { previousState: voiceEnabled },
              undo: async () => {
                setVoiceEnabled(!newState);
                speakWithPriority(`Voice ${!newState ? 'enabled' : 'disabled'}`, 2);
              },
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={voiceEnabled ? 'Voice toggle button. Currently on. Top left corner.' : 'Voice toggle button. Currently off. Top left corner.'}
          accessibilityHint="Double tap to toggle voice announcements on or off"
          onAccessibilityTap={() => Speech.speak('Voice toggle button in top left corner. Currently ' + (voiceEnabled ? 'on' : 'off'))}
        >
          <Text style={styles.voiceToggleText}>
            {voiceEnabled ? '🔊 Voice: ON' : '🔇 Voice: OFF'}
          </Text>
        </TouchableOpacity>
        
        {/* Voice status indicator */}
        {voiceEnabled && (
          <TouchableOpacity
            style={styles.simpleVoiceButton}
            onPress={() => {
              // Announce current detection status
              const objCount = detections.length;
              const faceCount = faces.length;
              let status = navigationMode ? 'Navigation active. ' : 'Detection mode. ';
              if (currentPosition) status += `Current location: ${currentPosition.room_label.replace(/_/g, ' ')}. `;
              if (objCount > 0) status += `${objCount} objects detected. `;
              if (faceCount > 0) status += `${faceCount} faces detected. `;
              if (objCount === 0 && faceCount === 0) status += 'No objects detected. Point camera to detect.';
              speakWithPriority(status, 2);
            }}
            accessibilityRole="button"
            accessibilityLabel="Get current detection status"
          >
            <Text style={styles.simpleVoiceButtonText}>📊 Status</Text>
          </TouchableOpacity>
        )}
        
        {/* Navigation Mode Toggle */}
        <TouchableOpacity
          style={[styles.navModeButton, navigationMode && styles.navModeButtonActive]}
          onPress={() => {
            if (!navigationMode && availableMaps.length > 0) {
              // Show quick start option if last route exists
              if (lastUsedRoute) {
                Alert.alert(
                  'Navigation Mode',
                  `Resume last route (${lastUsedRoute.source.replace(/_/g, ' ')} → ${lastUsedRoute.destination.replace(/_/g, ' ')}) or select new route?`,
                  [
                    {
                      text: 'Resume Last Route',
                      onPress: () => {
                        speakWithPriority('Quick start activated. Resuming last route.', 2);
                        quickStartLastRoute();
                      },
                    },
                    {
                      text: 'New Route',
                      onPress: () => {
                        speakWithPriority(`Opening floor map selector. ${availableMaps.length} maps available.`, 2);
                        setShowMapSelector(true);
                      },
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              } else {
                speakWithPriority(`Navigation mode button. Opening floor map selector. ${availableMaps.length} maps available.`, 2);
                setShowMapSelector(true);
              }
            } else if (navigationMode) {
              setNavigationMode(false);
              setCurrentPosition(null);
              setCurrentInstruction('');
              announcedNavWaypointsRef.current.clear();
              setPlannedRoute(null);
              speakWithPriority('Navigation mode disabled. Detection only.', 2);
            } else {
              speakWithPriority('No floor maps available. Please go to indoor navigation screen to record floor maps first.', 2);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={navigationMode ? 'Navigation button. Top right corner. Currently active.' : lastUsedRoute ? 'Navigation button. Top right corner. Quick start available.' : 'Navigation button. Top right corner. Currently inactive.'}
          accessibilityHint={navigationMode ? 'Double tap to disable navigation mode' : lastUsedRoute ? 'Double tap for quick start or new route' : 'Double tap to enable navigation mode and select floor map'}
        >
          <Text style={styles.navModeButtonText}>
            {navigationMode ? '🧭 Nav: ON' : lastUsedRoute ? '⚡ Quick Start' : '🗺️ Nav: OFF'}
          </Text>
        </TouchableOpacity>
        
        {lastFrameMs !== null && (
            <View style={styles.latencyBadge}>
              <Text style={styles.latencyText}>{lastFrameMs} ms</Text>
            </View>
          )}
      </View>

      {/* Control Buttons Row (Iteration 2) */}
      <View style={styles.controlButtonsRow}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            setDetectionsPaused(!detectionsPaused);
            speakWithPriority(detectionsPaused ? 'Detection resumed. I will announce objects again.' : 'Detection paused. No announcements until resumed.', 2);
          }}
          accessibilityRole="button"
          accessibilityLabel={detectionsPaused ? 'Resume detections button. Bottom left.' : 'Pause detections button. Bottom left.'}
          accessibilityHint="Double tap to pause or resume object announcements"
        >
          <Text style={styles.controlButtonText}>{detectionsPaused ? '▶️ Resume' : '⏸️ Pause'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={repeatLastAnnouncement}
          accessibilityRole="button"
          accessibilityLabel="Repeat button. Bottom right. Replays last announcement."
          accessibilityHint="Double tap to hear the last announcement again"
        >
          <Text style={styles.controlButtonText}>🔁 Repeat</Text>
        </TouchableOpacity>
      </View>

      {/* Control Buttons Row (Iteration 2) */}
      <View style={styles.controlButtonsRow}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            setDetectionsPaused(!detectionsPaused);
            speakWithPriority(detectionsPaused ? 'Detection resumed. I will announce objects again.' : 'Detection paused. No announcements until resumed.', 2);
          }}
          accessibilityRole="button"
          accessibilityLabel={detectionsPaused ? 'Resume detections button. Bottom left.' : 'Pause detections button. Bottom left.'}
          accessibilityHint="Double tap to pause or resume object announcements"
        >
          <Text style={styles.controlButtonText}>{detectionsPaused ? '▶️ Resume' : '⏸️ Pause'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={repeatLastAnnouncement}
          accessibilityRole="button"
          accessibilityLabel="Repeat button. Bottom center. Replays last announcement."
          accessibilityHint="Double tap to hear the last announcement again"
        >
          <Text style={styles.controlButtonText}>🔁 Repeat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            setBatterySaverMode(!batterySaverMode);
            speakWithPriority(batterySaverMode ? 'Battery saver disabled. Normal detection speed.' : 'Battery saver enabled. Detection slowed to save battery.', 2);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Battery saver button. Bottom right. Currently ${batterySaverMode ? 'on' : 'off'}.`}
          accessibilityHint="Double tap to toggle battery saver mode"
        >
          <Text style={styles.controlButtonText}>{batterySaverMode ? '🔋 On' : '⚡ Off'}</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Instruction Display */}
      {navigationMode && currentInstruction && (
        <TouchableOpacity
          style={styles.navigationInstructionCard}
          onPress={() => {
            Speech.speak(`Current instruction: ${currentInstruction}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Current navigation instruction: ${currentInstruction}`}
          accessibilityHint="Tap to repeat instruction"
        >
          <Text style={styles.navigationInstructionIcon}>🧭</Text>
          <Text style={styles.navigationInstructionText}>{currentInstruction}</Text>
        </TouchableOpacity>
      )}

      {/* Current Position Display */}
      {navigationMode && currentPosition && (
        <TouchableOpacity
          style={styles.navigationPositionCard}
          onPress={() => {
            const roomName = currentPosition.room_label.replace(/_/g, ' ');
            const confidence = currentPosition.match_score;
            Speech.speak(`You are at ${roomName}. Position confidence ${confidence} percent.`);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Current position: ${currentPosition.room_label.replace(/_/g, ' ')}, ${currentPosition.match_score}% confidence`}
          accessibilityHint="Tap to repeat position"
        >
          <Text style={styles.navigationPositionLabel}>Position:</Text>
          <Text style={styles.navigationPositionRoom}>{currentPosition.room_label.replace(/_/g, ' ')}</Text>
          <Text style={styles.navigationPositionConfidence}>Confidence: {currentPosition.match_score}%</Text>
        </TouchableOpacity>
      )}

      <CameraView style={styles.cameraContainer} facing="back" ref={cameraRef} />

      <TouchableOpacity
        style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
        onPress={() => {
          if (voiceEnabled) Speech.speak('Detecting objects and faces now');
          captureAndAnalyzeFrame();
        }}
        disabled={isProcessing}
        accessibilityRole="button"
        accessibilityLabel="Manually detect objects and faces in current view"
        accessibilityHint="Captures and analyzes the current camera frame"
      >
        <Text style={styles.captureButtonText}>
          {isProcessing ? "Processing..." : "Detect Objects & Faces"}
        </Text>
      </TouchableOpacity>

      {(detections.length > 0 || faces.length > 0) && (
        <View style={styles.detectionsContainer}>
          {detections.length > 0 && (
            <>
              <Text style={styles.detectionsTitle}>Object Detections</Text>
              <ScrollView style={styles.scrollView}>
                {detections.map((item, index) => (
                  <TouchableOpacity
                    key={"obj-" + index} 
                    style={styles.detectionBox}
                    onPress={() => {
                      if (voiceEnabled) {
                        const confidence = (item.confidence * 100).toFixed(1);
                        Speech.speak(`${item.label.replace(/_/g, ' ')}, confidence ${confidence} percent`);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Object ${index + 1}: ${item.label.replace(/_/g, ' ')}, ${(item.confidence * 100).toFixed(1)}% confidence`}
                  >
                    <Text style={styles.detectionLabel}>{item.label}</Text>
                    <Text style={styles.detectionConfidence}>
                      {(item.confidence * 100).toFixed(1)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {faces.length > 0 && (
            <>
              <Text style={styles.detectionsTitle}>Face Detections</Text>
              <ScrollView style={styles.scrollView}>
                {faces.map((face, index) => (
                  <TouchableOpacity 
                    key={"face-" + index} 
                    style={styles.faceDetectionBox}
                    onPress={() => {
                      const faceName = face.name || `Unknown Face ${index + 1}`;
                      if (voiceEnabled) {
                        Speech.speak(`Face ${index + 1}: ${faceName}. Enter a name below and tap save to remember this person.`);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Face ${index + 1}: ${face.name || 'Unknown'}. Tap for details.`}
                  >
                    <View style={styles.faceInfo}>
                      <Text style={styles.detectionLabel}>{face.name || `Unknown Face ${index + 1}`}</Text>
                      <Text style={styles.boundingBoxText}>{face.bounding_box.join(", ")}</Text>
                    </View>
                    <View style={styles.faceSaveSection}>
                      <TextInput
                        style={styles.nameInput}
                        placeholder="Enter name"
                        placeholderTextColor="#7BA7A5"
                        value={faceNames[index] || ''}
                        onChangeText={(text) => setFaceNames(prev => {
                          const arr = [...prev];
                          arr[index] = text;
                          return arr;
                        })}
                        onFocus={() => {
                          if (voiceEnabled) Speech.speak('Enter name for this face');
                        }}
                        editable={!savingFaces[index]}
                        accessibilityLabel={`Name input for face ${index + 1}`}
                      />
                      <TouchableOpacity
                        onPress={() => saveFace(index)}
                        disabled={savingFaces[index] || !faceNames[index]?.trim()}
                        style={[styles.saveFaceButton, (savingFaces[index] || !faceNames[index]?.trim()) && styles.saveFaceButtonDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`Save face ${index + 1} as ${faceNames[index] || 'unnamed'}`}
                        accessibilityHint={!faceNames[index]?.trim() ? 'Enter a name first' : 'Tap to save this face'}
                      >
                        <Text style={styles.saveFaceButtonText}>
                          {savingFaces[index] ? 'Saving...' : 'Save'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}
      
      {/* Map Selector Modal */}
      <Modal
        visible={showMapSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Speech.speak('Map selection cancelled');
          setShowMapSelector(false);
        }}
        onShow={() => {
          Speech.speak(`Floor map selector opened. ${availableMaps.length} maps available. Swipe to browse. Double tap to select.`);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Floor Map for Navigation</Text>
            <ScrollView style={styles.modalScrollView}>
              {availableMaps.length === 0 ? (
                <Text style={styles.noMapsText}>No floor maps available. Please create a floor map first.</Text>
              ) : (
                availableMaps.map((map) => (
                  <TouchableOpacity
                    key={map.map_id}
                    style={styles.mapOption}
                    onPress={async () => {
                      Speech.speak(`${map.map_name} selected. Loading available rooms.`);
                      setSelectedMap(map);
                      setShowMapSelector(false);
                      
                      // Load rooms for this map
                      const rooms = await loadAvailableRooms(map.map_id);
                      
                      if (rooms.length >= 2) {
                        // Show room selector if we have waypoints
                        Speech.speak(`${rooms.length} rooms found. Please select source and destination.`);
                        setShowRoomSelector(true);
                      } else {
                        // Enable navigation without route planning
                        Speech.speak('Navigation mode enabled. Start walking and I will guide you with turn by turn directions and warn you about obstacles.');
                        setNavigationMode(true);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${map.map_name} for navigation`}
                    accessibilityHint="Tap to enable navigation on this floor map"
                  >
                    <Text style={styles.mapOptionText}>{map.map_name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                Speech.speak('Map selection cancelled');
                setShowMapSelector(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel map selection"
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Room Selector Modal */}
      <Modal
        visible={showRoomSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          speakWithPriority('Room selection cancelled', 2);
          setShowRoomSelector(false);
        }}
        onShow={() => {
          speakWithPriority(`Route selector opened. ${availableRooms.length} rooms available. First select source room, then select destination room from the same list. Tap any room to toggle between source and destination.`, 2);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Route</Text>
            <Text style={styles.modalInstructions}>
              {!sourceRoom ? 'Step 1: Select Source Room' : !destinationRoom ? 'Step 2: Select Destination Room' : 'Step 3: Tap Start Navigation'}
            </Text>
            
            <ScrollView style={styles.modalScrollView}>
              {availableRooms.map((room) => (
                <TouchableOpacity
                  key={room}
                  style={[
                    styles.roomOption,
                    sourceRoom === room && styles.roomOptionSource,
                    destinationRoom === room && styles.roomOptionDestination,
                  ]}
                  onPress={() => {
                    if (!sourceRoom) {
                      setSourceRoom(room);
                      speakWithPriority(`Source room: ${room.replace(/_/g, ' ')}. Now select destination room.`, 2);
                    } else if (!destinationRoom && room !== sourceRoom) {
                      setDestinationRoom(room);
                      speakWithPriority(`Destination room: ${room.replace(/_/g, ' ')}. Route ready. Tap start navigation button.`, 2);
                    } else if (room === sourceRoom) {
                      setSourceRoom('');
                      speakWithPriority('Source cleared. Select new source room.', 2);
                    } else if (room === destinationRoom) {
                      setDestinationRoom('');
                      speakWithPriority('Destination cleared. Select new destination room.', 2);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${room.replace(/_/g, ' ')}. ${sourceRoom === room ? 'Currently set as source' : destinationRoom === room ? 'Currently set as destination' : !sourceRoom ? 'Tap to set as source' : 'Tap to set as destination'}`}
                  accessibilityHint={sourceRoom === room || destinationRoom === room ? 'Tap again to clear selection' : 'Double tap to select'}
                >
                  <Text style={[
                    styles.roomOptionText,
                    sourceRoom === room && styles.roomOptionTextSelected,
                    destinationRoom === room && styles.roomOptionTextSelected,
                  ]}>
                    {room.replace(/_/g, ' ')}
                    {sourceRoom === room ? ' 🔵 (Source)' : destinationRoom === room ? ' 🔴 (Dest)' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.modalStartButton, (!sourceRoom || !destinationRoom) && styles.modalStartButtonDisabled]}
              disabled={!sourceRoom || !destinationRoom}
              onPress={() => {
                setShowRoomSelector(false);
                setNavigationMode(true);
                planNavigationRoute();
              }}
            >
              <Text style={styles.modalStartButtonText}>Start Navigation</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                speakWithPriority('Room selection cancelled', 2);
                setShowRoomSelector(false);
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const pastelColors = {
  background: colors.background,
  cameraOverlay: colors.secondary,
  buttonBackground: colors.secondary,
  buttonDisabledBackground: '#A0CFCB',
  buttonText: colors.text,
  detectionsBackground: "rgba(255, 255, 255, 0.85)",
  detectionBoxBackground: '#EFF7F6',
  detectionLabelText: '#2B7A78',
  detectionConfidenceText: colors.text,
  permissionText: colors.text,
  permissionButtonBackground: colors.secondary,
  permissionButtonText: colors.text,
  loadingText: colors.text,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelColors.background,
  },
  cameraContainer: {
    flex: 1,
  },
  captureButton: {
    position: "absolute",
    bottom: 60,
    left: "25%",
    right: "25%",
    paddingVertical: 20,
    backgroundColor: pastelColors.buttonBackground,
    borderRadius: 35,
    alignItems: "center",
    elevation: 5,
  },
  captureButtonDisabled: {
    backgroundColor: pastelColors.buttonDisabledBackground,
  },
  captureButtonText: {
    color: pastelColors.buttonText,
    fontSize: 20,
    fontWeight: "700",
  },
  voiceStatusContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceToggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  voiceToggleButtonActive: {
    backgroundColor: 'rgba(75, 230, 218, 0.95)',
    borderColor: '#3AAFA9',
  },
  voiceToggleText: {
    color: pastelColors.detectionLabelText,
    fontSize: 14,
    fontWeight: '700',
  },
  simpleVoiceButton: {
    backgroundColor: 'rgba(58, 175, 169, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
  },
  simpleVoiceButtonText: {
    color: pastelColors.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
  latencyBadge: {
    marginLeft: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  latencyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  detectionsContainer: {
    position: "absolute",
    bottom: 130,
    left: 12,
    right: 12,
    maxHeight: 220,
    backgroundColor: pastelColors.detectionsBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 10,
  },
  detectionsTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    color: pastelColors.detectionLabelText,
  },
  scrollView: {
    flexGrow: 0,
    maxHeight: 120,
  },
  detectionBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: pastelColors.detectionBoxBackground,
    marginVertical: 3,
    padding: 8,
    borderRadius: 5,
  },
  detectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: pastelColors.detectionLabelText,
  },
  detectionConfidence: {
    fontSize: 16,
    fontWeight: "500",
    color: pastelColors.detectionConfidenceText,
  },
  defaultView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: pastelColors.background,
  },
  loadingText: {
    fontSize: 20,
    color: pastelColors.loadingText,
  },
  permissionText: {
    fontSize: 18,
    color: pastelColors.permissionText,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 30,
  },
  permissionButton: {
    backgroundColor: pastelColors.permissionButtonBackground,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 5,
  },
  permissionButtonText: {
    color: pastelColors.permissionButtonText,
    fontSize: 18,
    fontWeight: "600",
  },
  faceDetectionBox: {
    backgroundColor: pastelColors.detectionBoxBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#C1E3E1",
  },
  faceInfo: {
    marginBottom: 8,
  },
  boundingBoxText: {
    fontSize: 12,
    color: pastelColors.detectionConfidenceText,
    opacity: 0.7,
  },
  faceSaveSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#C1E3E1",
    fontSize: 14,
  },
  saveFaceButton: {
    backgroundColor: pastelColors.buttonBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  saveFaceButtonDisabled: {
    backgroundColor: pastelColors.buttonDisabledBackground,
  },
  saveFaceButtonText: {
    color: pastelColors.buttonText,
    fontSize: 12,
    fontWeight: "600",
  },
  navModeButton: {
    backgroundColor: pastelColors.buttonBackground,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginHorizontal: 6,
    elevation: 2,
  },
  navModeButtonActive: {
    backgroundColor: '#4A90E2',
  },
  navModeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  navigationInstructionCard: {
    position: 'absolute',
    top: 80,
    left: 12,
    right: 12,
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  navigationInstructionIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  navigationInstructionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  navigationPositionCard: {
    position: 'absolute',
    top: 160,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  navigationPositionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },
  navigationPositionRoom: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  navigationPositionConfidence: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxHeight: '70%',
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2B7A78',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  mapOption: {
    backgroundColor: '#EFF7F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C1E3E1',
  },
  mapOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B7A78',
  },
  noMapsText: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    padding: 20,
  },
  modalCloseButton: {
    backgroundColor: '#E74C3C',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B7A78',
    marginTop: 12,
    marginBottom: 8,
  },
  modalInstructions: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  modalScrollView: {
    maxHeight: 380,
    marginBottom: 12,
  },
  modalScrollViewSmall: {
    maxHeight: 120,
    marginBottom: 8,
  },
  roomOption: {
    backgroundColor: '#EFF7F6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#C1E3E1',
  },
  roomOptionSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  roomOptionSource: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
    borderWidth: 2,
  },
  roomOptionDestination: {
    backgroundColor: '#F44336',
    borderColor: '#D32F2F',
    borderWidth: 2,
  },
  roomOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B7A78',
  },
  roomOptionTextSelected: {
    color: '#FFFFFF',
  },
  modalStartButton: {
    backgroundColor: '#50C878',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  modalStartButtonDisabled: {
    backgroundColor: '#A0CFCB',
  },
  modalStartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  controlButtonsRow: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 100,
  },
  controlButton: {
    backgroundColor: 'rgba(74, 144, 226, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, StatusBar, LayoutAnimation, UIManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import accessibilityService from './services/accessibilityService';
import GestureHandler from './components/GestureHandler';
import VoicePermissionHelper from './components/VoicePermissionHelper';
import actionHistoryManager from './services/actionHistoryManager';
import offlineManager from './services/offlineManager';

const { width, height } = Dimensions.get('window');

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string[];
  path: string;
  accessibilityLabel: string;
}

const FEATURES: FeatureCard[] = [
  {
    id: 'detection',
    title: 'Object Detection',
    description: 'Identify objects, people, and obstacles around you',
    icon: 'eye-outline',
    color: ['#667eea', '#764ba2'],
    path: '/features/detection/DetectionScreen',
    accessibilityLabel: 'Object Detection. Identify objects, people, and obstacles around you. Double tap to activate.'
  },
  {
    id: 'navigation',
    title: 'Indoor Navigation',
    description: 'Get turn-by-turn directions inside buildings',
    icon: 'navigate-outline',
    color: ['#f093fb', '#f5576c'],
    path: '/features/navigation/NavigationScreen',
    accessibilityLabel: 'Indoor Navigation. Get turn by turn directions inside buildings. Double tap to activate.'
  },
  {
    id: 'pathguidance',
    title: 'Path Guidance',
    description: 'Real-time obstacle detection with voice alerts',
    icon: 'walk-outline',
    color: ['#ff9a56', '#ff6a88'],
    path: '/screens/pathGuidance',
    accessibilityLabel: 'Path Guidance. Real-time obstacle detection and path guidance with voice alerts. Double tap to activate.'
  },
  {
    id: 'faces',
    title: 'Face Management',
    description: 'Save and manage recognized faces',
    icon: 'people-outline',
    color: ['#fa709a', '#fee140'],
    path: '/screens/faceManagement',
    accessibilityLabel: 'Face Management. Save and manage recognized faces. Double tap to activate.'
  },
  {
    id: 'management',
    title: 'Map Management',
    description: 'Record, process, and manage indoor maps',
    icon: 'map-outline',
    color: ['#4facfe', '#00f2fe'],
    path: '/features/management/MapManagementScreen',
    accessibilityLabel: 'Map Management. Record, process, and manage indoor maps. Double tap to activate.'
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Customize verbosity, voice, and accessibility',
    icon: 'settings-outline',
    color: ['#43e97b', '#38f9d7'],
    path: '/features/settings/SettingsScreen',
    accessibilityLabel: 'Settings. Customize verbosity, voice, and accessibility options. Double tap to activate.'
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const [currentFocus, setCurrentFocus] = useState(0);
  const [showVoicePermission, setShowVoicePermission] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    // Show voice permission helper on first launch
    const checkFirstLaunch = async () => {
      const hasShown = await AsyncStorage.getItem('voice_permission_shown');
      if (!hasShown) {
        setShowVoicePermission(true);
      }
    };
    checkFirstLaunch();
  }, []);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize all services
      await accessibilityService.initialize();
      await accessibilityService.initializeVerbosity();
      await actionHistoryManager.loadHistory();
      await offlineManager.initialize();
      
      // Track navigation
      actionHistoryManager.addBreadcrumb('home', 'Home screen');
      
      // Update offline status
      setIsOffline(offlineManager.isOfflineMode());
      
      // Welcome announcement
      accessibilityService.speak(
        'Welcome to Ziya, your intelligent navigation assistant. ' +
        'Swipe right to browse features. Double tap to select. ' +
        'Three finger tap anywhere to repeat last announcement. ' +
        'Swipe down with two fingers to go back.',
        1, // High priority
        false
      );
      
      // Check verbosity suggestions
      await accessibilityService.checkVerbositySuggestion();
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Initialization error:', error);
      accessibilityService.speak('App initialization failed. Please restart.', 0);
    }
  };

  const handleFeatureSelect = (feature: FeatureCard) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    accessibilityService.speak(`Opening ${feature.title}`, 2, false);
    accessibilityService.triggerHaptic('selection');
    
    // Record action for undo
    actionHistoryManager.recordAction('navigate', {
      from: 'home',
      to: feature.id,
      timestamp: Date.now()
    });
    
    router.push(feature.path as any);
  };

  const handleSwipeRight = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newIndex = (currentFocus + 1) % FEATURES.length;
    setCurrentFocus(newIndex);
    const feature = FEATURES[newIndex];
    accessibilityService.speak(
      `${feature.title}. ${feature.description}`,
      2,
      false
    );
    accessibilityService.triggerHaptic('selection');
  };

  const handleSwipeLeft = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newIndex = currentFocus === 0 ? FEATURES.length - 1 : currentFocus - 1;
    setCurrentFocus(newIndex);
    const feature = FEATURES[newIndex];
    accessibilityService.speak(
      `${feature.title}. ${feature.description}`,
      2,
      false
    );
    accessibilityService.triggerHaptic('selection');
  };

  const handleDoubleTap = () => {
    handleFeatureSelect(FEATURES[currentFocus]);
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initializing Ziya...</Text>
      </View>
    );
  }

  return (
    <GestureHandler
      config={{
        onSwipeRight: handleSwipeRight,
        onSwipeLeft: handleSwipeLeft,
        onDoubleTap: handleDoubleTap,
      }}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        {/* Header */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
        >
          <Text style={styles.appTitle}>Ziya</Text>
          <Text style={styles.appSubtitle}>Your Eyes-Free Assistant</Text>
          
          {isOffline && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
              <Text style={styles.offlineText}>Offline Mode</Text>
            </View>
          )}
        </LinearGradient>

        {/* Feature Cards */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.cardContainer}
          showsVerticalScrollIndicator={false}
        >
          {FEATURES.map((feature, index) => (
            <TouchableOpacity
              key={feature.id}
              onPress={() => handleFeatureSelect(feature)}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel={feature.accessibilityLabel}
              accessibilityRole="button"
              accessibilityHint="Double tap to activate this feature"
            >
              <LinearGradient
                colors={feature.color}
                style={[
                  styles.card,
                  currentFocus === index && styles.cardFocused
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.cardIconContainer}>
                  <Ionicons 
                    name={feature.icon} 
                    size={48} 
                    color="#fff" 
                  />
                </View>
                
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{feature.title}</Text>
                  <Text style={styles.cardDescription}>{feature.description}</Text>
                </View>

                <View style={styles.cardArrow}>
                  <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Gesture Hints */}
        <View style={styles.hintBar}>
          <View style={styles.hintItem}>
            <Ionicons name="swap-horizontal-outline" size={20} color="#667eea" />
            <Text style={styles.hintText}>Swipe to browse</Text>
          </View>
          <View style={styles.hintItem}>
            <Ionicons name="hand-left-outline" size={20} color="#667eea" />
            <Text style={styles.hintText}>Double tap to select</Text>
          </View>
        </View>

        {/* Voice Permission Helper Modal */}
        {showVoicePermission && (
          <VoicePermissionHelper
            onDismiss={async () => {
              await AsyncStorage.setItem('voice_permission_shown', 'true');
              setShowVoicePermission(false);
            }}
          />
        )}
      </View>
    </GestureHandler>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    fontSize: 18,
    color: '#667eea',
    fontWeight: '600',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  appTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  cardContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  cardFocused: {
    transform: [{ scale: 1.02 }],
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
  cardIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  cardArrow: {
    marginLeft: 8,
  },
  hintBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e6ed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    color: '#667eea',
    marginLeft: 8,
    fontWeight: '600',
  },
});

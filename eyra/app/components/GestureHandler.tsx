/**
 * Universal Gesture Handler for Blind Users
 * Handles swipes, shakes, multi-touch, and provides haptic feedback
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, PanResponder, PanResponderInstance } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import accessibilityService, { GestureConfig } from '../services/accessibilityService';
import actionHistoryManager from '../services/actionHistoryManager';

interface GestureHandlerProps {
  children: React.ReactNode;
  config: GestureConfig;
  enabled?: boolean;
}

export default function GestureHandler({ children, config, enabled = true }: GestureHandlerProps) {
  const panResponder = useRef<PanResponderInstance | undefined>(undefined);
  const lastTap = useRef<number>(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchCount = useRef<number>(0);
  const shakeSubscription = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    // Setup shake detection
    if (config.onShake) {
      let lastShake = 0;
      let lastX = 0, lastY = 0, lastZ = 0;
      
      Accelerometer.setUpdateInterval(100);
      shakeSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
        const acceleration = Math.abs(x + y + z - lastX - lastY - lastZ);
        
        if (acceleration > 2.5) {
          const now = Date.now();
          if (now - lastShake > 1000) { // Prevent multiple shake detections
            lastShake = now;
            accessibilityService.triggerHaptic('warning');
            config.onShake?.();
          }
        }
        
        lastX = x;
        lastY = y;
        lastZ = z;
      });
    }

    return () => {
      if (shakeSubscription.current) {
        shakeSubscription.current.remove();
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [enabled, config]);

  useEffect(() => {
    if (!enabled) return;

    panResponder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches.length;
        touchCount.current = touches;
        
        // Three-finger tap detection
        if (touches === 3 && config.onThreeFingerTap) {
          accessibilityService.triggerHaptic('success');
          config.onThreeFingerTap();
          return;
        }
        
        // Long press detection (for single touch)
        if (touches === 1 && config.onLongPress) {
          longPressTimer.current = setTimeout(() => {
            accessibilityService.triggerHaptic('warning');
            config.onLongPress?.();
          }, 800);
        }
        
        // Double tap detection
        const now = Date.now();
        if (now - lastTap.current < 300 && touches === 1) {
          if (config.onDoubleTap) {
            accessibilityService.triggerHaptic('buttonPress');
            config.onDoubleTap();
          }
        }
        lastTap.current = now;
      },
      
      onPanResponderMove: (evt, gestureState) => {
        // Clear long press if moved
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
        }
      },
      
      onPanResponderRelease: (evt, gestureState) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
        }
        
        const { dx, dy } = gestureState;
        const threshold = 50; // Minimum swipe distance
        
        // Determine swipe direction
        if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
          accessibilityService.triggerHaptic('swipe');
          
          if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal swipe
            if (dx > threshold && config.onSwipeRight) {
              config.onSwipeRight();
            } else if (dx < -threshold && config.onSwipeLeft) {
              config.onSwipeLeft();
            }
          } else {
            // Vertical swipe
            if (dy > threshold && config.onSwipeDown) {
              config.onSwipeDown();
            } else if (dy < -threshold && config.onSwipeUp) {
              config.onSwipeUp();
            }
          }
        }
      },
    });
  }, [enabled, config]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container} {...(panResponder.current?.panHandlers || {})}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

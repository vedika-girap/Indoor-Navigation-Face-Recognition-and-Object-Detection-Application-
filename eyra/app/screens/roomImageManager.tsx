import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DEMO_USER_ID } from '../constants/user';
import { attachRoomImage, getRoomImage } from '../services/indoorNavigationService';
import { OfflineNavigationService } from '../services/offlineNavigationService';
import { AppColors } from '../theme/colors';

export default function RoomImageManager() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const map = params.map ? JSON.parse(params.map as string) : null;
  
  const [labels, setLabels] = useState<any[]>([]);
  const [roomImages, setRoomImages] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [cachingOffline, setCachingOffline] = useState(false);
  const [offlineCached, setOfflineCached] = useState(false);
  
  const userId = DEMO_USER_ID;

  useEffect(() => {
    loadRoomData();
  }, []);

  const loadRoomData = async () => {
    try {
      setLoading(true);
      
      // Get labels from map metadata
      const mapLabels = map?.metadata?.labels || [];
      setLabels(mapLabels);

      // Load existing images for each room
      const images: { [key: string]: string } = {};
      for (const label of mapLabels) {
        try {
          const imageUri = await getRoomImage(userId, map.map_id, label.label);
          if (imageUri) {
            images[label.label] = imageUri;
          }
        } catch (error) {
          console.log(`No image for ${label.label}`);
        }
      }
      setRoomImages(images);
    } catch (error) {
      console.error('Error loading room data:', error);
      Alert.alert('Error', 'Failed to load room data');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachImage = async (roomLabel: string) => {
    try {
      setUploading(roomLabel);
      
      const success = await attachRoomImage(userId, map.map_id, roomLabel);
      
      if (success) {
        Alert.alert('Success', `Image attached to ${roomLabel.replace('_', ' ')}`);
        // Reload images
        await loadRoomData();
      } else {
        Alert.alert('Cancelled', 'Image selection was cancelled');
      }
    } catch (error) {
      console.error('Error attaching image:', error);
      Alert.alert('Error', 'Failed to attach image');
    } finally {
      setUploading(null);
    }
  };

  const handleStartNavigation = () => {
    // Count rooms with images
    const roomsWithImages = labels.filter(l => roomImages[l.label]).length;
    
    if (roomsWithImages < 2) {
      Alert.alert(
        'Add More Images',
        'Please attach images to at least 2 rooms before starting navigation.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to navigation screen
    router.push({
      pathname: '/screens/navigationScreen' as any,
      params: {
        map: JSON.stringify(map),
        labels: JSON.stringify(labels),
      },
    });
  };

  const cacheWaypointsForOffline = async () => {
    try {
      setCachingOffline(true);

      // Create waypoints from room data
      const waypoints = labels
        .filter(l => roomImages[l.label])
        .map(l => ({
          waypoint_id: `waypoint_${l.label}`,
          room_label: l.label,
          position: l.position || { x: 0, y: 0 },
          instruction: `Navigate to ${l.label.replace('_', ' ')}`,
          has_image: true,
          image_uri: roomImages[l.label],
        }));

      if (waypoints.length === 0) {
        Alert.alert('No Images', 'Please attach at least one room image before caching.');
        return;
      }

      // Cache waypoints for offline use
      await OfflineNavigationService.cacheWaypoints(map.map_id, waypoints);
      
      setOfflineCached(true);
      Alert.alert(
        'Offline Cache Ready',
        `Successfully cached ${waypoints.length} waypoints for offline navigation.`
      );
    } catch (error) {
      console.error('Error caching waypoints:', error);
      Alert.alert('Error', 'Failed to cache waypoints for offline use');
    } finally {
      setCachingOffline(false);
    }
  };

  if (!map) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No map data provided</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={AppColors.primaryLight} />
        <Text style={styles.loadingText}>Loading room data...</Text>
      </View>
    );
  }

  const roomsWithImages = labels.filter(l => roomImages[l.label]).length;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>{map.map_name}</Text>
          <Text style={styles.subtitle}>Attach Reference Images to Rooms</Text>
          <Text style={styles.statusText}>
            {roomsWithImages} of {labels.length} rooms have images
          </Text>
        </View>

        {labels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No room labels found. Please process this map first.
            </Text>
          </View>
        ) : (
          <View style={styles.roomsContainer}>
            {labels.map((label) => {
              const hasImage = !!roomImages[label.label];
              const isUploading = uploading === label.label;

              return (
                <View key={label.label} style={styles.roomCard}>
                  <View style={styles.roomHeader}>
                    <Text style={styles.roomLabel}>
                      {label.label.replace('_', ' ').toUpperCase()}
                    </Text>
                    {hasImage && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>✓ Image</Text>
                      </View>
                    )}
                  </View>

                  {hasImage && roomImages[label.label] ? (
                    <Image
                      source={{ uri: roomImages[label.label] }}
                      style={styles.roomImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Text style={styles.placeholderText}>No Image</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.attachButton,
                      hasImage && styles.replaceButton,
                    ]}
                    onPress={() => handleAttachImage(label.label)}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.attachButtonText}>
                        {hasImage ? 'Replace Image' : 'Attach Image'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.cacheButton,
            (roomsWithImages === 0 || cachingOffline) && styles.cacheButtonDisabled,
          ]}
          onPress={cacheWaypointsForOffline}
          disabled={roomsWithImages === 0 || cachingOffline}
        >
          {cachingOffline ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.cacheButtonText}>
              {offlineCached ? '✓ Cached for Offline' : '📥 Cache for Offline'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.recordButton]}
          onPress={() => {
            router.push({
              pathname: '/screens/pathRecordingMode' as any,
              params: {
                map: JSON.stringify(map),
              },
            });
          }}
        >
          <Text style={styles.recordButtonText}>
            🎥 Record Navigation Path (NEW)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.startButton,
            roomsWithImages < 2 && styles.startButtonDisabled,
          ]}
          onPress={handleStartNavigation}
          disabled={roomsWithImages < 2}
        >
          <Text style={styles.startButtonText}>
            Start Navigation (Old Method) →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: AppColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    color: AppColors.primaryLight,
    fontWeight: '600',
  },
  roomsContainer: {
    padding: 15,
  },
  roomCard: {
    backgroundColor: AppColors.cardBackground,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  roomLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  badge: {
    backgroundColor: AppColors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: AppColors.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  roomImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  placeholderImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: AppColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  placeholderText: {
    color: AppColors.textSecondary,
    fontSize: 14,
  },
  attachButton: {
    backgroundColor: AppColors.primaryLight,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  replaceButton: {
    backgroundColor: AppColors.accent,
  },
  attachButtonText: {
    color: AppColors.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    padding: 20,
    backgroundColor: AppColors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  cacheButton: {
    backgroundColor: AppColors.warning,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  cacheButtonDisabled: {
    backgroundColor: AppColors.textDisabled,
    opacity: 0.5,
  },
  cacheButtonText: {
    color: AppColors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
  recordButton: {
    backgroundColor: AppColors.error,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  recordButtonText: {
    color: AppColors.textLight,
    fontSize: 18,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: AppColors.success,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: AppColors.textDisabled,
    opacity: 0.5,
  },
  startButtonText: {
    color: AppColors.textLight,
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: AppColors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: AppColors.error,
    fontSize: 16,
  },
  loadingText: {
    marginTop: 10,
    color: AppColors.textSecondary,
  },
});

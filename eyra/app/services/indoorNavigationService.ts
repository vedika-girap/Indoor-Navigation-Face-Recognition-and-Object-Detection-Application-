/**
 * Indoor Navigation Service
 * Handles room image attachments and route calculation
 */

import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 'http://10.231.226.100:8000';

export interface RoomWaypoint {
  room_label: string;
  position: { x: number; y: number };
  instruction: string;
  has_image: boolean;
  image_filename?: string;
}

export interface NavigationRoute {
  success: boolean;
  source: string;
  destination: string;
  route: RoomWaypoint[];
  total_waypoints: number;
  estimated_distance: string;
  map_id: string;
}

/**
 * Attach a reference image to a room label
 */
export async function attachRoomImage(
  userId: string,
  mapId: string,
  roomLabel: string
): Promise<boolean> {
  try {
    // Pick image from device
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return false;
    }

    const file = result.assets[0];

    // Create form data
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('map_id', mapId);
    formData.append('room_label', roomLabel);
    
    // Append file
    const fileUri = file.uri;
    const filename = file.name || `${roomLabel}.jpg`;
    
    // For React Native, we need to create a proper file object
    const fileBlob = {
      uri: fileUri,
      type: file.mimeType || 'image/jpeg',
      name: filename,
    } as any;
    
    formData.append('file', fileBlob);

    // Upload to backend
    const response = await fetch(`${BACKEND_URL}/indoor_navigation/attach_image`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const data = await response.json();
    console.log('Attach image response:', data);

    return data.success;
  } catch (error) {
    console.error('Error attaching room image:', error);
    throw error;
  }
}

/**
 * Get room image as base64
 */
export async function getRoomImage(
  userId: string,
  mapId: string,
  roomLabel: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${BACKEND_URL}/indoor_navigation/room_image/${userId}/${mapId}/${roomLabel}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.image_base64) {
      return `data:image/jpeg;base64,${data.image_base64}`;
    }

    return null;
  } catch (error) {
    console.error('Error getting room image:', error);
    return null;
  }
}

/**
 * Calculate navigation route between two rooms
 */
export async function calculateRoute(
  userId: string,
  mapId: string,
  sourceRoom: string,
  destinationRoom: string
): Promise<NavigationRoute> {
  try {
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('map_id', mapId);
    formData.append('source_room', sourceRoom);
    formData.append('destination_room', destinationRoom);

    const response = await fetch(`${BACKEND_URL}/indoor_navigation/calculate_route`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to calculate route: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calculating route:', error);
    throw error;
  }
}

/**
 * Check if a room has an attached image
 */
export async function hasRoomImage(
  userId: string,
  mapId: string,
  roomLabel: string
): Promise<boolean> {
  try {
    const image = await getRoomImage(userId, mapId, roomLabel);
    return image !== null;
  } catch (error) {
    return false;
  }
}

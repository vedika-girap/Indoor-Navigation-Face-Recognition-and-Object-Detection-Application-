/**
 * API Configuration
 * 
 * Centralized configuration for backend API URLs.
 * Change the IP address here and it will update across the entire app.
 */

import Constants from 'expo-constants';

/**
 * Backend API Base URL
 * 
 * This will first try to get the URL from app.config.js (extra.backendUrl),
 * then fall back to the default URL below.
 * 
 * To change the IP address:
 * 1. Update the backendUrl in app.config.js, OR
 * 2. Change the DEFAULT_BACKEND_URL below
 */
const DEFAULT_BACKEND_URL = 'http://192.168.29.40:8000';

export const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || DEFAULT_BACKEND_URL;

/**
 * API Endpoints
 * 
 * Common API endpoints used throughout the app.
 */
export const API_ENDPOINTS = {
  // Object Detection & Face Recognition
  objectDetection: `${API_BASE_URL}/object_detection/`,
  faceRecognition: `${API_BASE_URL}/face_recognition/`,
  // Combined endpoint to return both object detections and face recognition in one call
  combinedDetection: `${API_BASE_URL}/combined_detection/`,
  
  // User Faces
  saveUserFace: `${API_BASE_URL}/user_faces/save`,
  listUserFaces: (userId: string) => `${API_BASE_URL}/user_faces/list/${userId}`,
  getUserFace: (userId: string, faceId: string) => `${API_BASE_URL}/user_faces/get/${userId}/${faceId}`,
  updateUserFace: (userId: string, faceId: string) => `${API_BASE_URL}/user_faces/update/${userId}/${faceId}`,
  deleteUserFace: (userId: string, faceId: string) => `${API_BASE_URL}/user_faces/delete/${userId}/${faceId}`,
  
  // Floor Maps
  addFloorMap: `${API_BASE_URL}/floor_maps/add`,
  listFloorMaps: (userId: string) => `${API_BASE_URL}/floor_maps/list/${userId}`,
  getFloorMap: (userId: string, mapId: string) => `${API_BASE_URL}/floor_maps/get/${userId}/${mapId}`,
  processFloorMap: `${API_BASE_URL}/floor_maps/process`,
  updateFloorMapMetadata: (userId: string, mapId: string) => `${API_BASE_URL}/floor_maps/update_metadata/${userId}/${mapId}`,
  updateFloorMapLabels: (userId: string, mapId: string) => `${API_BASE_URL}/floor_maps/update_labels/${userId}/${mapId}`,
  deleteFloorMap: (userId: string, mapId: string) => `${API_BASE_URL}/floor_maps/delete/${userId}/${mapId}`,
  deleteFloorMapPermanent: (userId: string, mapId: string) => `${API_BASE_URL}/floor_maps/delete_permanent/${userId}/${mapId}`,
  getFloorMapStats: (userId: string) => `${API_BASE_URL}/floor_maps/stats/${userId}`,
  uploadFloorMap: `${API_BASE_URL}/upload_floor_map`,
  
  // Indoor Navigation
  attachRoomImage: `${API_BASE_URL}/indoor_navigation/attach_image`,
  getRoomImage: (userId: string, mapId: string, roomLabel: string) => 
    `${API_BASE_URL}/indoor_navigation/room_image/${userId}/${mapId}/${roomLabel}`,
  calculateRoute: `${API_BASE_URL}/indoor_navigation/calculate_route`,
  matchPosition: `${API_BASE_URL}/indoor_navigation/match_position`,
  
  // Navigation V2 (Enhanced)
  createWaypoint: `${API_BASE_URL}/navigation/v2/create_waypoint`,
  planRoute: `${API_BASE_URL}/navigation/v2/plan_route`,
  getGuidance: `${API_BASE_URL}/navigation/v2/get_guidance`,
  listWaypoints: (userId: string, mapId: string) => `${API_BASE_URL}/navigation/v2/list_waypoints/${userId}/${mapId}`,
  matchPositionEnhanced: `${API_BASE_URL}/navigation/v2/match_position_enhanced`,
};

/**
 * Utility function to check if backend is reachable
 */
export const checkBackendConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/`, { method: 'GET' });
    return response.ok;
  } catch (error) {
    console.error('Backend connection check failed:', error);
    return false;
  }
};

/**
 * Log current API configuration (useful for debugging)
 */
export const logAPIConfig = () => {
  console.log('=== API Configuration ===');
  console.log('Backend URL:', API_BASE_URL);
  console.log('From app.config:', Constants.expoConfig?.extra?.backendUrl);
  console.log('Default URL:', DEFAULT_BACKEND_URL);
  console.log('========================');
};

// Default export placeholder to satisfy Expo Router (this file is not a route)
export default function APIConfigPlaceholder(): null {
  return null;
}

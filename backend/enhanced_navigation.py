"""
Enhanced Indoor Navigation System for Blind Users
Redesigned with dense waypoint capture and intelligent path planning
"""

import os
import json
import time
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from collections import defaultdict
import heapq

class WaypointType:
    """Enumeration of waypoint types"""
    ENTRY_DOOR = "ENTRY_DOOR"
    CORRIDOR_START = "CORRIDOR_START"
    CORNER = "CORNER"
    DOOR = "DOOR"
    LANDMARK = "LANDMARK"
    ROOM_CENTER = "ROOM_CENTER"
    JUNCTION = "JUNCTION"
    INTERMEDIATE = "INTERMEDIATE"  # Auto-generated waypoints

class NavigationGraph:
    """
    Graph structure for navigation path planning
    Uses adjacency list representation
    """
    
    def __init__(self):
        self.graph = defaultdict(list)  # waypoint_id -> [(connected_waypoint_id, distance, direction)]
        self.waypoints = {}  # waypoint_id -> waypoint_data
    
    def add_waypoint(self, waypoint_data: Dict[str, Any]):
        """Add a waypoint to the graph"""
        waypoint_id = waypoint_data['waypoint_id']
        self.waypoints[waypoint_id] = waypoint_data
        
        # Add connections from waypoint data
        for connection in waypoint_data.get('connections', []):
            self.add_edge(
                waypoint_id,
                connection['to_waypoint'],
                connection.get('distance_steps', 0),
                connection.get('direction', 'forward'),
                connection.get('instruction', '')
            )
    
    def add_edge(self, from_wp: str, to_wp: str, distance: int, direction: str, instruction: str):
        """Add a directed edge between waypoints"""
        self.graph[from_wp].append({
            'to': to_wp,
            'distance': distance,
            'direction': direction,
            'instruction': instruction
        })
    
    def find_shortest_path(self, start: str, end: str) -> Optional[Tuple[List[str], int, List[str]]]:
        """
        Find shortest path using Dijkstra's algorithm
        Returns: (path_waypoints, total_distance, instructions)
        """
        if start not in self.waypoints or end not in self.waypoints:
            return None
        
        # Priority queue: (distance, waypoint_id, path, instructions)
        pq = [(0, start, [start], [])]
        visited = set()
        
        while pq:
            dist, current, path, instructions = heapq.heappop(pq)
            
            if current in visited:
                continue
            
            visited.add(current)
            
            if current == end:
                return (path, dist, instructions)
            
            # Explore neighbors
            for edge in self.graph.get(current, []):
                next_wp = edge['to']
                if next_wp not in visited:
                    new_dist = dist + edge['distance']
                    new_path = path + [next_wp]
                    new_instructions = instructions + [edge['instruction']]
                    heapq.heappush(pq, (new_dist, next_wp, new_path, new_instructions))
        
        return None  # No path found
    
    def get_nearby_waypoints(self, waypoint_id: str, max_distance: int = 50) -> List[Dict]:
        """Get waypoints within certain distance for position matching"""
        if waypoint_id not in self.waypoints:
            return []
        
        nearby = []
        visited = {waypoint_id}
        queue = [(waypoint_id, 0)]
        
        while queue:
            current, dist = queue.pop(0)
            
            for edge in self.graph.get(current, []):
                next_wp = edge['to']
                new_dist = dist + edge['distance']
                
                if next_wp not in visited and new_dist <= max_distance:
                    visited.add(next_wp)
                    nearby.append({
                        'waypoint_id': next_wp,
                        'distance': new_dist,
                        'waypoint_data': self.waypoints.get(next_wp, {})
                    })
                    queue.append((next_wp, new_dist))
        
        return nearby


class EnhancedNavigationSystem:
    """
    Main navigation system with improved positioning and guidance
    """
    
    def __init__(self, user_id: str, map_id: str):
        self.user_id = user_id
        self.map_id = map_id
        self.graph = NavigationGraph()
        self.waypoints_dir = os.path.join("navigation_waypoints", user_id, map_id)
        self.load_waypoints()
    
    def load_waypoints(self):
        """Load all waypoints from storage with error handling"""
        waypoints_file = os.path.join(self.waypoints_dir, "waypoints.json")
        
        if not os.path.exists(waypoints_file):
            print(f"[NAV] No existing waypoints file for user {self.user_id}, map {self.map_id}")
            return
        
        try:
            with open(waypoints_file, 'r') as f:
                data = json.load(f)
                waypoints = data.get('waypoints', [])
                
                for wp in waypoints:
                    try:
                        self.graph.add_waypoint(wp)
                    except Exception as wp_error:
                        print(f"[WARNING] Failed to load waypoint {wp.get('waypoint_id', 'unknown')}: {str(wp_error)}")
                        continue
                
                print(f"[NAV] Loaded {len(self.graph.waypoints)} waypoints")
        except json.JSONDecodeError as e:
            print(f"[ERROR] Corrupted waypoints file: {str(e)}")
            # Backup the corrupted file
            import shutil
            backup_file = waypoints_file + f".corrupt.{int(time.time())}"
            try:
                shutil.copy(waypoints_file, backup_file)
                print(f"[NAV] Backed up corrupted file to {backup_file}")
            except:
                pass
        except Exception as e:
            print(f"[ERROR] Failed to load waypoints: {str(e)}")
    
    def save_waypoints(self):
        """Save waypoints to storage with retry logic and atomic writes"""
        import tempfile
        import shutil
        
        try:
            os.makedirs(self.waypoints_dir, exist_ok=True)
            waypoints_file = os.path.join(self.waypoints_dir, "waypoints.json")
            
            waypoints_list = list(self.graph.waypoints.values())
            
            data = {
                'user_id': self.user_id,
                'map_id': self.map_id,
                'total_waypoints': len(waypoints_list),
                'waypoints': waypoints_list,
                'last_updated': time.time()
            }
            
            # Use atomic write: write to temp file first, then rename
            # This prevents corruption if multiple processes write simultaneously
            temp_fd, temp_path = tempfile.mkstemp(dir=self.waypoints_dir, suffix='.json.tmp')
            try:
                with os.fdopen(temp_fd, 'w') as f:
                    json.dump(data, f, indent=2)
                
                # Atomic rename (overwrites existing file)
                shutil.move(temp_path, waypoints_file)
                print(f"[NAV] Saved {len(waypoints_list)} waypoints to {waypoints_file}")
            except Exception as e:
                # Clean up temp file if something went wrong
                try:
                    os.unlink(temp_path)
                except:
                    pass
                raise e
                
        except Exception as e:
            print(f"[ERROR] Failed to save waypoints: {str(e)}")
            raise
    
    def add_waypoint_with_images(
        self,
        waypoint_id: str,
        waypoint_type: str,
        room_label: str,
        position_description: str,
        images_data: List[Dict],  # [{'filename', 'orientation', 'timestamp'}]
        connections: List[Dict] = None,
        metadata: Dict = None
    ) -> Dict:
        """
        Add a new waypoint with multiple images from different angles
        """
        waypoint = {
            'waypoint_id': waypoint_id,
            'type': waypoint_type,
            'room_label': room_label,
            'position_description': position_description,
            'images': images_data,
            'connections': connections or [],
            'metadata': metadata or {},
            'created_at': time.time()
        }
        
        self.graph.add_waypoint(waypoint)
        self.save_waypoints()
        
        return waypoint
    
    def plan_route(self, start_waypoint: str, destination_waypoint: str) -> Optional[Dict]:
        """
        Plan optimal route between two waypoints
        Returns navigation session data
        """
        result = self.graph.find_shortest_path(start_waypoint, destination_waypoint)
        
        if not result:
            return None
        
        path, total_distance, instructions = result
        
        # Generate detailed navigation session
        session = {
            'session_id': f"nav_{int(time.time())}_{self.user_id}",
            'user_id': self.user_id,
            'map_id': self.map_id,
            'start_waypoint': start_waypoint,
            'destination_waypoint': destination_waypoint,
            'planned_route': path,
            'instructions': instructions,
            'total_distance_steps': total_distance,
            'total_waypoints': len(path),
            'current_waypoint_index': 0,
            'status': 'planned',
            'created_at': time.time()
        }
        
        return session
    
    def get_current_instruction(self, session: Dict) -> str:
        """Get current navigation instruction based on progress"""
        current_index = session.get('current_waypoint_index', 0)
        instructions = session.get('instructions', [])
        
        if current_index < len(instructions):
            return instructions[current_index]
        elif current_index == len(instructions):
            return "You have arrived at your destination"
        else:
            return "Navigation complete"
    
    def advance_to_next_waypoint(self, session: Dict) -> Dict:
        """Move to next waypoint in route"""
        session['current_waypoint_index'] += 1
        
        if session['current_waypoint_index'] >= session['total_waypoints']:
            session['status'] = 'completed'
        else:
            session['status'] = 'in_progress'
        
        return session
    
    def get_waypoint_details(self, waypoint_id: str) -> Optional[Dict]:
        """Get full details of a waypoint"""
        return self.graph.waypoints.get(waypoint_id)
    
    def list_all_waypoints(self) -> List[Dict]:
        """List all waypoints in the map"""
        return list(self.graph.waypoints.values())
    
    def get_waypoints_by_type(self, waypoint_type: str) -> List[Dict]:
        """Get all waypoints of a specific type"""
        return [
            wp for wp in self.graph.waypoints.values()
            if wp.get('type') == waypoint_type
        ]


def create_haptic_pattern(pattern_type: str) -> Dict:
    """
    Generate haptic vibration patterns for different navigation events
    """
    patterns = {
        'correct_direction': {
            'pattern': [100],  # Single short pulse
            'description': 'Walking in correct direction'
        },
        'off_course': {
            'pattern': [100, 100, 100, 100],  # Two short pulses
            'description': 'Off course, adjust direction'
        },
        'turn_approaching': {
            'pattern': [100, 100, 100, 100, 100, 100],  # Three short pulses
            'description': 'Turn point approaching'
        },
        'turn_now': {
            'pattern': [500],  # Long pulse
            'description': 'Turn now'
        },
        'destination_reached': {
            'pattern': [200, 200, 200, 200, 200, 200, 200, 200],  # Four long pulses
            'description': 'Destination reached'
        },
        'obstacle_detected': {
            'pattern': [100, 50, 100, 50, 100, 50, 100],  # Rapid pulses
            'description': 'Obstacle ahead'
        }
    }
    
    return patterns.get(pattern_type, patterns['correct_direction'])


def generate_voice_guidance(
    instruction: str,
    distance_remaining: int,
    waypoint_type: str,
    position_confidence: float
) -> str:
    """
    Generate contextual voice guidance
    """
    confidence_phrase = ""
    if position_confidence < 0.7:
        confidence_phrase = "I'm not completely certain, but "
    
    distance_phrase = f"{distance_remaining} steps ahead" if distance_remaining > 5 else "just ahead"
    
    type_context = {
        WaypointType.CORNER: "There's a corner",
        WaypointType.DOOR: "There's a door",
        WaypointType.JUNCTION: "You're approaching an intersection",
        WaypointType.LANDMARK: "There's a landmark",
    }
    
    context = type_context.get(waypoint_type, "")
    
    guidance = f"{confidence_phrase}{instruction}. {context} {distance_phrase}."
    
    return guidance.strip()

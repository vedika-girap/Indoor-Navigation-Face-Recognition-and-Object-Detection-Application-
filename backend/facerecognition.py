import cv2
import face_recognition
import numpy as np
import os
import time

DATASET_DIR = "faces"
os.makedirs(DATASET_DIR, exist_ok=True)

known_face_encodings = []
known_face_names = []

# Cache for user faces with timestamp-based invalidation
_user_faces_cache = {}
_cache_ttl = 300  # Cache for 5 minutes

def _get_metadata_mtime(user_id: str) -> float:
    """Get modification time of user faces metadata file. Returns 0 if file doesn't exist."""
    try:
        metadata_file = os.path.join("user_faces_metadata", f"{user_id}_faces.json")
        if os.path.exists(metadata_file):
            return os.path.getmtime(metadata_file)
    except Exception as e:
        print(f"[WARNING] Error getting mtime for user {user_id}: {e}")
    return 0.0

def clear_user_faces_cache(user_id: str = None):
    """
    Clear the face cache for a specific user or all users.
    Call this when faces are added/updated/deleted.
    """
    global _user_faces_cache
    try:
        if user_id:
            if user_id in _user_faces_cache:
                del _user_faces_cache[user_id]
                print(f"[CACHE] Cleared cache for user {user_id}")
            else:
                print(f"[CACHE] No cache entry found for user {user_id}")
        else:
            _user_faces_cache.clear()
            print("[CACHE] Cleared all user faces cache")
    except Exception as e:
        print(f"[CACHE ERROR] Failed to clear cache: {e}")
        # Force clear the cache dictionary
        _user_faces_cache = {}

def load_faces():
    known_face_encodings.clear()
    known_face_names.clear()
    for filename in os.listdir(DATASET_DIR):
        if filename.endswith((".jpg", ".png", ".jpeg")):
            path = os.path.join(DATASET_DIR, filename)
            img = face_recognition.load_image_file(path)
            encodings = face_recognition.face_encodings(img)
            if encodings:
                known_face_encodings.append(encodings[0])
                known_face_names.append(os.path.splitext(filename)[0])

# Load existing faces on startup
load_faces()

def run_face_recognition(image_bytes: bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb_frame = np.ascontiguousarray(rgb_frame[:, :, :3], dtype=np.uint8)

    face_locations = face_recognition.face_locations(rgb_frame)
    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

    faces = []
    for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
        name = "Unknown"
        if known_face_encodings:
            matches = face_recognition.compare_faces(known_face_encodings, face_encoding)
            face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
            best_match_index = np.argmin(face_distances)
            if matches[best_match_index]:
                name = known_face_names[best_match_index]

        faces.append({
            "name": name,
            "bounding_box": [int(top), int(right), int(bottom), int(left)]
        })
        
    return {"faces": faces}

def save_new_face(image_bytes: bytes, bounding_box: list, label: str):
    """
    Saves the cropped face image with the given label into the dataset,
    updates known faces and labels.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    top, right, bottom, left = bounding_box
    # Ensure bounds are within image dimensions
    top, right, bottom, left = max(0, top), min(frame.shape[1], right), min(frame.shape[0], bottom), max(0, left)

    face_img = frame[top:bottom, left:right]
    if face_img.size == 0:
        raise ValueError("Empty face image cropped, check bounding box coordinates.")

    # Check if label already exists
    if label in known_face_names:
        # Update existing face instead of adding duplicate
        existing_index = known_face_names.index(label)
        
        # Save the new face image (overwrites old one)
        save_path = os.path.join(DATASET_DIR, f"{label}.jpg")
        cv2.imwrite(save_path, face_img)
        
        # Update the encoding
        new_img = face_recognition.load_image_file(save_path)
        encodings = face_recognition.face_encodings(new_img)
        if encodings:
            known_face_encodings[existing_index] = encodings[0]
            print(f"[INFO] Updated existing face for label '{label}'")
            return True
        else:
            print("[WARNING] Could not encode the updated face.")
            return False
    else:
        # Add new face
        save_path = os.path.join(DATASET_DIR, f"{label}.jpg")
        cv2.imwrite(save_path, face_img)

        # Encode & add to known faces
        new_img = face_recognition.load_image_file(save_path)
        encodings = face_recognition.face_encodings(new_img)
        if encodings:
            known_face_encodings.append(encodings[0])
            known_face_names.append(label)
            print(f"[INFO] Added new face with label '{label}'")
            return True
        else:
            print("[WARNING] Could not encode the new face, file not added.")
            return False


def load_user_faces(user_id: str):
    """
    Load face encodings from user-specific saved faces with caching.
    Returns: (encodings_list, names_list)
    """
    import json
    
    # Check cache first
    current_time = time.time()
    
    # Get metadata modification time (0 if file doesn't exist)
    try:
        metadata_mtime = _get_metadata_mtime(user_id)
    except Exception as e:
        print(f"[CACHE WARNING] Error checking metadata mtime: {e}")
        metadata_mtime = 0
    
    cache_key = user_id
    if cache_key in _user_faces_cache:
        try:
            cached_data = _user_faces_cache[cache_key]
            # Check if cache is still valid (not expired and metadata not modified)
            cache_age = current_time - cached_data.get('timestamp', 0)
            cache_mtime = cached_data.get('metadata_mtime', -1)
            
            if cache_age < _cache_ttl and cache_mtime == metadata_mtime:
                print(f"[CACHE HIT] Using cached faces for user {user_id} ({len(cached_data.get('encodings', []))} faces)")
                return cached_data.get('encodings', []), cached_data.get('names', [])
            else:
                print(f"[CACHE EXPIRED] Age: {cache_age:.1f}s, mtime changed: {cache_mtime != metadata_mtime}")
        except Exception as e:
            print(f"[CACHE ERROR] Failed to read cache for user {user_id}: {e}")
            # Clear corrupted cache entry
            if cache_key in _user_faces_cache:
                del _user_faces_cache[cache_key]
    
    # Cache miss or expired - load from disk
    print(f"[CACHE MISS] Loading faces from disk for user {user_id}")
    
    user_encodings = []
    user_names = []
    
    # Path to user faces metadata
    metadata_file = os.path.join("user_faces_metadata", f"{user_id}_faces.json")
    
    if not os.path.exists(metadata_file):
        print(f"[INFO] No saved faces found for user {user_id}")
        return user_encodings, user_names
    
    # Load metadata
    try:
        with open(metadata_file, 'r') as f:
            data = json.load(f)
        
        faces_list = data.get("faces", [])
        
        # Load each active face
        for face_data in faces_list:
            if not face_data.get("is_active", True):
                continue  # Skip inactive faces
            
            image_path = face_data.get("image_path")
            face_name = face_data.get("face_name")
            
            if not image_path or not os.path.exists(image_path):
                print(f"[WARNING] Image not found for {face_name}: {image_path}")
                continue
            
            # Load and encode the face
            try:
                img = face_recognition.load_image_file(image_path)
                encodings = face_recognition.face_encodings(img)
                
                if encodings:
                    user_encodings.append(encodings[0])
                    user_names.append(face_name)
                    print(f"[INFO] Loaded face: {face_name}")
                else:
                    print(f"[WARNING] No face encoding found in image for {face_name}")
            except Exception as e:
                print(f"[ERROR] Failed to load face {face_name}: {e}")
                continue
        
        print(f"[INFO] Loaded {len(user_encodings)} faces for user {user_id}")
        
        # Update cache with safe values
        try:
            _user_faces_cache[cache_key] = {
                'encodings': user_encodings.copy() if user_encodings else [],
                'names': user_names.copy() if user_names else [],
                'timestamp': current_time,
                'metadata_mtime': metadata_mtime
            }
            print(f"[CACHE] Updated cache for user {user_id}")
        except Exception as cache_err:
            print(f"[CACHE WARNING] Failed to update cache: {cache_err}")
        
    except Exception as e:
        print(f"[ERROR] Failed to load user faces metadata: {e}")
        import traceback
        traceback.print_exc()
    
    return user_encodings, user_names


def run_face_recognition_with_user_faces(image_bytes: bytes, user_id: str):
    """
    Recognize faces using user-specific saved faces.
    """
    # Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb_frame = np.ascontiguousarray(rgb_frame[:, :, :3], dtype=np.uint8)

    # Detect faces in the image FIRST - if no faces, skip loading encodings
    face_locations = face_recognition.face_locations(rgb_frame)
    
    # Early return if no faces detected - saves loading all face encodings
    if not face_locations:
        print(f"[OPTIMIZATION] No faces detected in image, skipping face loading for user {user_id}")
        return {"faces": []}
    
    # Only load user faces if we actually detected faces
    user_encodings, user_names = load_user_faces(user_id)
    
    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

    faces = []
    for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
        name = "Unknown"
        confidence = 0.0
        
        if user_encodings:
            # Compare with user's saved faces
            matches = face_recognition.compare_faces(user_encodings, face_encoding, tolerance=0.6)
            face_distances = face_recognition.face_distance(user_encodings, face_encoding)
            
            if len(face_distances) > 0:
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    name = user_names[best_match_index]
                    # Convert distance to confidence (lower distance = higher confidence)
                    confidence = 1.0 - face_distances[best_match_index]

        faces.append({
            "name": name,
            "bounding_box": [int(top), int(right), int(bottom), int(left)],
            "confidence": float(confidence) if name != "Unknown" else 0.0
        })
    
    return {"faces": faces}


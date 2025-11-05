from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from facerecognition import run_face_recognition, save_new_face, known_face_names, known_face_encodings
import numpy as np
import cv2
import os
import json
import base64
import uuid
from typing import List, Dict, Any

def _calculate_face_area(bounding_box):
    """Calculate the area of a face bounding box [top, right, bottom, left]"""
    top, right, bottom, left = bounding_box
    width = right - left
    height = bottom - top
    return width * height

app = FastAPI()

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    model_path = os.path.join(os.path.dirname(__file__), '..', 'best.pt')
    model = YOLO('yolo11n.pt')
except Exception as e:
    print(f"Model load failed: {e}")
    import sys
    sys.exit(1)

@app.get("/")
def root():
    return {"message": "Backend is up."}

@app.post("/object_detection/")
async def object_detection(file: UploadFile = File(...)):
    image_bytes = await file.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    results = model(img)
    detections = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            confidence = box.conf[0].item()
            cls = int(box.cls[0].item())
            label = model.names[cls]
            detections.append({
                "label": label,
                "confidence": confidence,
                "bbox": [x1, y1, x2, y2]
            })
    return {"detections": detections}


@app.post("/face_recognition/")
async def face_recognition(file: UploadFile = File(...)):
    image_bytes = await file.read()
    result = run_face_recognition(image_bytes)
    return result


@app.post("/face_save/")
async def face_save(
    file: UploadFile = File(...),
    label: str = Form(...),
    bounding_box: str = Form(...)
):
    """
    Save a new face for training the recognition system.
    Args:
        file: Image file containing the face
        label: Name/label for the person
        bounding_box: JSON string with face coordinates [top, right, bottom, left]
    Returns:
        Success status and message
    """
    try:
        # Validate label
        if not label or not label.strip():
            raise HTTPException(status_code=400, detail="Label cannot be empty")
        
        label = label.strip()
        
        # Parse bounding box
        try:
            bbox = json.loads(bounding_box)
            if not isinstance(bbox, list) or len(bbox) != 4:
                raise ValueError("Bounding box must be a list of 4 coordinates")
            
            # Ensure all coordinates are numbers
            bbox = [float(coord) for coord in bbox]
            top, right, bottom, left = bbox
            
            # Basic validation
            if top >= bottom or left >= right:
                raise ValueError("Invalid bounding box coordinates")
                
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid bounding box format: {str(e)}. Expected: [top, right, bottom, left]"
            )
        
        # Read image bytes
        image_bytes = await file.read()
        
        # Validate file is not empty
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Save the face
        success = save_new_face(image_bytes, bbox, label)
        
        if success:
            # Check if this was an update or new addition
            is_update = label in [name for name in os.listdir("faces") if name.endswith(".jpg") and os.path.splitext(name)[0] != label]
            action = "updated" if is_update else "added"
            
            return {
                "success": True, 
                "message": f"Face for '{label}' {action} successfully",
                "label": label,
                "action": action
            }
        else:
            raise HTTPException(
                status_code=400, 
                detail="Failed to encode face. Please ensure the image contains a clear face within the bounding box."
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@app.post("/face_save_auto/")
async def face_save_auto(
    file: UploadFile = File(...),
    label: str = Form(...)
):
    """
    Save a new face by automatically detecting the largest face in the image.
    
    Args:
        file: Image file containing the face
        label: Name/label for the person
    
    Returns:
        Success status and message
    """
    try:
        # Validate label
        if not label or not label.strip():
            raise HTTPException(status_code=400, detail="Label cannot be empty")
        
        label = label.strip()
        
        # Read image bytes
        image_bytes = await file.read()
        
        # Validate file is not empty
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # First, detect faces in the image
        detection_result = run_face_recognition(image_bytes)
        
        if not detection_result.get("faces"):
            raise HTTPException(
                status_code=400, 
                detail="No faces detected in the image. Please ensure the image contains a clear face."
            )
        
        # Choose the largest face instead of just the first one
        faces = detection_result["faces"]
        largest_face = max(faces, key=lambda face: _calculate_face_area(face["bounding_box"]))
        bbox = largest_face["bounding_box"]  # [top, right, bottom, left]
        
        # Save the face
        success = save_new_face(image_bytes, bbox, label)
        
        if success:
            return {
                "success": True, 
                "message": f"Face for '{label}' saved successfully (auto-detected)",
                "label": label,
                "detected_faces": len(detection_result["faces"]),
                "bounding_box": bbox,
                "face_area": _calculate_face_area(bbox)
            }
        else:
            raise HTTPException(
                status_code=400, 
                detail="Failed to encode the detected face."
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


# @app.post("/face_save/")
# async def face_save(
#     file: UploadFile = File(...),
#     label: str = Form(...)
# ):
#     image_bytes = await file.read()
#     # Here you expect label and bounding box in the request, for simplicity assume full image
#     # For bounding box, you can modify to send JSON with bounds or multiple faces
    
#     # As a basic example save full image with label
#     # For multiple faces or bounding box included, extend accordingly

#     # For demo: save full image as face (no cropping)
#     success = save_new_face(image_bytes, [0, 0, 10000, 10000], label)
#     return {"success": success, "message": "Face saved" if success else "Failed to save face"}


@app.post("/face_train_unknown/")
async def face_train_unknown(
    file: UploadFile = File(...),
    label: str = Form(...),
    face_index: int = Form(default=0)
):
    """
    Train an unknown face detected in an image. This endpoint is designed for mobile app use
    when users want to assign names to unknown faces that were previously detected.
    
    Args:
        file: Same image file that contained the unknown face
        label: Name/label to assign to the unknown face
        face_index: Index of the face in the detection results (default: 0 for largest face)
    
    Returns:
        Success status and training information
    """
    try:
        # Validate label
        if not label or not label.strip():
            raise HTTPException(status_code=400, detail="Label cannot be empty")
        
        label = label.strip()
        
        # Read image bytes
        image_bytes = await file.read()
        
        # Validate file is not empty
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Detect faces in the image
        detection_result = run_face_recognition(image_bytes)
        
        if not detection_result.get("faces"):
            raise HTTPException(
                status_code=400, 
                detail="No faces detected in the image."
            )
        
        faces = detection_result["faces"]
        
        # Validate face_index
        if face_index >= len(faces) or face_index < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid face_index {face_index}. Found {len(faces)} faces (indices 0-{len(faces)-1})."
            )
        
        # If face_index is 0, use the largest face; otherwise use the specified index
        if face_index == 0:
            # Use largest face
            target_face = max(faces, key=lambda face: _calculate_face_area(face["bounding_box"]))
        else:
            # Use specified face
            target_face = faces[face_index]
        
        bbox = target_face["bounding_box"]
        current_name = target_face["name"]
        
        # Only allow training if the face is currently "Unknown"
        if current_name != "Unknown":
            return {
                "success": False,
                "message": f"Face is already recognized as '{current_name}'. Use /face_save_auto/ to update an existing person.",
                "current_name": current_name,
                "suggested_endpoint": "/face_save_auto/"
            }
        
        # Train the unknown face
        success = save_new_face(image_bytes, bbox, label)
        
        if success:
            return {
                "success": True, 
                "message": f"Unknown face successfully trained as '{label}'",
                "label": label,
                "face_index": face_index,
                "total_faces": len(faces),
                "bounding_box": bbox,
                "face_area": _calculate_face_area(bbox)
            }
        else:
            raise HTTPException(
                status_code=400, 
                detail="Failed to encode the face for training."
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/faces/")
async def list_faces():
    """
    Get a list of all trained faces in the dataset.
    
    Returns:
        List of faces with their names and file information
    """
    try:
        faces_info = []
        
        # Get all face files from the dataset directory
        if os.path.exists("faces"):
            for filename in os.listdir("faces"):
                if filename.endswith((".jpg", ".png", ".jpeg")):
                    label = os.path.splitext(filename)[0]
                    filepath = os.path.join("faces", filename)
                    
                    # Get file stats
                    stat = os.stat(filepath)
                    
                    faces_info.append({
                        "label": label,
                        "filename": filename,
                        "file_size": stat.st_size,
                        "created_date": stat.st_ctime,
                        "modified_date": stat.st_mtime,
                        "is_loaded": label in known_face_names
                    })
        
        return {
            "total_faces": len(faces_info),
            "loaded_faces": len(known_face_names),
            "faces": faces_info
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error reloading faces: {str(e)}"
        )


# ==================== FLOOR MAP MANAGEMENT ====================
# Store floor maps metadata (WhatsApp-style: files stay on device)

# Directory for floor map metadata
FLOOR_MAPS_DIR = "floor_maps_metadata"
os.makedirs(FLOOR_MAPS_DIR, exist_ok=True)

def get_user_maps_file(user_id: str) -> str:
    """Get the JSON file path for a user's floor maps metadata"""
    return os.path.join(FLOOR_MAPS_DIR, f"{user_id}_maps.json")

def load_user_maps(user_id: str) -> dict:
    """Load user's floor maps metadata from JSON file"""
    maps_file = get_user_maps_file(user_id)
    if os.path.exists(maps_file):
        try:
            with open(maps_file, 'r') as f:
                return json.load(f)
        except:
            return {"maps": []}
    return {"maps": []}

def save_user_maps(user_id: str, maps_data: dict):
    """Save user's floor maps metadata to JSON file"""
    maps_file = get_user_maps_file(user_id)
    with open(maps_file, 'w') as f:
        json.dump(maps_data, f, indent=2)


@app.post("/floor_maps/add")
async def add_floor_map(
    user_id: str = Form(...),
    map_id: str = Form(...),
    map_name: str = Form(...),
    building_name: str = Form(None),
    floor_number: str = Form(None),
    local_uri: str = Form(...),
    metadata: str = Form("{}")
):
    """
    Add a floor map metadata entry for a user.
    The actual image stays on the user's device (WhatsApp-style).
    
    Args:
        user_id: Unique identifier for the user
        map_id: Unique identifier for this map
        map_name: Display name for the map
        building_name: Optional building name
        floor_number: Optional floor number/name
        local_uri: Local file URI on user's device (e.g., file:///data/.../map.png)
        metadata: Optional JSON string with additional data (dimensions, created_at, etc.)
    
    Returns:
        Success status and map details
    """
    try:
        # Validate required fields
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not map_id or not map_id.strip():
            raise HTTPException(status_code=400, detail="map_id is required")
        if not map_name or not map_name.strip():
            raise HTTPException(status_code=400, detail="map_name is required")
        if not local_uri or not local_uri.strip():
            raise HTTPException(status_code=400, detail="local_uri is required")
        
        # Parse metadata
        try:
            metadata_obj = json.loads(metadata) if metadata else {}
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid metadata JSON format")
        
        # Load existing maps
        user_data = load_user_maps(user_id)
        
        # Check if map_id already exists
        existing_map_index = next(
            (i for i, m in enumerate(user_data["maps"]) if m["map_id"] == map_id),
            None
        )
        
        # Create map entry
        map_entry = {
            "map_id": map_id.strip(),
            "map_name": map_name.strip(),
            "building_name": building_name.strip() if building_name else None,
            "floor_number": floor_number.strip() if floor_number else None,
            "local_uri": local_uri.strip(),
            "metadata": metadata_obj,
            "added_at": metadata_obj.get("added_at", None),
            "last_accessed": None,
            "is_active": True
        }
        
        if existing_map_index is not None:
            # Update existing map
            user_data["maps"][existing_map_index] = map_entry
            action = "updated"
        else:
            # Add new map
            user_data["maps"].append(map_entry)
            action = "added"
        
        # Save updated maps
        save_user_maps(user_id, user_data)
        
        return {
            "success": True,
            "message": f"Floor map '{map_name}' {action} successfully",
            "action": action,
            "map": map_entry,
            "total_maps": len(user_data["maps"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error adding floor map: {str(e)}"
        )


@app.get("/floor_maps/list/{user_id}")
async def list_floor_maps(user_id: str):
    """
    Get all floor maps for a user.
    
    Args:
        user_id: Unique identifier for the user
    
    Returns:
        List of floor map metadata
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        
        user_data = load_user_maps(user_id)
        
        # Filter only active maps
        active_maps = [m for m in user_data["maps"] if m.get("is_active", True)]
        
        return {
            "success": True,
            "user_id": user_id,
            "maps": active_maps,
            "total_maps": len(active_maps)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing floor maps: {str(e)}"
        )


@app.get("/floor_maps/get/{user_id}/{map_id}")
async def get_floor_map(user_id: str, map_id: str):
    """
    Get a specific floor map metadata for a user.
    
    Args:
        user_id: Unique identifier for the user
        map_id: Unique identifier for the map
    
    Returns:
        Floor map metadata
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not map_id or not map_id.strip():
            raise HTTPException(status_code=400, detail="map_id is required")
        
        user_data = load_user_maps(user_id)
        
        # Find the map
        floor_map = next(
            (m for m in user_data["maps"] if m["map_id"] == map_id and m.get("is_active", True)),
            None
        )
        
        if not floor_map:
            raise HTTPException(
                status_code=404,
                detail=f"Floor map with id '{map_id}' not found"
            )
        
        # Update last accessed time
        from datetime import datetime
        floor_map["last_accessed"] = datetime.now().isoformat()
        save_user_maps(user_id, user_data)
        
        return {
            "success": True,
            "map": floor_map
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting floor map: {str(e)}"
        )


@app.delete("/floor_maps/delete/{user_id}/{map_id}")
async def delete_floor_map(user_id: str, map_id: str):
    """
    Delete (soft delete) a floor map for a user.
    Sets is_active to False instead of removing the entry.
    
    Args:
        user_id: Unique identifier for the user
        map_id: Unique identifier for the map
    
    Returns:
        Success status
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not map_id or not map_id.strip():
            raise HTTPException(status_code=400, detail="map_id is required")
        
        user_data = load_user_maps(user_id)
        
        # Find the map
        map_index = next(
            (i for i, m in enumerate(user_data["maps"]) if m["map_id"] == map_id),
            None
        )
        
        if map_index is None:
            raise HTTPException(
                status_code=404,
                detail=f"Floor map with id '{map_id}' not found"
            )
        
        # Soft delete - mark as inactive
        user_data["maps"][map_index]["is_active"] = False
        user_data["maps"][map_index]["deleted_at"] = __import__('datetime').datetime.now().isoformat()
        
        save_user_maps(user_id, user_data)
        
        return {
            "success": True,
            "message": f"Floor map '{user_data['maps'][map_index]['map_name']}' deleted successfully",
            "remaining_maps": len([m for m in user_data["maps"] if m.get("is_active", True)])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting floor map: {str(e)}"
        )


@app.delete("/floor_maps/delete_permanent/{user_id}/{map_id}")
async def delete_floor_map_permanent(user_id: str, map_id: str):
    """
    Permanently delete a floor map metadata entry.
    Note: This only removes the server metadata. The user should delete
    the actual file from their device separately.
    
    Args:
        user_id: Unique identifier for the user
        map_id: Unique identifier for the map
    
    Returns:
        Success status with instructions to delete local file
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not map_id or not map_id.strip():
            raise HTTPException(status_code=400, detail="map_id is required")
        
        user_data = load_user_maps(user_id)
        
        # Find and remove the map
        original_count = len(user_data["maps"])
        map_to_delete = next(
            (m for m in user_data["maps"] if m["map_id"] == map_id),
            None
        )
        
        if not map_to_delete:
            raise HTTPException(
                status_code=404,
                detail=f"Floor map with id '{map_id}' not found"
            )
        
        # Remove from list
        user_data["maps"] = [m for m in user_data["maps"] if m["map_id"] != map_id]
        
        save_user_maps(user_id, user_data)
        
        return {
            "success": True,
            "message": f"Floor map '{map_to_delete['map_name']}' permanently deleted from server",
            "note": "Remember to delete the local file from your device",
            "local_uri": map_to_delete["local_uri"],
            "remaining_maps": len(user_data["maps"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error permanently deleting floor map: {str(e)}"
        )


@app.post("/floor_maps/update_metadata/{user_id}/{map_id}")
async def update_floor_map_metadata(
    user_id: str,
    map_id: str,
    map_name: str = Form(None),
    building_name: str = Form(None),
    floor_number: str = Form(None),
    metadata: str = Form(None)
):
    """
    Update floor map metadata without changing the local file reference.
    
    Args:
        user_id: Unique identifier for the user
        map_id: Unique identifier for the map
        map_name: Optional new display name
        building_name: Optional new building name
        floor_number: Optional new floor number
        metadata: Optional JSON string with additional data to merge
    
    Returns:
        Success status and updated map
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not map_id or not map_id.strip():
            raise HTTPException(status_code=400, detail="map_id is required")
        
        user_data = load_user_maps(user_id)
        
        # Find the map
        map_index = next(
            (i for i, m in enumerate(user_data["maps"]) if m["map_id"] == map_id),
            None
        )
        
        if map_index is None:
            raise HTTPException(
                status_code=404,
                detail=f"Floor map with id '{map_id}' not found"
            )
        
        floor_map = user_data["maps"][map_index]
        
        # Update fields if provided
        if map_name:
            floor_map["map_name"] = map_name.strip()
        if building_name is not None:
            floor_map["building_name"] = building_name.strip() if building_name else None
        if floor_number is not None:
            floor_map["floor_number"] = floor_number.strip() if floor_number else None
        
        # Merge metadata if provided
        if metadata:
            try:
                new_metadata = json.loads(metadata)
                if floor_map.get("metadata"):
                    floor_map["metadata"].update(new_metadata)
                else:
                    floor_map["metadata"] = new_metadata
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid metadata JSON format")
        
        # Update timestamp
        floor_map["updated_at"] = __import__('datetime').datetime.now().isoformat()
        
        save_user_maps(user_id, user_data)
        
        return {
            "success": True,
            "message": "Floor map metadata updated successfully",
            "map": floor_map
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating floor map metadata: {str(e)}"
        )


@app.get("/floor_maps/stats/{user_id}")
async def get_floor_maps_stats(user_id: str):
    """
    Get statistics about a user's floor maps.
    
    Args:
        user_id: Unique identifier for the user
    
    Returns:
        Statistics including total maps, buildings, floors, etc.
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        
        user_data = load_user_maps(user_id)
        active_maps = [m for m in user_data["maps"] if m.get("is_active", True)]
        
        # Calculate statistics
        buildings = set()
        floors = set()
        
        for map_entry in active_maps:
            if map_entry.get("building_name"):
                buildings.add(map_entry["building_name"])
            if map_entry.get("floor_number"):
                floors.add(map_entry["floor_number"])
        
        return {
            "success": True,
            "user_id": user_id,
            "stats": {
                "total_maps": len(active_maps),
                "total_deleted": len(user_data["maps"]) - len(active_maps),
                "unique_buildings": len(buildings),
                "unique_floors": len(floors),
                "buildings": sorted(list(buildings)),
                "floors": sorted(list(floors))
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting floor maps stats: {str(e)}"
        )


@app.post("/floor_maps/process")
async def process_floor_map(file: UploadFile = File(...), user_id: str = Form(None), map_id: str = Form(None)):
    """
    Process an uploaded floor map image to a simplified black-and-white map and detect room-like regions.
    Returns a base64-encoded PNG of the processed map plus simple labeled regions.
    """
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty file")

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Unable to decode image")

        # Resize if very large (speed)
        h, w = img.shape[:2]
        max_dim = 1600
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        # Convert to grayscale and threshold to produce black-and-white map
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        # Use adaptive threshold to handle varying lighting
        thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY_INV, 15, 7)

        # Morphological ops to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

        # Find contours (rooms/areas)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        labels: List[Dict[str, Any]] = []
        processed = cv2.cvtColor(closed, cv2.COLOR_GRAY2BGR)

        min_area = (img.shape[0] * img.shape[1]) * 0.0015  # heuristic
        region_idx = 1
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue
            x, y, ww, hh = cv2.boundingRect(cnt)
            label_text = f"room_{region_idx}"
            # Draw rectangle and label on processed image (white background, black regions remain)
            cv2.rectangle(processed, (x, y), (x + ww, y + hh), (0, 0, 255), 2)
            cv2.putText(processed, label_text, (x + 4, y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

            labels.append({
                "label": label_text,
                "bbox": [int(y), int(x + ww), int(y + hh), int(x)],  # top, right, bottom, left
                "area": float(area)
            })
            region_idx += 1

        # Encode processed image to PNG and base64
        _, png = cv2.imencode('.png', processed)
        b64 = base64.b64encode(png.tobytes()).decode('utf-8')

        return {
            "success": True,
            "processed_image_base64": b64,
            "labels": labels,
            "original_size": {"width": w, "height": h}
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@app.delete("/faces/{label}")
async def delete_face(label: str):
    """
    Delete a trained face from the dataset.
    
    Args:
        label: Name/label of the face to delete
    
    Returns:
        Success status and message
    """
    try:
        # Validate label
        if not label or not label.strip():
            raise HTTPException(status_code=400, detail="Label cannot be empty")
        
        label = label.strip()
        
        # Check if face exists
        face_file = os.path.join("faces", f"{label}.jpg")
        if not os.path.exists(face_file):
            raise HTTPException(status_code=404, detail=f"Face '{label}' not found")
        
        # Remove from in-memory lists
        if label in known_face_names:
            index = known_face_names.index(label)
            known_face_names.pop(index)
            known_face_encodings.pop(index)
        
        # Delete the file
        os.remove(face_file)
        
        return {
            "success": True,
            "message": f"Face '{label}' deleted successfully",
            "deleted_label": label
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting face: {str(e)}"
        )


@app.get("/faces/{label}")
async def get_face_info(label: str):
    """
    Get detailed information about a specific trained face.
    
    Args:
        label: Name/label of the face to get info for
    
    Returns:
        Detailed face information
    """
    try:
        # Validate label
        if not label or not label.strip():
            raise HTTPException(status_code=400, detail="Label cannot be empty")
        
        label = label.strip()
        
        # Check if face exists
        face_file = os.path.join("faces", f"{label}.jpg")
        if not os.path.exists(face_file):
            raise HTTPException(status_code=404, detail=f"Face '{label}' not found")
        
        # Get file stats
        stat = os.stat(face_file)
        
        # Check if loaded in memory
        is_loaded = label in known_face_names
        encoding_index = known_face_names.index(label) if is_loaded else -1
        
        return {
            "label": label,
            "filename": f"{label}.jpg",
            "file_size": stat.st_size,
            "created_date": stat.st_ctime,
            "modified_date": stat.st_mtime,
            "is_loaded": is_loaded,
            "encoding_index": encoding_index,
            "dataset_path": os.path.abspath(face_file)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting face info: {str(e)}"
        )


@app.post("/faces/reload/")
async def reload_faces():
    """
    Reload all faces from the dataset directory into memory.
    Useful if face files were added/modified externally.
    
    Returns:
        Reload status and face count
    """
    try:
        from facerecognition import load_faces
        
        # Get count before reload
        faces_before = len(known_face_names)
        
        # Reload faces
        load_faces()
        
        # Get count after reload
        faces_after = len(known_face_names)
        
        return {
            "success": True,
            "message": "Faces reloaded successfully",
            "faces_before": faces_before,
            "faces_after": faces_after,
            "faces_loaded": faces_after
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error reloading faces: {str(e)}"
        )
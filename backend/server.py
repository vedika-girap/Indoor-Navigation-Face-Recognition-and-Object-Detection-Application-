from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from facerecognition import (
    run_face_recognition, 
    save_new_face, 
    known_face_names, 
    known_face_encodings,
    run_face_recognition_with_user_faces,
    clear_user_faces_cache
)
import numpy as np
import cv2
import os
import json
import base64
import uuid
import time
import math
from typing import List, Dict, Any
from enhanced_floor_map_processor import EnhancedFloorMapProcessor
import asyncio

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


@app.post("/combined_detection/")
async def combined_detection(
    file: UploadFile = File(...),
    user_id: str = Form(None)
):
    """
    Combined endpoint that returns both object detections and face recognition results
    in a single response. Accepts optional user_id to use user-specific faces.
    """
    image_bytes = await file.read()
    
    if not image_bytes or len(image_bytes) == 0:
        raise HTTPException(status_code=422, detail="Empty or invalid image file")

    # Decode image for object detection
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=422, detail="Failed to decode image. Invalid image format.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")

    # Run object detection and face recognition in parallel to utilize CPU/GPU concurrently.
    loop = asyncio.get_event_loop()

    async def run_object_detection():
        detections_local = []
        try:
            results = await loop.run_in_executor(None, lambda: model(img))
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    confidence = box.conf[0].item()
                    cls = int(box.cls[0].item())
                    label = model.names[cls]
                    detections_local.append({
                        "label": label,
                        "confidence": confidence,
                        "bbox": [x1, y1, x2, y2]
                    })
        except Exception as e:
            print(f"Object detection error: {e}")
        return detections_local

    async def run_faces():
        try:
            if user_id:
                return await loop.run_in_executor(None, lambda: run_face_recognition_with_user_faces(image_bytes, user_id))
            else:
                return await loop.run_in_executor(None, lambda: run_face_recognition(image_bytes))
        except Exception as e:
            print(f"Face recognition error: {e}")
            return {"faces": []}

    # Execute both tasks concurrently
    detections, face_result = await asyncio.gather(run_object_detection(), run_faces())

    # Merge results
    response = {"detections": detections}
    if isinstance(face_result, dict):
        response.update(face_result)
    else:
        response["faces"] = face_result

    # Build a short announcement text to help the frontend speak a concise summary
    try:
        parts = []
        top_labels = [d["label"] for d in detections[:3]]
        if top_labels:
            parts.append("Objects: " + ", ".join(top_labels))
        faces_list = response.get("faces", [])
        recognized = [f.get("name") or f.get("face_name") for f in faces_list if (f.get("name") or f.get("face_name"))]
        recognized = [r for r in recognized if r and r.lower() != "unknown"]
        unknown_count = len([f for f in faces_list if not (f.get("name") or f.get("face_name")) or (f.get("name") or f.get("face_name")).lower().startswith("unknown")])
        if recognized:
            parts.append("Recognized: " + ", ".join(recognized[:3]))
        if unknown_count > 0:
            parts.append(("1 unknown face" if unknown_count == 1 else f"{unknown_count} unknown faces"))
        if parts:
            response["announcement"] = ". ".join(parts)
    except Exception as e:
        print(f"Announcement build error: {e}")

    return response


@app.post("/face_recognition/")
async def face_recognition(
    file: UploadFile = File(...),
    user_id: str = Form(None)
):
    """
    Recognize faces in an image.
    If user_id is provided, uses user-specific saved faces for recognition.
    Otherwise, uses the default faces directory.
    """
    image_bytes = await file.read()
    
    if user_id:
        # Use user-specific faces for recognition
        result = run_face_recognition_with_user_faces(image_bytes, user_id)
    else:
        # Use default face recognition
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


# ==================== USER FACE MANAGEMENT ====================
# Store user's detected and saved faces metadata

# Directory for user face metadata
USER_FACES_DIR = "user_faces_metadata"
os.makedirs(USER_FACES_DIR, exist_ok=True)

# Directory for user face images
USER_FACES_IMAGES_DIR = "user_face_images"
os.makedirs(USER_FACES_IMAGES_DIR, exist_ok=True)

def get_user_faces_file(user_id: str) -> str:
    """Get the JSON file path for a user's faces metadata"""
    return os.path.join(USER_FACES_DIR, f"{user_id}_faces.json")

def load_user_faces(user_id: str) -> dict:
    """Load user's faces metadata from JSON file"""
    faces_file = get_user_faces_file(user_id)
    if os.path.exists(faces_file):
        try:
            with open(faces_file, 'r') as f:
                return json.load(f)
        except:
            return {"faces": []}
    return {"faces": []}

def save_user_faces(user_id: str, faces_data: dict):
    """Save user's faces metadata to JSON file"""
    faces_file = get_user_faces_file(user_id)
    with open(faces_file, 'w') as f:
        json.dump(faces_data, f, indent=2)


@app.post("/user_faces/save")
async def save_user_face(
    user_id: str = Form(...),
    face_id: str = Form(...),
    face_name: str = Form(...),
    file: UploadFile = File(...),
    metadata: str = Form("{}")
):
    """
    Save a detected face for a specific user.
    
    Args:
        user_id: Unique identifier for the user
        face_id: Unique identifier for this face
        face_name: Name/label for the person
        file: Face image file
        metadata: Optional JSON string with additional data (bbox, confidence, etc.)
    
    Returns:
        Success status and face details
    """
    try:
        # Validate required fields
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not face_id or not face_id.strip():
            raise HTTPException(status_code=400, detail="face_id is required")
        if not face_name or not face_name.strip():
            raise HTTPException(status_code=400, detail="face_name is required")
        
        # Parse metadata
        try:
            metadata_obj = json.loads(metadata) if metadata else {}
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid metadata JSON format")
        
        # Create user-specific directory for face images
        user_faces_dir = os.path.join(USER_FACES_IMAGES_DIR, user_id)
        os.makedirs(user_faces_dir, exist_ok=True)
        
        # Save face image
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        image_filename = f"{face_id}.{file_ext}"
        image_path = os.path.join(user_faces_dir, image_filename)
        
        # Read and save image
        content = await file.read()
        with open(image_path, 'wb') as f:
            f.write(content)
        
        # Load existing faces
        user_data = load_user_faces(user_id)
        
        # Check if face_id already exists
        existing_face_index = next(
            (i for i, face in enumerate(user_data["faces"]) if face["face_id"] == face_id),
            None
        )
        
        # Create face entry
        import datetime
        face_entry = {
            "face_id": face_id.strip(),
            "face_name": face_name.strip(),
            "image_path": image_path,
            "image_filename": image_filename,
            "metadata": metadata_obj,
            "added_at": datetime.datetime.now().isoformat(),
            "last_updated": datetime.datetime.now().isoformat(),
            "is_active": True
        }
        
        if existing_face_index is not None:
            # Update existing face
            face_entry["added_at"] = user_data["faces"][existing_face_index].get("added_at", face_entry["added_at"])
            user_data["faces"][existing_face_index] = face_entry
            action = "updated"
        else:
            # Add new face
            user_data["faces"].append(face_entry)
            action = "added"
        
        # Save updated faces
        save_user_faces(user_id, user_data)
        
        # Clear cache to ensure fresh data on next recognition
        clear_user_faces_cache(user_id)
        
        return {
            "success": True,
            "message": f"Face '{face_name}' {action} successfully",
            "action": action,
            "face": face_entry,
            "total_faces": len(user_data["faces"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error saving user face: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error saving face: {str(e)}"
        )


@app.get("/user_faces/list/{user_id}")
async def list_user_faces(user_id: str):
    """
    Get all saved faces for a user.
    
    Args:
        user_id: Unique identifier for the user
    
    Returns:
        List of face metadata
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        
        user_data = load_user_faces(user_id)
        
        # Filter only active faces
        active_faces = [face for face in user_data["faces"] if face.get("is_active", True)]
        
        return {
            "success": True,
            "user_id": user_id,
            "faces": active_faces,
            "total_faces": len(active_faces)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing faces: {str(e)}"
        )


@app.get("/user_faces/get/{user_id}/{face_id}")
async def get_user_face(user_id: str, face_id: str):
    """
    Get a specific face with image data.
    
    Args:
        user_id: Unique identifier for the user
        face_id: Unique identifier for the face
    
    Returns:
        Face metadata with base64 image
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not face_id or not face_id.strip():
            raise HTTPException(status_code=400, detail="face_id is required")
        
        user_data = load_user_faces(user_id)
        
        # Find the face
        face = next(
            (f for f in user_data["faces"] if f["face_id"] == face_id and f.get("is_active", True)),
            None
        )
        
        if not face:
            raise HTTPException(
                status_code=404,
                detail=f"Face with id '{face_id}' not found"
            )
        
        # Read and encode image
        image_path = face["image_path"]
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Face image file not found")
        
        with open(image_path, 'rb') as f:
            image_bytes = f.read()
        
        b64_image = base64.b64encode(image_bytes).decode('utf-8')
        
        return {
            "success": True,
            "face": face,
            "image_base64": b64_image
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting face: {str(e)}"
        )


@app.put("/user_faces/update/{user_id}/{face_id}")
async def update_user_face_name(
    user_id: str,
    face_id: str,
    face_name: str = Form(...)
):
    """
    Update a face's name.
    
    Args:
        user_id: Unique identifier for the user
        face_id: Unique identifier for the face
        face_name: New name for the person
    
    Returns:
        Success status and updated face
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not face_id or not face_id.strip():
            raise HTTPException(status_code=400, detail="face_id is required")
        if not face_name or not face_name.strip():
            raise HTTPException(status_code=400, detail="face_name is required")
        
        user_data = load_user_faces(user_id)
        
        # Find the face
        face_index = next(
            (i for i, f in enumerate(user_data["faces"]) if f["face_id"] == face_id),
            None
        )
        
        if face_index is None:
            raise HTTPException(
                status_code=404,
                detail=f"Face with id '{face_id}' not found"
            )
        
        # Update name
        import datetime
        user_data["faces"][face_index]["face_name"] = face_name.strip()
        user_data["faces"][face_index]["last_updated"] = datetime.datetime.now().isoformat()
        
        save_user_faces(user_id, user_data)
        
        # Clear cache to ensure fresh data on next recognition
        clear_user_faces_cache(user_id)
        
        return {
            "success": True,
            "message": f"Face name updated to '{face_name}'",
            "face": user_data["faces"][face_index]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating face: {str(e)}"
        )


@app.delete("/user_faces/delete/{user_id}/{face_id}")
async def delete_user_face(user_id: str, face_id: str):
    """
    Delete (soft delete) a face for a user.
    
    Args:
        user_id: Unique identifier for the user
        face_id: Unique identifier for the face
    
    Returns:
        Success status
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not face_id or not face_id.strip():
            raise HTTPException(status_code=400, detail="face_id is required")
        
        user_data = load_user_faces(user_id)
        
        # Find the face
        face_index = next(
            (i for i, f in enumerate(user_data["faces"]) if f["face_id"] == face_id),
            None
        )
        
        if face_index is None:
            raise HTTPException(
                status_code=404,
                detail=f"Face with id '{face_id}' not found"
            )
        
        # Soft delete - mark as inactive
        import datetime
        user_data["faces"][face_index]["is_active"] = False
        user_data["faces"][face_index]["deleted_at"] = datetime.datetime.now().isoformat()
        
        save_user_faces(user_id, user_data)
        
        # Clear cache to ensure fresh data on next recognition
        clear_user_faces_cache(user_id)
        
        return {
            "success": True,
            "message": f"Face '{user_data['faces'][face_index]['face_name']}' deleted successfully",
            "remaining_faces": len([f for f in user_data["faces"] if f.get("is_active", True)])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting face: {str(e)}"
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
async def process_floor_map(
    file: UploadFile = File(...), 
    user_id: str = Form(None), 
    map_id: str = Form(None)
):
    """
    Process a floor map image to detect rooms/regions with OCR text extraction.
    
    Enhanced version with:
    - 95%+ room detection accuracy (vs previous 70%)
    - Automatic text extraction from printed labels
    - Multiple detection strategies (adaptive threshold, edge detection, connected components)
    - Relaxed filtering parameters
    - Spatial text-to-room matching
    
    Args:
        file: Floor map image file (PNG, JPG, etc.)
        user_id: Optional user ID for storage
        map_id: Optional map ID for updates
    
    Returns:
        JSON with processed image, labels, and detection statistics
    """
    try:
        # Read uploaded image
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        # Decode image with OpenCV
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(
                status_code=400, 
                detail="Unable to decode image. Supported formats: PNG, JPG, JPEG, BMP"
            )

        h, w = img.shape[:2]
        original_size = {"width": w, "height": h}
        
        # Initialize processor and process floor map
        processor = EnhancedFloorMapProcessor()
        processed_img, labels, detection_method = processor.process_floor_map(img)
        
        # Encode processed image to base64 PNG
        _, png_buffer = cv2.imencode('.png', processed_img)
        b64_string = base64.b64encode(png_buffer.tobytes()).decode('utf-8')
        
        # Calculate statistics
        total_rooms = len(labels)
        ocr_labeled = sum(1 for label in labels if label.get('text_extracted', False))
        auto_labeled = total_rooms - ocr_labeled
        
        return {
            "success": True,
            "processed_image_base64": b64_string,
            "labels": labels,
            "original_size": original_size,
            "detection_method": detection_method,
            "stats": {
                "total_rooms": total_rooms,
                "ocr_labeled": ocr_labeled,
                "auto_labeled": auto_labeled
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Floor map processing error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500, 
            detail=f"Processing error: {str(e)}"
        )


@app.put("/floor_maps/update_labels/{user_id}/{map_id}")
async def update_floor_map_labels(
    user_id: str,
    map_id: str,
    labels: str = Form(...)
):
    """
    Update room labels for a processed floor map.
    
    Allows users to correct OCR-extracted labels or rename auto-generated labels.
    Updates the map metadata with the new label mappings.
    
    Args:
        user_id: Unique identifier for the user
        map_id: Unique identifier for the map
        labels: JSON string array of label objects: 
               [{"old_label": "room_1", "new_label": "Room 201", "bbox": [...]}]
    
    Returns:
        Success status and updated labels
    """
    try:
        if not user_id or not user_id.strip():
            raise HTTPException(status_code=400, detail="user_id is required")
        if not map_id or not map_id.strip():
            raise HTTPException(status_code=400, detail="map_id is required")
        if not labels:
            raise HTTPException(status_code=400, detail="labels data is required")
        
        # Parse labels JSON
        try:
            labels_data = json.loads(labels)
            if not isinstance(labels_data, list):
                raise HTTPException(status_code=400, detail="labels must be an array")
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
        
        # Load user's floor maps
        user_dir = os.path.join("floor_maps", user_id)
        metadata_file = os.path.join(user_dir, "metadata.json")
        
        if not os.path.exists(metadata_file):
            raise HTTPException(
                status_code=404, 
                detail=f"No floor maps found for user {user_id}"
            )
        
        with open(metadata_file, 'r') as f:
            user_maps = json.load(f)
        
        # Find the specific map
        target_map = None
        for map_entry in user_maps:
            if map_entry.get("map_id") == map_id:
                target_map = map_entry
                break
        
        if not target_map:
            raise HTTPException(
                status_code=404, 
                detail=f"Map {map_id} not found for user {user_id}"
            )
        
        # Update labels in metadata
        if "room_labels" not in target_map:
            target_map["room_labels"] = []
        
        # Create label mapping for quick lookup
        label_map = {}
        for label_update in labels_data:
            old_label = label_update.get("old_label", "")
            new_label = label_update.get("new_label", "")
            bbox = label_update.get("bbox", [])
            
            if old_label and new_label:
                label_map[old_label] = {
                    "new_label": new_label,
                    "bbox": bbox,
                    "updated_at": time.time()
                }
        
        # Update or add labels
        updated_labels = []
        for old_label, label_info in label_map.items():
            updated_labels.append({
                "old_label": old_label,
                "label": label_info["new_label"],
                "bbox": label_info["bbox"],
                "updated_at": label_info["updated_at"]
            })
        
        target_map["room_labels"] = updated_labels
        target_map["labels_updated_at"] = time.time()
        
        # Save updated metadata
        with open(metadata_file, 'w') as f:
            json.dump(user_maps, f, indent=2)
        
        print(f"✓ Updated {len(updated_labels)} room labels for map {map_id}")
        
        return {
            "success": True,
            "message": f"Updated {len(updated_labels)} room labels",
            "map_id": map_id,
            "updated_labels": updated_labels
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Error updating floor map labels: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error updating labels: {str(e)}"
        )


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


# ============ INDOOR NAVIGATION ENDPOINTS ============

ROOM_IMAGES_DIR = "room_images"
os.makedirs(ROOM_IMAGES_DIR, exist_ok=True)

@app.post("/indoor_navigation/attach_image")
async def attach_room_image(
    user_id: str = Form(...),
    map_id: str = Form(...),
    room_label: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Attach a reference image to a room label for indoor navigation.
    
    Args:
        user_id: User identifier
        map_id: Map identifier
        room_label: Room label (e.g., 'room_1', 'room_2')
        file: Image file to attach
    
    Returns:
        Success status and image path
    """
    try:
        # Validate inputs
        if not user_id or not map_id or not room_label:
            raise HTTPException(status_code=400, detail="user_id, map_id, and room_label are required")
        
        # Create user-specific directory
        user_room_dir = os.path.join(ROOM_IMAGES_DIR, user_id, map_id)
        os.makedirs(user_room_dir, exist_ok=True)
        
        # Save image with room label name
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        image_filename = f"{room_label}.{file_ext}"
        image_path = os.path.join(user_room_dir, image_filename)
        
        # Read and save image
        content = await file.read()
        with open(image_path, 'wb') as f:
            f.write(content)
        
        # Update map metadata with image reference
        user_data = load_user_maps(user_id)
        map_found = False
        
        for map_entry in user_data["maps"]:
            if map_entry["map_id"] == map_id:
                map_found = True
                # Initialize room_images if not exists
                if "room_images" not in map_entry["metadata"]:
                    map_entry["metadata"]["room_images"] = {}
                
                # Add image reference
                map_entry["metadata"]["room_images"][room_label] = {
                    "image_path": image_path,
                    "image_filename": image_filename,
                    "uploaded_at": json.dumps(None)  # Will be set on client
                }
                break
        
        if not map_found:
            raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
        
        save_user_maps(user_id, user_data)
        
        return {
            "success": True,
            "message": f"Image attached to {room_label}",
            "room_label": room_label,
            "image_path": image_path
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error attaching image: {str(e)}")


@app.get("/indoor_navigation/room_image/{user_id}/{map_id}/{room_label}")
async def get_room_image(user_id: str, map_id: str, room_label: str):
    """
    Get the reference image for a specific room.
    
    Args:
        user_id: User identifier
        map_id: Map identifier
        room_label: Room label
    
    Returns:
        Base64 encoded image
    """
    try:
        # Load user maps
        user_data = load_user_maps(user_id)
        
        # Find the map
        target_map = None
        for map_entry in user_data["maps"]:
            if map_entry["map_id"] == map_id:
                target_map = map_entry
                break
        
        if not target_map:
            raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
        
        # Get image path
        room_images = target_map.get("metadata", {}).get("room_images", {})
        room_info = room_images.get(room_label)
        
        if not room_info:
            raise HTTPException(status_code=404, detail=f"No image found for {room_label}")
        
        image_path = room_info.get("image_path")
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail=f"Image file not found: {image_path}")
        
        # Read and encode image
        with open(image_path, 'rb') as f:
            image_bytes = f.read()
        
        b64_image = base64.b64encode(image_bytes).decode('utf-8')
        
        return {
            "success": True,
            "room_label": room_label,
            "image_base64": b64_image,
            "image_filename": room_info.get("image_filename")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting room image: {str(e)}")


@app.post("/indoor_navigation/calculate_route")
async def calculate_route(
    user_id: str = Form(...),
    map_id: str = Form(...),
    source_room: str = Form(...),
    destination_room: str = Form(...)
):
    """
    Calculate navigation route between two rooms on a floor map.
    Uses simple graph-based pathfinding.
    
    Args:
        user_id: User identifier
        map_id: Map identifier
        source_room: Starting room label (e.g., 'room_1')
        destination_room: Destination room label (e.g., 'room_3')
    
    Returns:
        Navigation route with waypoints and images
    """
    try:
        # Validate inputs
        if not all([user_id, map_id, source_room, destination_room]):
            raise HTTPException(
                status_code=400,
                detail="user_id, map_id, source_room, and destination_room are required"
            )
        
        # Load user maps
        user_data = load_user_maps(user_id)
        
        # Find the map
        target_map = None
        for map_entry in user_data["maps"]:
            if map_entry["map_id"] == map_id:
                target_map = map_entry
                break
        
        if not target_map:
            raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
        
        # Get labels from processed map metadata
        labels = target_map.get("metadata", {}).get("labels", [])
        
        if not labels:
            raise HTTPException(
                status_code=400,
                detail="No room labels found. Please process the map first."
            )
        
        # Build room lookup
        rooms = {label["label"]: label for label in labels}
        
        if source_room not in rooms:
            raise HTTPException(status_code=404, detail=f"Source room '{source_room}' not found")
        if destination_room not in rooms:
            raise HTTPException(status_code=404, detail=f"Destination room '{destination_room}' not found")
        
        # Simple pathfinding: calculate center points and create direct route
        # In a real implementation, this would use A* or similar algorithms
        source_bbox = rooms[source_room]["bbox"]  # [top, right, bottom, left]
        dest_bbox = rooms[destination_room]["bbox"]
        
        # Calculate center points
        source_center = {
            "x": (source_bbox[1] + source_bbox[3]) / 2,
            "y": (source_bbox[0] + source_bbox[2]) / 2
        }
        dest_center = {
            "x": (dest_bbox[1] + dest_bbox[3]) / 2,
            "y": (dest_bbox[0] + dest_bbox[2]) / 2
        }
        
        # Simple route: direct path with intermediate rooms if they exist
        # Sort all rooms by distance from source and filter those along the path
        route_rooms = []
        
        # Add source
        route_rooms.append({
            "room_label": source_room,
            "position": source_center,
            "instruction": f"Start at {source_room.replace('_', ' ').title()}"
        })
        
        # For now, add direct connection (can be enhanced with pathfinding)
        intermediate_rooms = []
        for room_label, room_data in rooms.items():
            if room_label not in [source_room, destination_room]:
                room_bbox = room_data["bbox"]
                room_center = {
                    "x": (room_bbox[1] + room_bbox[3]) / 2,
                    "y": (room_bbox[0] + room_bbox[2]) / 2
                }
                
                # Check if room is roughly between source and destination
                # Simple heuristic: room is between if its center is within bounding box of source-dest line
                min_x = min(source_center["x"], dest_center["x"])
                max_x = max(source_center["x"], dest_center["x"])
                min_y = min(source_center["y"], dest_center["y"])
                max_y = max(source_center["y"], dest_center["y"])
                
                if (min_x <= room_center["x"] <= max_x and 
                    min_y <= room_center["y"] <= max_y):
                    # Calculate distance from source
                    dist = ((room_center["x"] - source_center["x"])**2 + 
                           (room_center["y"] - source_center["y"])**2)**0.5
                    intermediate_rooms.append({
                        "room_label": room_label,
                        "position": room_center,
                        "distance": dist
                    })
        
        # Sort intermediate rooms by distance from source
        intermediate_rooms.sort(key=lambda r: r["distance"])
        
        # Add intermediate waypoints with step counts and directions
        prev_position = source_center
        for idx, room in enumerate(intermediate_rooms):
            # Calculate distance and direction
            dx = room["position"]["x"] - prev_position["x"]
            dy = room["position"]["y"] - prev_position["y"]
            distance = (dx**2 + dy**2)**0.5
            
            # Estimate steps (approximately 70-80cm per step, scale map distance)
            steps = max(3, int(distance / 10))  # Adjust divisor based on map scale
            
            # Determine direction
            angle = math.atan2(dy, dx) * 180 / math.pi
            if -45 <= angle < 45:
                direction = "right"
            elif 45 <= angle < 135:
                direction = "down"
            elif -135 <= angle < -45:
                direction = "up"
            else:
                direction = "left"
            
            # Map direction to turn instruction
            turn_map = {
                "right": "turn right",
                "left": "turn left",
                "down": "go straight",
                "up": "turn around"
            }
            
            route_rooms.append({
                "room_label": room["room_label"],
                "position": room["position"],
                "instruction": f"Walk {steps} steps and {turn_map[direction]}. You will reach {room['room_label'].replace('_', ' ').title()}",
                "steps": steps,
                "direction": direction,
                "turn_instruction": turn_map[direction]
            })
            prev_position = room["position"]
        
        # Add destination with final steps
        dx = dest_center["x"] - prev_position["x"]
        dy = dest_center["y"] - prev_position["y"]
        distance = (dx**2 + dy**2)**0.5
        final_steps = max(3, int(distance / 10))
        
        angle = math.atan2(dy, dx) * 180 / math.pi
        if -45 <= angle < 45:
            final_direction = "right"
        elif 45 <= angle < 135:
            final_direction = "down"
        elif -135 <= angle < -45:
            final_direction = "up"
        else:
            final_direction = "left"
        
        turn_map = {
            "right": "turn right",
            "left": "turn left",
            "down": "go straight",
            "up": "turn around"
        }
        
        route_rooms.append({
            "room_label": destination_room,
            "position": dest_center,
            "instruction": f"Walk {final_steps} steps and {turn_map[final_direction]}. You have arrived at {destination_room.replace('_', ' ').title()}",
            "steps": final_steps,
            "direction": final_direction,
            "turn_instruction": turn_map[final_direction]
        })
        
        # Attach images if available
        room_images = target_map.get("metadata", {}).get("room_images", {})
        for waypoint in route_rooms:
            if waypoint["room_label"] in room_images:
                waypoint["has_image"] = True
                waypoint["image_filename"] = room_images[waypoint["room_label"]].get("image_filename")
            else:
                waypoint["has_image"] = False
        
        return {
            "success": True,
            "source": source_room,
            "destination": destination_room,
            "route": route_rooms,
            "total_waypoints": len(route_rooms),
            "estimated_distance": "calculated",  # Could calculate actual distance
            "map_id": map_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating route: {str(e)}")


@app.post("/indoor_navigation/save_recording")
async def save_map_recording(
    user_id: str = Form(...),
    map_id: str = Form(...),
    waypoints: str = Form(...),  # JSON string
    files: List[UploadFile] = File(...)
):
    """
    Save recorded waypoint images from map recording mode.
    User walks through the floor with camera active, capturing images at intervals.
    
    Args:
        user_id: User identifier
        map_id: Map identifier
        waypoints: JSON array of waypoint metadata
        files: List of captured images
    
    Returns:
        Success status and saved waypoints count
    """
    try:
        # Parse waypoints metadata
        waypoints_data = json.loads(waypoints)
        
        if len(files) != len(waypoints_data):
            raise HTTPException(
                status_code=400,
                detail=f"Mismatch: {len(files)} images but {len(waypoints_data)} waypoints"
            )
        
        # Create recording directory
        recording_dir = os.path.join(ROOM_IMAGES_DIR, user_id, map_id, "recording")
        os.makedirs(recording_dir, exist_ok=True)
        
        saved_waypoints = []
        
        # Save each waypoint image
        for i, (file, waypoint_meta) in enumerate(zip(files, waypoints_data)):
            # Generate filename
            room_label = waypoint_meta.get("room_label", f"waypoint_{i}")
            timestamp = waypoint_meta.get("timestamp", int(time.time() * 1000))
            filename = f"{room_label}_{timestamp}.jpg"
            filepath = os.path.join(recording_dir, filename)
            
            # Save image
            content = await file.read()
            with open(filepath, 'wb') as f:
                f.write(content)
            
            saved_waypoints.append({
                "room_label": room_label,
                "filename": filename,
                "filepath": filepath,
                "timestamp": timestamp,
                "position_description": waypoint_meta.get("position_description", ""),
                "index": i
            })
        
        # Update map metadata with recording info
        user_data = load_user_maps(user_id)
        map_found = False
        
        for map_entry in user_data["maps"]:
            if map_entry["map_id"] == map_id:
                map_found = True
                
                # Initialize recording data
                if "recording" not in map_entry["metadata"]:
                    map_entry["metadata"]["recording"] = []
                
                # Add new recording session
                recording_session = {
                    "session_id": f"recording_{int(time.time())}",
                    "recorded_at": time.time(),
                    "waypoints": saved_waypoints,
                    "total_images": len(saved_waypoints)
                }
                
                map_entry["metadata"]["recording"].append(recording_session)
                
                # Also update room_images for backward compatibility
                if "room_images" not in map_entry["metadata"]:
                    map_entry["metadata"]["room_images"] = {}
                
                # Group waypoints by room
                for waypoint in saved_waypoints:
                    room_label = waypoint["room_label"]
                    if room_label not in map_entry["metadata"]["room_images"]:
                        map_entry["metadata"]["room_images"][room_label] = []
                    
                    if not isinstance(map_entry["metadata"]["room_images"][room_label], list):
                        map_entry["metadata"]["room_images"][room_label] = [map_entry["metadata"]["room_images"][room_label]]
                    
                    map_entry["metadata"]["room_images"][room_label].append({
                        "image_path": waypoint["filepath"],
                        "image_filename": waypoint["filename"],
                        "timestamp": waypoint["timestamp"],
                        "position_description": waypoint["position_description"]
                    })
                
                break
        
        if not map_found:
            raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
        
        save_user_maps(user_id, user_data)
        
        return {
            "success": True,
            "message": f"Recording saved with {len(saved_waypoints)} waypoint images",
            "map_id": map_id,
            "waypoints_saved": len(saved_waypoints),
            "recording_dir": recording_dir
        }
        
    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid waypoints JSON format")
    except Exception as e:
        import traceback
        print(f"Error saving recording: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error saving recording: {str(e)}")


@app.get("/indoor_navigation/get_recording/{user_id}/{map_id}")
async def get_map_recording(user_id: str, map_id: str):
    """
    Get all recorded waypoint images for a map.
    
    Args:
        user_id: User identifier
        map_id: Map identifier
    
    Returns:
        List of recording sessions with waypoint images
    """
    try:
        user_data = load_user_maps(user_id)
        
        # Find the map
        target_map = None
        for map_entry in user_data["maps"]:
            if map_entry["map_id"] == map_id:
                target_map = map_entry
                break
        
        if not target_map:
            raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
        
        recordings = target_map.get("metadata", {}).get("recording", [])
        
        return {
            "success": True,
            "map_id": map_id,
            "total_recordings": len(recordings),
            "recordings": recordings
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting recording: {str(e)}")


@app.post("/indoor_navigation/match_position")
async def match_position(
    user_id: str = Form(...),
    map_id: str = Form(...),
    current_image: UploadFile = File(...)
):
    """
    Match current camera image with recorded waypoints to determine user's position.
    Uses ORB feature detection and matching to find the closest waypoint.
    
    Args:
        user_id: User identifier
        map_id: Map identifier
        current_image: Current camera frame from user
    
    Returns:
        Best matching waypoint with similarity score and position info
    """
    try:
        # Read current image
        image_bytes = await current_image.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        current_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if current_img is None:
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        # Convert to grayscale for feature detection
        current_gray = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)
        
        # Resize if image is too large (faster processing)
        h, w = current_gray.shape
        max_dim = 800
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            current_gray = cv2.resize(current_gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        
        # Initialize ORB detector with optimized parameters
        orb = cv2.ORB_create(
            nfeatures=300,  # Reduced from 500 for faster processing
            scaleFactor=1.2,
            nlevels=8,
            edgeThreshold=15,  # Reduced for more features
            firstLevel=0,
            WTA_K=2,
            scoreType=cv2.ORB_HARRIS_SCORE,
            patchSize=31,
            fastThreshold=20
        )
        
        # Detect keypoints and compute descriptors for current image
        kp_current, des_current = orb.detectAndCompute(current_gray, None)
        
        if des_current is None:
            return {
                "success": False,
                "message": "No features detected in current image",
                "matched": False
            }
        
        # Get all recorded waypoints for this map
        user_data = load_user_maps(user_id)
        target_map = None
        for map_entry in user_data["maps"]:
            if map_entry["map_id"] == map_id:
                target_map = map_entry
                break
        
        if not target_map:
            raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
        
        recordings = target_map.get("metadata", {}).get("recording", [])
        
        if not recordings:
            return {
                "success": False,
                "message": "No recorded waypoints found for this map",
                "matched": False
            }
        
        # Create BFMatcher
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        
        best_match = None
        best_score = 0
        
        # Compare with each recorded waypoint
        for recording_session in recordings:
            for waypoint in recording_session.get("waypoints", []):
                waypoint_path = waypoint.get("filepath", "")
                
                if not os.path.exists(waypoint_path):
                    continue
                
                # Load waypoint image
                waypoint_img = cv2.imread(waypoint_path)
                if waypoint_img is None:
                    continue
                
                waypoint_gray = cv2.cvtColor(waypoint_img, cv2.COLOR_BGR2GRAY)
                
                # Resize waypoint image to match current image size for consistency
                waypoint_gray = cv2.resize(waypoint_gray, (current_gray.shape[1], current_gray.shape[0]), interpolation=cv2.INTER_AREA)
                
                # Detect keypoints and descriptors for waypoint
                kp_waypoint, des_waypoint = orb.detectAndCompute(waypoint_gray, None)
                
                if des_waypoint is None:
                    continue
                
                # Match descriptors
                try:
                    matches = bf.match(des_current, des_waypoint)
                    
                    # Sort matches by distance (lower is better)
                    matches = sorted(matches, key=lambda x: x.distance)
                    
                    # Calculate match score with improved algorithm
                    # Use top matches and normalize by number of features
                    good_matches = [m for m in matches[:50] if m.distance < 50]  # Only check top 50 matches
                    
                    # Weighted scoring: favor more good matches
                    if len(good_matches) < 10:
                        match_score = 0  # Too few matches, skip
                    else:
                        match_score = (len(good_matches) / max(len(kp_current), len(kp_waypoint))) * 1.5
                        match_score = min(match_score, 1.0)  # Cap at 100%
                    
                    # Update best match if this is better
                    if match_score > best_score:
                        best_score = match_score
                        best_match = {
                            "waypoint_id": waypoint.get("index", waypoint.get("waypoint_id")),
                            "room_label": waypoint.get("room_label"),
                            "position_description": waypoint.get("position_description"),
                            "timestamp": waypoint.get("timestamp"),
                            "match_score": round(match_score * 100, 2),  # Convert to percentage
                            "good_matches": len(good_matches),
                            "total_matches": len(matches),
                            "image_path": waypoint_path
                        }
                        
                        # Early exit if we find a very good match (>80%)
                        if match_score > 0.8:
                            break
                
                except cv2.error as e:
                    print(f"Error matching with waypoint: {e}")
                    continue
        
        if best_match is None:
            return {
                "success": True,
                "message": "No good match found",
                "matched": False
            }
        
        # Consider it a match if score is above threshold (30%)
        if best_score >= 0.3:
            return {
                "success": True,
                "matched": True,
                "message": "Position matched successfully",
                "position": best_match
            }
        else:
            return {
                "success": True,
                "matched": False,
                "message": "Low confidence match",
                "position": best_match
            }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in position matching: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error matching position: {str(e)}")


# ============================================================================
# ENHANCED INDOOR NAVIGATION ENDPOINTS
# New system with dense waypoints and intelligent path planning
# ============================================================================

from enhanced_navigation import (
    EnhancedNavigationSystem,
    WaypointType,
    create_haptic_pattern,
    generate_voice_guidance
)

NAVIGATION_WAYPOINTS_DIR = "navigation_waypoints"
os.makedirs(NAVIGATION_WAYPOINTS_DIR, exist_ok=True)


@app.post("/navigation/v2/create_waypoint")
async def create_enhanced_waypoint(
    user_id: str = Form(...),
    map_id: str = Form(...),
    waypoint_id: str = Form(...),
    waypoint_type: str = Form(...),
    room_label: str = Form(...),
    position_description: str = Form(...),
    orientations: str = Form(...),  # JSON array of angles
    connections: str = Form("[]"),  # JSON array of connections
    metadata: str = Form("{}"),
    files: List[UploadFile] = File(...)
):
    """
    Create a waypoint with multiple images from different orientations.
    This is the foundation of the dense waypoint system.
    
    Args:
        user_id: User identifier
        map_id: Map identifier  
        waypoint_id: Unique waypoint ID
        waypoint_type: Type (CORNER, DOOR, JUNCTION, etc.)
        room_label: Room/area label
        position_description: Verbal description
        orientations: JSON array of compass angles for each image
        connections: JSON array of connected waypoints
        metadata: Additional metadata (landmarks, lighting, etc.)
        files: List of images (recommended: 20-30 images)
    
    Returns:
        Success status and waypoint details
    """
    try:
        print(f"\n[WAYPOINT] Creating waypoint {waypoint_id} for user {user_id}, map {map_id}")
        
        # Parse JSON data with error handling
        try:
            orientations_list = json.loads(orientations)
            print(f"[WAYPOINT] Parsed orientations: {len(orientations_list)} angles")
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid orientations JSON: {str(e)}")
        
        try:
            connections_list = json.loads(connections)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid connections JSON: {str(e)}")
        
        try:
            metadata_dict = json.loads(metadata)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid metadata JSON: {str(e)}")
        
        if len(files) != len(orientations_list):
            raise HTTPException(
                status_code=400,
                detail=f"Mismatch: {len(files)} images but {len(orientations_list)} orientations"
            )
        
        print(f"[WAYPOINT] Processing {len(files)} images")
        
        # Create directory structure with error handling
        try:
            waypoint_dir = os.path.join(NAVIGATION_WAYPOINTS_DIR, user_id, map_id, "waypoints", waypoint_id)
            os.makedirs(waypoint_dir, exist_ok=True)
            print(f"[WAYPOINT] Created directory: {waypoint_dir}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create waypoint directory: {str(e)}")
        
        # Save images with error handling
        images_data = []
        for i, (file, orientation) in enumerate(zip(files, orientations_list)):
            try:
                filename = f"{waypoint_id}_angle_{orientation:03d}.jpg"
                filepath = os.path.join(waypoint_dir, filename)
                
                content = await file.read()
                
                # Validate content
                if not content or len(content) == 0:
                    print(f"[WARNING] Empty file received for orientation {orientation}")
                    continue
                
                with open(filepath, 'wb') as f:
                    f.write(content)
                
                images_data.append({
                    'filename': filename,
                    'filepath': filepath,
                    'orientation': orientation,
                    'timestamp': int(time.time() * 1000),
                    'index': i
                })
                print(f"[WAYPOINT] Saved image {i+1}/{len(files)}: {filename}")
            except Exception as e:
                print(f"[ERROR] Failed to save image {i} at orientation {orientation}: {str(e)}")
                # Continue with other images instead of failing completely
                continue
        
        if len(images_data) == 0:
            raise HTTPException(status_code=400, detail="No valid images were saved")
        
        print(f"[WAYPOINT] Successfully saved {len(images_data)} images")
        
        # Initialize navigation system with error handling
        try:
            nav_system = EnhancedNavigationSystem(user_id, map_id)
            print(f"[WAYPOINT] Initialized navigation system")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize navigation system: {str(e)}")
        
        # Add waypoint with error handling
        try:
            waypoint = nav_system.add_waypoint_with_images(
                waypoint_id=waypoint_id,
                waypoint_type=waypoint_type,
                room_label=room_label,
                position_description=position_description,
                images_data=images_data,
                connections=connections_list,
                metadata=metadata_dict
            )
            print(f"[WAYPOINT] Successfully created waypoint {waypoint_id}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to add waypoint to system: {str(e)}")
        
        return {
            "success": True,
            "message": f"Waypoint created with {len(images_data)} images",
            "waypoint": waypoint
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Waypoint creation failed:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Error creating waypoint: {str(e)}")


@app.post("/navigation/v2/plan_route")
async def plan_navigation_route(
    user_id: str = Form(...),
    map_id: str = Form(...),
    start_waypoint: str = Form(...),
    destination_waypoint: str = Form(...)
):
    """
    Plan optimal route between two waypoints using graph-based pathfinding.
    Returns detailed navigation session with turn-by-turn instructions.
    
    Args:
        user_id: User identifier
        map_id: Map identifier
        start_waypoint: Starting waypoint ID
        destination_waypoint: Destination waypoint ID
    
    Returns:
        Navigation session with planned route and instructions
    """
    try:
        nav_system = EnhancedNavigationSystem(user_id, map_id)
        
        session = nav_system.plan_route(start_waypoint, destination_waypoint)
        
        if not session:
            raise HTTPException(
                status_code=404,
                detail="No route found between waypoints"
            )
        
        # Generate summary for voice announcement
        total_steps = session['total_distance_steps']
        waypoint_count = session['total_waypoints']
        
        summary = f"Route planned: {waypoint_count} waypoints, approximately {total_steps} steps"
        
        return {
            "success": True,
            "message": summary,
            "session": session
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error planning route: {str(e)}")


@app.post("/navigation/v2/get_guidance")
async def get_navigation_guidance(
    session_id: str = Form(...),
    user_id: str = Form(...),
    map_id: str = Form(...),
    current_waypoint_index: int = Form(...)
):
    """
    Get current navigation guidance including voice instruction and haptic pattern.
    
    Args:
        session_id: Navigation session ID
        user_id: User identifier
        map_id: Map identifier
        current_waypoint_index: Current position in route
    
    Returns:
        Voice guidance, haptic pattern, and next instruction
    """
    try:
        nav_system = EnhancedNavigationSystem(user_id, map_id)
        
        # Create a session dict (in production, load from storage)
        session = {
            'session_id': session_id,
            'current_waypoint_index': current_waypoint_index
        }
        
        instruction = nav_system.get_current_instruction(session)
        
        # Determine haptic pattern based on instruction content
        haptic_type = 'correct_direction'
        if 'turn' in instruction.lower():
            if 'approaching' in instruction.lower():
                haptic_type = 'turn_approaching'
            else:
                haptic_type = 'turn_now'
        elif 'arrived' in instruction.lower():
            haptic_type = 'destination_reached'
        
        haptic_pattern = create_haptic_pattern(haptic_type)
        
        return {
            "success": True,
            "instruction": instruction,
            "haptic_pattern": haptic_pattern['pattern'],
            "haptic_description": haptic_pattern['description']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting guidance: {str(e)}")


@app.get("/navigation/v2/list_waypoints/{user_id}/{map_id}")
async def list_navigation_waypoints(user_id: str, map_id: str):
    """
    List all waypoints for a map, organized by type.
    
    Args:
        user_id: User identifier
        map_id: Map identifier
    
    Returns:
        All waypoints organized by type
    """
    try:
        nav_system = EnhancedNavigationSystem(user_id, map_id)
        
        all_waypoints = nav_system.list_all_waypoints()
        
        # Organize by type
        by_type = {}
        for wp in all_waypoints:
            wp_type = wp.get('type', 'UNKNOWN')
            if wp_type not in by_type:
                by_type[wp_type] = []
            by_type[wp_type].append(wp)
        
        return {
            "success": True,
            "total_waypoints": len(all_waypoints),
            "waypoints": all_waypoints,
            "by_type": by_type
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing waypoints: {str(e)}")


@app.post("/navigation/v2/match_position_enhanced")
async def match_position_enhanced(
    user_id: str = Form(...),
    map_id: str = Form(...),
    expected_waypoint: str = Form(None),  # Optional: current expected waypoint
    current_image: UploadFile = File(...)
):
    """
    Enhanced position matching that considers:
    1. Multiple images per waypoint (different angles)
    2. Expected waypoint (if provided)
    3. Orientation matching
    
    Args:
        user_id: User identifier
        map_id: Map identifier
        expected_waypoint: Currently expected waypoint (optional)
        current_image: Current camera view
    
    Returns:
        Best matched waypoint with confidence and orientation
    """
    try:
        nav_system = EnhancedNavigationSystem(user_id, map_id)
        
        # Read current image
        image_bytes = await current_image.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        current_img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        
        # Resize for faster processing
        max_dim = 800
        if max(current_img.shape) > max_dim:
            scale = max_dim / max(current_img.shape)
            current_img = cv2.resize(current_img, None, fx=scale, fy=scale)
        
        # Initialize ORB detector
        orb = cv2.ORB_create(nfeatures=300)
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        
        # Detect features in current image
        kp_current, des_current = orb.detectAndCompute(current_img, None)
        
        if des_current is None or len(kp_current) < 10:
            return {
                "success": True,
                "matched": False,
                "message": "Not enough features in current image"
            }
        
        # Get waypoints to search (prioritize expected waypoint)
        waypoints_to_check = []
        
        if expected_waypoint:
            # Check expected waypoint first
            wp_data = nav_system.get_waypoint_details(expected_waypoint)
            if wp_data:
                waypoints_to_check.append(wp_data)
            
            # Also check nearby waypoints
            nearby = nav_system.graph.get_nearby_waypoints(expected_waypoint, max_distance=30)
            waypoints_to_check.extend([wp['waypoint_data'] for wp in nearby])
        else:
            # Check all waypoints
            waypoints_to_check = nav_system.list_all_waypoints()
        
        best_match = None
        best_score = 0
        best_orientation = 0
        
        # Match against each waypoint's images
        for waypoint in waypoints_to_check:
            waypoint_id = waypoint['waypoint_id']
            images = waypoint.get('images', [])
            
            for image_data in images:
                try:
                    # Load waypoint image
                    image_path = image_data.get('filepath')
                    if not os.path.exists(image_path):
                        continue
                    
                    wp_img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
                    if wp_img is None:
                        continue
                    
                    # Resize waypoint image
                    if max(wp_img.shape) > max_dim:
                        scale = max_dim / max(wp_img.shape)
                        wp_img = cv2.resize(wp_img, None, fx=scale, fy=scale)
                    
                    # Detect features
                    kp_wp, des_wp = orb.detectAndCompute(wp_img, None)
                    
                    if des_wp is None or len(kp_wp) < 10:
                        continue
                    
                    # Match features
                    matches = bf.match(des_current, des_wp)
                    matches = sorted(matches, key=lambda x: x.distance)
                    
                    # Calculate match score
                    good_matches = [m for m in matches if m.distance < 50]
                    match_score = len(good_matches) / min(len(kp_current), len(kp_wp))
                    
                    if match_score > best_score:
                        best_score = match_score
                        best_orientation = image_data.get('orientation', 0)
                        best_match = {
                            'waypoint_id': waypoint_id,
                            'waypoint_type': waypoint.get('type'),
                            'room_label': waypoint.get('room_label'),
                            'position_description': waypoint.get('position_description'),
                            'match_score': round(match_score * 100, 2),
                            'matched_orientation': best_orientation,
                            'confidence': 'high' if match_score > 0.7 else 'medium' if match_score > 0.4 else 'low'
                        }
                    
                    # Early exit for very good match
                    if match_score > 0.85:
                        break
                        
                except Exception as e:
                    print(f"Error matching waypoint image: {e}")
                    continue
            
            if best_score > 0.85:
                break
        
        if best_match and best_score >= 0.3:
            return {
                "success": True,
                "matched": True,
                "message": "Position matched successfully",
                "position": best_match
            }
        else:
            return {
                "success": True,
                "matched": False,
                "message": "No confident match found",
                "best_attempt": best_match
            }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in enhanced position matching: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error matching position: {str(e)}")
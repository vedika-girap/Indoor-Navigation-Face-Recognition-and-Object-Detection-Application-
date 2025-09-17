from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from facerecognition import run_face_recognition, save_new_face, known_face_names, known_face_encodings
import numpy as np
import cv2
import os
import json

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
    model = YOLO('best.pt')
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
            detail=f"Error retrieving faces: {str(e)}"
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
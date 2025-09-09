from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import numpy as np
import cv2
import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from facerecognition import run_face_recognition, save_new_face
import numpy as np

from facerecognition import run_face_recognition  # import the face detection logic

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
    model = YOLO(model_path)
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
    label: str = Form(...)
):
    image_bytes = await file.read()
    # Here you expect label and bounding box in the request, for simplicity assume full image
    # For bounding box, you can modify to send JSON with bounds or multiple faces
    
    # As a basic example save full image with label
    # For multiple faces or bounding box included, extend accordingly

    # For demo: save full image as face (no cropping)
    success = save_new_face(image_bytes, [0, 0, 10000, 10000], label)
    return {"success": success, "message": "Face saved" if success else "Failed to save face"}
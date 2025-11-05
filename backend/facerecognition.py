import cv2
import face_recognition
import numpy as np
import os

DATASET_DIR = "faces"
os.makedirs(DATASET_DIR, exist_ok=True)

known_face_encodings = []
known_face_names = []

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



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

    # Filepath to save new face
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


# edit:Refactor your face detection code to work with image bytes input
#this is prev code
# import cv2
# import face_recognition
# import numpy as np
# import os
# # Folder to store faces
# DATASET_DIR = "faces"
# os.makedirs(DATASET_DIR, exist_ok=True)
# # Known face encodings and names
# known_face_encodings = []
# known_face_names = []
# # Load existing faces
# def load_faces():
#     for filename in os.listdir(DATASET_DIR):
#         if filename.endswith((".jpg", ".png", ".jpeg")):
#             path = os.path.join(DATASET_DIR, filename)
#             img = face_recognition.load_image_file(path)
#             encodings = face_recognition.face_encodings(img)
#             if len(encodings) > 0:
#                 known_face_encodings.append(encodings[0])
#                 name = os.path.splitext(filename)[0]
#                 known_face_names.append(name)
#                 print(f"[INFO] Loaded: {name}")
# load_faces()
# video_capture = cv2.VideoCapture(0)
# print("[INFO] Starting camera... Press 'q' to quit")
# while True:
#     ret, frame = video_capture.read()
#     if not ret:
#         print("[ERROR] Failed to grab frame")
#         break
#     rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#     rgb_frame = np.ascontiguousarray(rgb_frame[:, :, :3], dtype=np.uint8)
#     face_locations = face_recognition.face_locations(rgb_frame)
#     face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
#     for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
#         name = "Unknown"
#         if len(known_face_encodings) > 0:
#             matches = face_recognition.compare_faces(known_face_encodings, face_encoding)
#             face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
#             best_match_index = np.argmin(face_distances)
#             if matches[best_match_index]:
#                 name = known_face_names[best_match_index]
#         # If unknown, ask user for name
#         if name == "Unknown":
#             face_img = frame[top:bottom, left:right]
#             if face_img.size > 0:
#                 cv2.imshow("Unknown Face", face_img)
#                 new_name = input("Enter name for the new face (or leave empty to skip): ").strip()
#                 cv2.destroyWindow("Unknown Face")
#                 if new_name != "":
#                     # Save new face
#                     filename = f"{new_name}.jpg"
#                     filepath = os.path.join(DATASET_DIR, filename)
#                     cv2.imwrite(filepath, face_img)
#                     # Encode and add to known faces
#                     new_image = face_recognition.load_image_file(filepath)
#                     encodings = face_recognition.face_encodings(new_image)
#                     if len(encodings) > 0:
#                         known_face_encodings.append(encodings[0])
#                         known_face_names.append(new_name)
#                         name = new_name
#                         print(f"[INFO] Added new face: {new_name}")
#                     else:
#                         print("[WARNING] Could not encode the face, skipping.")
#         # Draw rectangle & label
#         cv2.rectangle(frame, (left, top), (right, bottom), (0, 0, 255), 2)
#         cv2.rectangle(frame, (left, bottom - 35), (right, bottom), (0, 0, 255), cv2.FILLED)
#         cv2.putText(frame, name, (left + 6, bottom - 6),
#                     cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 1)
#     cv2.imshow("Face Recognition", frame)
#     if cv2.waitKey(1) & 0xFF == ord('q'):
#         break
# video_capture.release()
# cv2.destroyAllWindows()
import cv2
from ultralytics import YOLO
from gtts import gTTS
import os
import playsound

# Load YOLO11n model
model = YOLO("yolo11n.pt")   # or "best.pt" if you trained your own

# Open webcam
cap = cv2.VideoCapture(0)

last_said = ""  # to avoid repeating same announcement

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Run YOLO prediction
    results = model(frame)

    detected_objects = []

    for r in results:
        boxes = r.boxes
        for box in boxes:
            cls_id = int(box.cls[0])
            class_name = model.names[cls_id]
            conf = float(box.conf[0])
            detected_objects.append(class_name)

    # Speak if a new object appears
    if detected_objects:
        current_objects = ", ".join(set(detected_objects))
        if current_objects != last_said:
            text = f"{current_objects} is detected"
            tts = gTTS(text=text, lang="en")
            tts.save("detected.mp3")
            playsound.playsound("detected.mp3")
            last_said = current_objects

    # Plot results on frame
    annotated_frame = results[0].plot()

    # Show frame
    cv2.imshow("YOLO11n Detection", annotated_frame)

    # Quit with 'q'
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()

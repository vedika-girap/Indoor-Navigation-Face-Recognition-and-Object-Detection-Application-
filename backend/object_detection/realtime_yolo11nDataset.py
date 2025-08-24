import cv2
from ultralytics import YOLO

# Load your YOLO11n model (pretrained weights)
model = YOLO("best.pt")   # replace with your fine-tuned best.pt if available

# Open webcam (0 = default camera)
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Run YOLO prediction
    results = model(frame)

    # Plot results on frame
    annotated_frame = results[0].plot()

    # Show frame
    cv2.imshow("YOLO11n Detection", annotated_frame)

    # Quit with 'q'
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()



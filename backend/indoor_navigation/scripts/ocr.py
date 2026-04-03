import cv2
import pytesseract
import json
import os

# Ensure data folder exists
os.makedirs("data", exist_ok=True)

# Load image
img = cv2.imread("assets/floor-2nd-mod-2.png")
if img is None:
    raise FileNotFoundError("❌ Image not found. Check the path!")

# Convert to HSV to detect yellow
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lower_yellow = (20, 100, 100)
upper_yellow = (35, 255, 255)
mask = cv2.inRange(hsv, lower_yellow, upper_yellow)

# Find contours of yellow regions
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

custom_config = r'--oem 3 --psm 6'
detected = []

print("Detected Rooms/Classes:\n")
for cnt in contours:
    x, y, w, h = cv2.boundingRect(cnt)

    roi = img[y:y+h, x:x+w]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)

    text = pytesseract.image_to_string(thresh, config=custom_config).strip()

    if text:
        cx, cy = x + w // 2, y + h // 2  # Center of the yellow box
        detected.append({
            "name": text,
            "x": int(cx),
            "y": int(cy)
        })
        print(f"{text} -> ({cx}, {cy})")

# ✅ Save full details into labels.json
with open("data/labels.json", "w") as f:
    json.dump(detected, f, indent=2)

# ✅ Save only names into labeles.json
with open("data/selected_points.json", "w") as f:
    json.dump([d["name"] for d in detected], f, indent=2)

print("\n✅ Saved detected rooms with coordinates to data/labels.json")
print("✅ Saved only names to data/labels.json")

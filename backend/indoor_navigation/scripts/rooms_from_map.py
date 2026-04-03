import cv2
import pytesseract

MAP_PATH = "assets/floor-2nd-mod.png"

# If Tesseract not in PATH, set it explicitly (adjust path as needed):
# pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def extract_rooms():
    img = cv2.imread(MAP_PATH)
    if img is None:
        raise FileNotFoundError(f"❌ Could not load {MAP_PATH}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # OCR with bounding boxes
    data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)

    rooms = {}
    n_boxes = len(data['level'])
    for i in range(n_boxes):
        text = data['text'][i].strip()
        if text and len(text) > 2:  # filter out noise
            (x, y, w, h) = (data['left'][i], data['top'][i], data['width'][i], data['height'][i])
            center = (x + w // 2, y + h // 2)
            rooms[text] = center

            # Optional: visualize
            cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(img, text, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

    # Preview detected rooms
    cv2.imshow("OCR Rooms", img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    return rooms

if __name__ == "__main__":
    rooms = extract_rooms()
    print("Detected rooms:", rooms)

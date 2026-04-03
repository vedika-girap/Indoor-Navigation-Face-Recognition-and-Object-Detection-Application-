Day 1
Set up your development environment. 1 opencv 2 numpy
Step 1 – Install Required Tools
•	Python: The brain of the project, to run code.
•	pip: Package installer (used to install other libraries).
•	NumPy: Helps in handling pixel data and mathematical operations.
•	OpenCV: Helps in image loading, editing, and drawing shapes on the floor plan.

1.import cv2: Loads the OpenCV library.
2.cv2.imread(...): Reads the PNG image as pixel data.
3.if floor_plan is None: Checks if the file was found (prevents crash).
4.floor_plan.shape: Tells us (height, width, channels) of the image.
5.cv2.imshow(...): Opens a window to display the floor plan.
6.cv2.waitKey(0): Waits until you press any key to close the window.
7.cv2.destroyAllWindows(): Closes the OpenCV window.

* That means your floor plan’s scale is:
1 pixel = 0.02032 meters (≈ 2 cm)
Or 1 meter ≈ 49.2 pixels







import cv2
import numpy as np
from collections import deque
import math
from skimage.morphology import skeletonize

# ============ CONFIG ============
MAP_PATH = r"assets\floor-2nd-mod.png"
PIXEL_TO_METER = 0.05
# ================================

# Load map
img = cv2.imread(MAP_PATH, cv2.IMREAD_GRAYSCALE)
if img is None:
    raise FileNotFoundError(f"❌ Could not load {MAP_PATH}")

# Binary (1 = path, 0 = wall)
_, binary = cv2.threshold(img, 200, 1, cv2.THRESH_BINARY)

# --- Step 1: skeletonize the map to get corridor centerlines ---
skeleton = skeletonize(binary).astype(np.uint8)

h, w = skeleton.shape
visited = np.zeros((h, w), dtype=bool)

# Moves
moves = [(-1, 0), (1, 0), (0, -1), (0, 1),
         (-1, -1), (-1, 1), (1, -1), (1, 1)]

# BFS
def bfs(start, end, graph):
    queue = deque([(start, [start])])
    visited[start[1], start[0]] = True

    while queue:
        (x, y), path = queue.popleft()

        if (x, y) == end:
            return path

        for dx, dy in moves:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and graph[ny, nx] == 1:
                visited[ny, nx] = True
                queue.append(((nx, ny), path + [(nx, ny)]))
    return None

# Mouse clicks
points = []
def select_points(event, x, y, flags, param):
    global points
    if event == cv2.EVENT_LBUTTONDOWN:
        points.append((x, y))
        color = (0, 255, 0) if len(points) == 1 else (255, 0, 0)
        cv2.circle(display_img, (x, y), 5, color, -1)
        cv2.imshow("Select Points", display_img)

display_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
cv2.imshow("Select Points", display_img)
cv2.setMouseCallback("Select Points", select_points)

print("🖱 Click once for SOURCE, then again for DESTINATION")
cv2.waitKey(0)
cv2.destroyAllWindows()

if len(points) < 2:
    raise ValueError("⚠ Need 2 clicks: source and destination")

# Snap clicks to nearest skeleton pixel
def snap_to_skeleton(pt, skel):
    x, y = pt
    mask = np.argwhere(skel == 1)
    dists = np.linalg.norm(mask - np.array([y, x]), axis=1)
    ny, nx = mask[np.argmin(dists)]
    return (nx, ny)

SOURCE = snap_to_skeleton(points[0], skeleton)
DESTINATION = snap_to_skeleton(points[1], skeleton)

print(f"Source snapped to {SOURCE}, Destination snapped to {DESTINATION}")

visited = np.zeros((h, w), dtype=bool)
path = bfs(SOURCE, DESTINATION, skeleton)

if path is None:
    print("⚠ No path found!")
    exit()

# Distance
distance_pixels = sum(math.dist(path[i-1], path[i]) for i in range(1, len(path)))
distance_meters = distance_pixels * PIXEL_TO_METER
print(f"✅ Shortest Distance: {distance_meters:.2f} meters")

# Draw path
output = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for i in range(1, len(path)):
    cv2.arrowedLine(output, path[i-1], path[i], (0,0,255), 2, tipLength=0.5)

cv2.circle(output, SOURCE, 5, (0,255,0), -1)
cv2.circle(output, DESTINATION, 5, (255,0,0), -1)

cv2.imshow("Indoor Navigation - Centerline Path", output)
cv2.waitKey(0)
cv2.destroyAllWindows()

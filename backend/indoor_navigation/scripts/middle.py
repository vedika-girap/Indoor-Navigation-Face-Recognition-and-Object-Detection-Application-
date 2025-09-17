import json
import cv2
import numpy as np
import math
import heapq
import os
from skimage.morphology import skeletonize

# ============ CONFIG ============
MAP_PATH = r"assets\floor-2nd-mod.png"
PIXEL_TO_METER = 0.05
LABELS_JSON = r"data\labels.json"
POINTS_JSON = r"data\selected_points.json"
OUTPUT_PATH = r"data\path_result.png"
OBSTACLE_MARGIN = 7  # pixels to keep away from walls
# ================================

# Ensure data folder exists
os.makedirs("data", exist_ok=True)

# Load map
img = cv2.imread(MAP_PATH, cv2.IMREAD_GRAYSCALE)
if img is None:
    raise FileNotFoundError(f" Could not load {MAP_PATH}")

# Binary walkable map
_, binary = cv2.threshold(img, 200, 1, cv2.THRESH_BINARY)
walkable = binary.astype(np.uint8)

# Dilate to fill small gaps
for _ in range(5):
    walkable = cv2.dilate(walkable, np.ones((3,3), np.uint8), iterations=1)

# Inflate obstacles to keep path away from walls
walkable_inflated = cv2.erode(walkable, np.ones((OBSTACLE_MARGIN, OBSTACLE_MARGIN), np.uint8), iterations=1)

h, w = walkable.shape

# -------- Skeletonization (center of corridors) --------
skeleton = skeletonize(walkable_inflated > 0).astype(np.uint8)

# -------- A* Algorithm on Skeleton --------
moves = [(-1, 0), (1, 0), (0, -1), (0, 1),
         (-1, -1), (-1, 1), (1, -1), (1, 1)]

def astar_on_skeleton(start, end, graph):
    open_set = []
    heapq.heappush(open_set, (0 + math.dist(start, end), 0, start, [start]))
    visited = np.zeros_like(graph, dtype=bool)

    while open_set:
        f, g, current, path = heapq.heappop(open_set)
        x, y = current
        if visited[y, x]:
            continue
        visited[y, x] = True

        if current == end:
            return path

        for dx, dy in moves:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and graph[ny, nx] == 1 and not visited[ny, nx]:
                move_cost = math.dist((x, y), (nx, ny))
                new_g = g + move_cost
                new_f = new_g + math.dist((nx, ny), end)
                heapq.heappush(open_set, (new_f, new_g, (nx, ny), path + [(nx, ny)]))
    return None

# -------- Snap point to nearest skeleton pixel --------
def snap_to_skeleton(pt, skel):
    y, x = np.where(skel > 0)
    coords = np.vstack((x, y)).T
    idx = np.argmin(np.linalg.norm(coords - np.array(pt), axis=1))
    return tuple(coords[idx])

# -------- Path Simplification (RDP) --------
def simplify_path(path, epsilon=2.0):
    """Simplify path using Ramer-Douglas-Peucker algorithm."""
    def rdp(points, eps):
        if len(points) < 3:
            return points
        start, end = points[0], points[-1]
        line_vec = np.array(end) - np.array(start)
        line_len = np.linalg.norm(line_vec)
        if line_len == 0:
            return [start, end]
        distances = []
        for p in points[1:-1]:
            proj = np.dot(np.array(p) - np.array(start), line_vec) / line_len
            proj_point = np.array(start) + (proj / line_len) * line_vec
            dist = np.linalg.norm(np.array(p) - proj_point)
            distances.append(dist)
        max_dist = max(distances)
        idx = distances.index(max_dist) + 1
        if max_dist > eps:
            left = rdp(points[:idx+1], eps)
            right = rdp(points[idx:], eps)
            return left[:-1] + right
        else:
            return [start, end]
    return rdp(path, epsilon)

# -------- Load OCR labels --------
with open(LABELS_JSON) as f:
    labels = json.load(f)
name_to_coord = {item["name"]: (item["x"], item["y"]) for item in labels}

# -------- Load user selection --------
with open(POINTS_JSON) as f:
    points = json.load(f)
if isinstance(points, list):
    points = points[0]

source_name = points["source"]
dest_name = points["destination"]

print(f"🚦 Selected: {source_name} → {dest_name}")

if source_name not in name_to_coord or dest_name not in name_to_coord:
    raise ValueError(" Source or Destination not found in labels.json")

SOURCE = snap_to_skeleton(name_to_coord[source_name], skeleton)
DESTINATION = snap_to_skeleton(name_to_coord[dest_name], skeleton)

print(f" Snapped to skeleton: {SOURCE}, {DESTINATION}")

# -------- Find path --------
path = astar_on_skeleton(SOURCE, DESTINATION, skeleton)

if path is None:
    print(" No path found!")
    exit()

# -------- Smooth the path --------
smooth_path = simplify_path(path, epsilon=3.0)

# Compute distance
distance_pixels = sum(math.dist(smooth_path[i-1], smooth_path[i]) for i in range(1, len(smooth_path)))
distance_meters = distance_pixels * PIXEL_TO_METER
print(f" Smoothed Distance: {distance_meters:.2f} meters")

# Draw path
output = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for i in range(1, len(smooth_path)):
    cv2.line(output, smooth_path[i-1], smooth_path[i], (0,0,255), 2)

cv2.circle(output, SOURCE, 5, (0,255,0), -1)  # Start
cv2.circle(output, DESTINATION, 5, (255,0,0), -1)  # End

cv2.imshow("Indoor Navigation - Path", output)
cv2.waitKey(0)
cv2.destroyAllWindows()
cv2.imwrite(OUTPUT_PATH, output)
print(f" Path image saved to {OUTPUT_PATH}")

import cv2
import numpy as np
import heapq
from skimage.morphology import skeletonize

# ===== CONFIG =====
MAP_PATH = "assets/2nd_Floor.png"   # Floor map
START = (780, 205)   # (y, x) → Example: Class 2import cv2
import numpy as np
import heapq
from skimage.morphology import skeletonize

# ===== CONFIG =====
MAP_PATH = "assets/2nd_Floor.png"   # Floor map
START = (780, 205)   # (y, x) → Example: Class 2
END   = (446, 920)   # (y, x) → Example: Computer Lab
# ==================

# Load map
img = cv2.imread(MAP_PATH, cv2.IMREAD_GRAYSCALE)
if img is None:
    raise FileNotFoundError(f"❌ Could not load {MAP_PATH}")

# Convert to binary (corridor=1, wall=0)
_, binary = cv2.threshold(img, 200, 255, cv2.THRESH_BINARY)
binary = (binary == 0).astype(np.uint8)  # 1 = corridor, 0 = wall

# Clean up small noise/gaps
binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, np.ones((3,3), np.uint8))
binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((3,3), np.uint8))

# Skeletonize to get center line of corridors
skeleton = skeletonize(binary).astype(np.uint8)

# ---- A* Algorithm ----
def heuristic(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])

def astar(grid, start, goal):
    rows, cols = grid.shape
    open_list = []
    heapq.heappush(open_list, (heuristic(start, goal), 0, start, [start]))
    visited = set()

    while open_list:
        f, g, current, path = heapq.heappop(open_list)
        if current == goal:
            return path
        if current in visited:
            continue
        visited.add(current)

        # 4-directional neighbors
        for dx, dy in [(0,1),(1,0),(0,-1),(-1,0)]:
            nx, ny = current[0] + dx, current[1] + dy
            if 0 <= nx < rows and 0 <= ny < cols and grid[nx, ny] == 1:
                new_node = (nx, ny)
                if new_node not in visited:
                    heapq.heappush(open_list, (g + 1 + heuristic(new_node, goal), g + 1, new_node, path + [new_node]))
    return None

# ---- Snap start & end to nearest skeleton point ----
def snap_to_skeleton(point, skeleton):
    y, x = point
    mask = np.argwhere(skeleton == 1)
    if len(mask) == 0:
        return point
    distances = np.linalg.norm(mask - np.array([y, x]), axis=1)
    nearest = mask[np.argmin(distances)]
    return tuple(nearest)

START = snap_to_skeleton(START, skeleton)
END = snap_to_skeleton(END, skeleton)
print("Snapped START:", START)
print("Snapped END:", END)

# ---- Debug skeleton and snapped points ----
debug = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
cv2.circle(debug, (START[1], START[0]), 6, (0,255,0), -1)  # Green start
cv2.circle(debug, (END[1], END[0]), 6, (255,0,0), -1)      # Blue end
cv2.imshow("Skeleton", skeleton * 255)
cv2.imshow("Snapped Points", debug)
cv2.waitKey(0)

# ---- Run Pathfinding ----
path = astar(skeleton, START, END)

color_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

if path:
    for i in range(len(path) - 1):
        pt1 = (path[i][1], path[i][0])
        pt2 = (path[i+1][1], path[i+1][0])
        cv2.arrowedLine(color_img, pt1, pt2, (0,0,255), 2, tipLength=0.3)

    cv2.circle(color_img, (START[1], START[0]), 6, (0,255,0), -1)  # Green start
    cv2.circle(color_img, (END[1], END[0]), 6, (255,0,0), -1)      # Blue end

    cv2.imshow("Path in Middle of Corridor", color_img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()
else:
    print("⚠️ No path found!")

END   = (446, 920)   # (y, x) → Example: Computer Lab
# ==================

# Load map
img = cv2.imread(MAP_PATH, cv2.IMREAD_GRAYSCALE)
if img is None:
    raise FileNotFoundError(f"❌ Could not load {MAP_PATH}")

# Convert to binary (0=path, 1=wall)
_, binary = cv2.threshold(img, 200, 255, cv2.THRESH_BINARY)
binary = (binary == 0).astype(np.uint8)  # 0 = walkable, 1 = wall

# Skeletonize to find center line of corridors
skeleton = skeletonize(1 - binary)  # invert so corridors=1
skeleton = skeleton.astype(np.uint8)

# ---- A* Algorithm ----
def heuristic(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])

def astar(grid, start, goal):
    rows, cols = grid.shape
    open_list = []
    heapq.heappush(open_list, (heuristic(start, goal), 0, start, [start]))
    visited = set()

    while open_list:
        f, g, current, path = heapq.heappop(open_list)
        if current == goal:
            return path
        if current in visited:
            continue
        visited.add(current)

        for dx, dy in [(0,1),(1,0),(0,-1),(-1,0),(1,1),(-1,-1),(1,-1),(-1,1)]:  # 8 dirs
            nx, ny = current[0] + dx, current[1] + dy
            if 0 <= nx < rows and 0 <= ny < cols and grid[nx, ny] == 1:
                new_node = (nx, ny)
                if new_node not in visited:
                    heapq.heappush(open_list, (g + 1 + heuristic(new_node, goal), g + 1, new_node, path + [new_node]))
    return None

# ---- Snap start & end to nearest skeleton point ----
def snap_to_skeleton(point, skeleton):
    y, x = point
    mask = np.argwhere(skeleton == 1)
    if len(mask) == 0:
        return point
    distances = np.linalg.norm(mask - np.array([y, x]), axis=1)
    nearest = mask[np.argmin(distances)]
    return tuple(nearest)

START = snap_to_skeleton(START, skeleton)
END = snap_to_skeleton(END, skeleton)

# ---- Run Pathfinding ----
path = astar(skeleton, START, END)

color_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

if path:
    for i in range(len(path) - 1):
        pt1 = (path[i][1], path[i][0])
        pt2 = (path[i+1][1], path[i+1][0])
        cv2.arrowedLine(color_img, pt1, pt2, (0,0,255), 2, tipLength=0.3)

    cv2.circle(color_img, (START[1], START[0]), 6, (0,255,0), -1)  # Green start
    cv2.circle(color_img, (END[1], END[0]), 6, (255,0,0), -1)      # Blue end

    cv2.imshow("Path in Middle of Corridor", color_img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()
else:
    print("⚠️ No path found!")
import cv2
import numpy as np  
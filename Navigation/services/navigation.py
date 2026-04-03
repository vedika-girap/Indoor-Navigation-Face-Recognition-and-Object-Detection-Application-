import heapq, math

def heuristic(a, b):
    return math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2)

def a_star(nodes, edges, start, goal):
    graph = {node: [] for node in nodes}
    for edge in edges:
        graph[edge[0]].append(edge[1])
        graph[edge[1]].append(edge[0])

    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from, g_score, f_score = {}, {}, {}
    for node in nodes:
        g_score[node] = f_score[node] = float("inf")
    g_score[start] = 0
    f_score[start] = heuristic(nodes[start], nodes[goal])

    while open_set:
        _, current = heapq.heappop(open_set)
        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            return path[::-1]

        for neighbor in graph[current]:
            tentative_g = g_score[current] + heuristic(nodes[current], nodes[neighbor])
            if tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + heuristic(nodes[neighbor], nodes[goal])
                heapq.heappush(open_set, (f_score[neighbor], neighbor))
    return None


def path_to_instructions(path, nodes):
    instructions = []
    for i in range(len(path) - 1):
        start, end = nodes[path[i]], nodes[path[i+1]]
        dx, dy = end[0]-start[0], end[1]-start[1]

        if abs(dx) > abs(dy):
            direction = "right" if dx > 0 else "left"
        else:
            direction = "forward" if dy > 0 else "backward"

        distance = round(math.sqrt(dx**2 + dy**2), 2)
        instructions.append(f"Go {direction} for {distance} meters towards {path[i+1]}")
    return instructions

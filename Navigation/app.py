from utils.map_utils import load_map, show_path_on_map
from services.navigation import a_star, path_to_instructions
if __name__ == "__main__":
    nodes, edges = load_map("maps/blueprint_graph.json")
    start, goal = "entrance", "washroom"
    path = a_star(nodes, edges, start, goal)
    if path:
        print("Path:", " -> ".join(path))
        instructions = path_to_instructions(path, nodes)
        for step in instructions:
            print(step)
        show_path_on_map("maps/blueprint.png", nodes, path)
    else:
        print("No path found!")
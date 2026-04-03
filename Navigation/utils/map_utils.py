import json
import cv2
import matplotlib.pyplot as plt

def load_map(filepath="maps/blueprint_graph.json"):
    with open(filepath, "r") as f:
        data = json.load(f)
    return data["nodes"], data["edges"]

def show_path_on_map(image_path, nodes, path):
    img = cv2.imread(image_path)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    plt.imshow(img_rgb)
    
    # Plot nodes
    for name, (x, y) in nodes.items():
        plt.plot(x, y, "bo")
        plt.text(x+2, y+2, name, color="blue", fontsize=8)

    # Plot path
    for i in range(len(path)-1):
        start, end = nodes[path[i]], nodes[path[i+1]]
        plt.plot([start[0], end[0]], [start[1], end[1]], "r-", linewidth=2)

    plt.show()

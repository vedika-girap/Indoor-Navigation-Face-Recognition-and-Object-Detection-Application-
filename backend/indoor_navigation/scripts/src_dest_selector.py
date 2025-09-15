import tkinter as tk
import json

# Paths
LABELS_JSON = r"R:\Major Project\indoor_navigation\data\labels.json"
POINTS_JSON = r"R:\Major Project\indoor_navigation\data\selected_points.json"

# Load labels.json (OCR output with room names + coords)
with open(LABELS_JSON) as f:
    labels = json.load(f)

# Extract only the room names
room_names = [item["name"] for item in labels]

source = None
destination = None

# ---------- First Window: Select Source ----------
def select_source():
    def on_button_click(name):
        nonlocal root
        global source
        source = name
        root.destroy()  # Close window after selection

    root = tk.Tk()
    root.title("Select Source")
    root.geometry("400x500")

    tk.Label(root, text="Select Source Room:", font=("Arial", 14)).pack(pady=10)

    for name in room_names:
        btn = tk.Button(root, text=name, command=lambda n=name: on_button_click(n),
                        width=25, height=2, bg="lightblue")
        btn.pack(pady=5)

    root.mainloop()

# ---------- Second Window: Select Destination ----------
def select_destination():
    def on_button_click(name):
        nonlocal root
        global destination
        destination = name
        root.destroy()  # Close window after selection

    root = tk.Tk()
    root.title("Select Destination")
    root.geometry("400x500")

    tk.Label(root, text="Select Destination Room:", font=("Arial", 14)).pack(pady=10)

    for name in room_names:
        btn = tk.Button(root, text=name, command=lambda n=name: on_button_click(n),
                        width=25, height=2, bg="lightgreen")
        btn.pack(pady=5)

    root.mainloop()

# ---------- Run both selections ----------
select_source()
select_destination()

# ---------- Save final selection (dict format, not list) ----------
with open(POINTS_JSON, "w") as f:
    json.dump({"source": source, "destination": destination}, f, indent=4)

# ---------- Final Output ----------
print(f" You selected Source: {source}")
print(f" You selected Destination: {destination}")
print(" Saved to selected_points.json")

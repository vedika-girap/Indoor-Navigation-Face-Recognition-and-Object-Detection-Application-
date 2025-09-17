import tkinter as tk
import json

# Load labels from JSON
with open(r"R:\Major Project\indoor_navigation\data\labels.json") as f:
    labels = json.load(f)

# Function to handle button click
def on_button_click(name):
    print(f"You selected: {name}")

# GUI setup
root = tk.Tk()
root.title("Indoor Navigation")
root.geometry("400x400")

tk.Label(root, text="Select a Room/Class:", font=("Arial", 14)).pack(pady=10)

# Create a button for each label
for label in labels:
    btn = tk.Button(root, text=label, command=lambda l=label: on_button_click(l),
                    width=25, height=2, bg="lightblue")
    btn.pack(pady=5)

root.mainloop()

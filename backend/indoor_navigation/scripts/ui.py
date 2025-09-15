import tkinter as tk
from tkinter import messagebox
from rooms_from_map import extract_rooms
from middle import run_navigation

source = None
destination = None
ROOMS = extract_rooms()  # dynamically detect

def set_source(room):
    global source
    source = ROOMS[room]
    messagebox.showinfo("Source Selected", f"Source: {room}")

def set_destination(room):
    global destination
    destination = ROOMS[room]
    messagebox.showinfo("Destination Selected", f"Destination: {room}")
    if source and destination:
        run_navigation(source, destination)

root = tk.Tk()
root.title("Indoor Navigation")

tk.Label(root, text="Select Source Room").pack()
for room in ROOMS:
    tk.Button(root, text=room, command=lambda r=room: set_source(r)).pack()

tk.Label(root, text="Select Destination Room").pack()
for room in ROOMS:
    tk.Button(root, text=room, command=lambda r=room: set_destination(r)).pack()

root.mainloop()

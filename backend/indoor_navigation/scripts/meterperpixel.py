import cv2

# Load the image
img = cv2.imread("floor-2nd-mod.png")

# Example: known real-world distance is 20 feet
real_world_distance_feet = 20

# Measure pixel distance between two points (manually determined)
# Example coordinates: (x1, y1) and (x2, y2)
p1 = (100, 200)  # start point
p2 = (400, 200)  # end point

# Calculate pixel distance
pixel_distance = ((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2) ** 0.5

# Conversion factor (feet per pixel)
feet_per_pixel = real_world_distance_feet / pixel_distance

# Convert to meters (1 foot = 0.3048 meters)
meters_per_pixel = feet_per_pixel * 0.3048

print(f"Pixel distance: {pixel_distance}")
print(f"Feet per pixel: {feet_per_pixel}")
print(f"Meters per pixel: {meters_per_pixel}")

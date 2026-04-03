import os

# Paths to your dataset
#images_path = r"C:\Users\SAMEEKSHA\OneDrive\Desktop\Major Project\ObjectDetection\valid\images"
labels_path = r"C:\Users\SAMEEKSHA\OneDrive\Desktop\Major Project\ObjectDetection\\valid\labels"

# Mapping from old → new class IDs
class_mapping = {
    0: 0,  # door
    8: 1,  # opened door
    5: 2,  # table
    3: 3,  # window
    4: 4   # chair
}

for label_file in os.listdir(labels_path):
    if label_file.endswith(".txt"):
        label_path = os.path.join(labels_path, label_file)

        new_lines = []
        with open(label_path, "r") as f:
            for line in f.readlines():
                parts = line.strip().split()
                old_class = int(parts[0])

                # keep only desired classes
                if old_class in class_mapping:
                    parts[0] = str(class_mapping[old_class])  # remap ID
                    new_lines.append(" ".join(parts))

        # if no valid objects remain → delete label & image
        if not new_lines:
            os.remove(label_path)
            print(f"Deleted empty label file: {label_file}")

            image_name = os.path.splitext(label_file)[0] + ".jpg"  # change if PNG
            #image_path = os.path.join(images_path, image_name)

            # if os.path.exists(image_path):
            #     os.remove(image_path)
            #     print(f"Deleted image: {image_name}")
        else:
            # overwrite label with filtered+remapped lines
            with open(label_path, "w") as f:
                f.write("\n".join(new_lines))

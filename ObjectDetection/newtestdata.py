import os

# Paths
images_path = r"C:\Users\SAMEEKSHA\OneDrive\Desktop\Major Project\ObjectDetection\test\images"
labels_path = r"C:\Users\SAMEEKSHA\OneDrive\Desktop\Major Project\ObjectDetection\test\labels"

IMG_EXTS = [".jpg", ".jpeg", ".png"]

# Collect all labels (source of truth)
label_files = sorted([f for f in os.listdir(labels_path) if f.endswith(".txt")])

pairs = []
counter = 0

# --- STEP 1: Rename to temporary names ---
for label_file in label_files:
    stem = os.path.splitext(label_file)[0]  # e.g., "105"
    old_label = os.path.join(labels_path, label_file)

    # Find matching image
    matched_img = None
    for ext in IMG_EXTS:
        candidate = os.path.join(images_path, stem + ext)
        if os.path.exists(candidate):
            matched_img = candidate
            break

    if not matched_img:
        os.remove(old_label)
        print(f"🗑 Deleted label without image: {label_file}")
        continue

    # Temporary names
    temp_label = os.path.join(labels_path, f"__temp_{counter}.txt")
    temp_img = os.path.join(images_path, f"__temp_{counter}{os.path.splitext(matched_img)[1]}")

    os.rename(old_label, temp_label)
    os.rename(matched_img, temp_img)

    pairs.append((temp_label, temp_img))
    counter += 1

# --- STEP 2: Rename temps to final continuous numbering ---
for i, (temp_label, temp_img) in enumerate(pairs):
    new_label = os.path.join(labels_path, f"{i}.txt")
    new_img = os.path.join(images_path, f"{i}{os.path.splitext(temp_img)[1]}")

    os.rename(temp_label, new_label)
    os.rename(temp_img, new_img)

    print(f"✅ Renamed pair → {i}")

print(f"\n🎯 Done! Final dataset: {counter} pairs (0 to {counter-1}).")

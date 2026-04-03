"""
Small experiment harness to evaluate combined_detection latency vs image size/compression.

Usage:
  python run_experiments.py --server http://localhost:8000 --image test.jpg

It will generate a small test image (if not present) and run combinations of widths and qualities.
Outputs a CSV `experiments/results.csv` with columns: width,quality,round,elapsed_ms,det_count,face_count
"""
import os
import io
import time
import csv
import argparse
from PIL import Image, ImageDraw
import warnings
warnings.filterwarnings('ignore')
import requests

RESDIR = os.path.join(os.path.dirname(__file__), 'results')
IMGDIR = os.path.join(os.path.dirname(__file__), 'test_images')
os.makedirs(RESDIR, exist_ok=True)
os.makedirs(IMGDIR, exist_ok=True)

DEFAULT_IMAGE = os.path.join(IMGDIR, 'test.jpg')

# Create a simple test image if not present
if not os.path.exists(DEFAULT_IMAGE):
    img = Image.new('RGB', (1200, 800), color=(73, 109, 137))
    d = ImageDraw.Draw(img)
    d.text((10,10), "Test Image", fill=(255,255,0))
    img.save(DEFAULT_IMAGE, 'JPEG')


def resize_image(src_path, width, quality):
    img = Image.open(src_path)
    w, h = img.size
    if w <= width:
        out = img
    else:
        ratio = width / float(w)
        new_h = int(h * ratio)
        out = img.resize((width, new_h), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, format='JPEG', quality=int(quality*100))
    buf.seek(0)
    return buf


def run(server_url, image_path, widths, qualities, rounds=5):
    results_file = os.path.join(RESDIR, 'results.csv')
    with open(results_file, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['width','quality','round','elapsed_ms','det_count','face_count'])
        for width in widths:
            for quality in qualities:
                for r in range(rounds):
                    buf = resize_image(image_path, width, quality)
                    files = {'file': ('photo.jpg', buf, 'image/jpeg')}
                    try:
                        t0 = time.time()
                        resp = requests.post(server_url.rstrip('/') + '/combined_detection/', files=files, data={'user_id': 'testuser'})
                        t1 = time.time()
                        elapsed_ms = int((t1 - t0) * 1000)
                        if resp.status_code == 200:
                            j = resp.json()
                            det_count = len(j.get('detections', []))
                            face_count = len(j.get('faces', [])) if isinstance(j.get('faces', []), list) else 0
                        else:
                            det_count = -1
                            face_count = -1
                    except Exception as e:
                        elapsed_ms = -1
                        det_count = -1
                        face_count = -1
                    print(f"W{width} Q{quality} R{r} -> {elapsed_ms}ms det:{det_count} face:{face_count}")
                    writer.writerow([width, quality, r, elapsed_ms, det_count, face_count])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--server', default='http://127.0.0.1:8000', help='Backend server base URL')
    parser.add_argument('--image', default=DEFAULT_IMAGE, help='Path to source image')
    parser.add_argument('--rounds', type=int, default=5)
    args = parser.parse_args()

    widths = [480, 640, 800]
    qualities = [0.4, 0.6, 0.8]

    run(args.server, args.image, widths, qualities, rounds=args.rounds)

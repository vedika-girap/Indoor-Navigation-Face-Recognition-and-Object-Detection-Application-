import numpy as np
import cv2
import requests

# create synthetic floor map-like image
h, w = 800, 1200
img = np.full((h,w,3), 255, dtype=np.uint8)
# draw rooms as rectangles
cv2.rectangle(img, (50,50), (350,300), (0,0,0), -1)
cv2.rectangle(img, (370,50), (750,300), (200,200,200), -1)
cv2.rectangle(img, (50,320), (600,700), (0,0,0), -1)
cv2.rectangle(img, (620,320), (1100,700), (200,200,200), -1)
# add some text labels
cv2.putText(img, 'Room301', (70,80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255,255,255), 2)
cv2.putText(img, 'Washroom', (380,80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,0), 2)

path = 'test_map.png'
cv2.imwrite(path, img)

url = 'http://127.0.0.1:8000/floor_maps/process'
files = {'file': open(path, 'rb')}
print('Posting to', url)
r = requests.post(url, files=files, data={'user_id':'test_user','map_id':'test_map'})
print('Status', r.status_code)
print(r.headers.get('content-type'))
try:
    print(r.json())
except Exception as e:
    print('Response text:', r.text)

import requests
from utils.config import IMMERSAL_API_KEY

BASE_URL = "https://api.immersal.com"

def get_current_location(image_path, map_id):
    """
    Sends a camera frame to Immersal Cloud and gets back (x, y, z).
    """
    with open(image_path, "rb") as img_file:
        response = requests.post(
            f"{BASE_URL}/localize",
            headers={"Authorization": f"Bearer {IMMERSAL_API_KEY}"},
            data={"mapId": map_id},
            files={"image": img_file}
        )
    if response.status_code == 200:
        data = response.json()
        return data.get("pose", None)  # includes x,y,z
    return None

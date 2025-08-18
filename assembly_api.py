import requests
import time
import os

# Load API key from environment variable (safer than hardcoding!)
API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
BASE_URL = "https://api.assemblyai.com/v2"

HEADERS = {
    "authorization": API_KEY,
    "content-type": "application/json"
}

def upload_file(file_path):
    """
    Uploads a local file to AssemblyAI and returns the upload URL.
    """
    print(f"[INFO] Uploading {file_path} to AssemblyAI...")
    with open(file_path, "rb") as f:
        response = requests.post(
            f"{BASE_URL}/upload",
            headers={"authorization": API_KEY},
            data=f
        )
    response.raise_for_status()
    upload_url = response.json()["upload_url"]
    print(f"[INFO] File uploaded successfully: {upload_url}")
    return upload_url

def transcribe_file(upload_url):
    """
    Creates a transcription job and waits for the result.
    """
    print("[INFO] Starting transcription job...")
    response = requests.post(
        f"{BASE_URL}/transcript",
        json={"audio_url": upload_url},
        headers=HEADERS
    )
    response.raise_for_status()
    transcript_id = response.json()["id"]

    # Poll until transcription is complete
    while True:
        poll = requests.get(f"{BASE_URL}/transcript/{transcript_id}", headers=HEADERS)
        poll.raise_for_status()
        status = poll.json()["status"]

        if status == "completed":
            print("[INFO] Transcription completed ✅")
            return poll.json()["text"]
        elif status == "error":
            raise RuntimeError(f"Transcription failed: {poll.json()['error']}")
        else:
            print(f"[INFO] Transcription status: {status} ...")
            time.sleep(3)

def upload_and_transcribe(file_path):
    """
    End-to-end: Upload + Transcribe
    """
    upload_url = upload_file(file_path)
    text = transcribe_file(upload_url)
    return text

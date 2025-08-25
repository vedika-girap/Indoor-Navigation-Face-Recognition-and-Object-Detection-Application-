import sounddevice as sd
import numpy as np
import requests
import os
from dotenv import load_dotenv
from scipy.io.wavfile import write as wav_write
from utils.logger import log

# Load API key
load_dotenv()
API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
BASE_URL = "https://api.assemblyai.com/v2"

def record_audio(filename, duration=4, fs=16000):
    log(f"🎙️ Recording {duration} seconds...", "info")
    recording = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype="int16")
    sd.wait()
    wav_write(filename, fs, recording)   # save as WAV
    return filename

def upload_audio(filename):
    headers = {"authorization": API_KEY}
    with open(filename, "rb") as f:
        response = requests.post(f"{BASE_URL}/upload", headers=headers, data=f)

    if response.status_code != 200:
        log(f"❌ Upload failed! Status: {response.status_code}, Msg: {response.text}", "error")
        return None

    return response.json().get("upload_url")

def transcribe_audio(audio_url):
    headers = {"authorization": API_KEY, "content-type": "application/json"}
    response = requests.post(
        f"{BASE_URL}/transcript",
        headers=headers,
        json={"audio_url": audio_url}
    )

    if response.status_code != 200:
        log(f"❌ Transcription request failed: {response.status_code}, {response.text}", "error")
        return None

    transcript_id = response.json()["id"]

    # Poll until ready
    while True:
        status_res = requests.get(f"{BASE_URL}/transcript/{transcript_id}", headers=headers).json()
        if status_res["status"] == "completed":
            return status_res["text"]
        elif status_res["status"] == "error":
            log("❌ Transcription failed.", "error")
            return None

def record_and_transcribe(filename="command.wav", duration=4):
    try:
        record_audio(filename, duration=duration)
        audio_url = upload_audio(filename)
        if not audio_url:
            return None
        return transcribe_audio(audio_url)
    except Exception as e:
        log(f"Error in STT: {e}", "error")
        return None

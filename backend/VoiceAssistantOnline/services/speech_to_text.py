import os
import time
import requests
import sounddevice as sd
from scipy.io.wavfile import write as wav_write
from dotenv import load_dotenv
from utils.logger import log
load_dotenv("api.env")
load_dotenv()
API_KEY=os.getenv("ASSEMBLYAI_API_KEY")
BASE_URL="https://api.assemblyai.com/v2"
if not API_KEY:
    log("ASSEMBLYAI_API_KEY not found. Add it to api.env or .env", "error")
def _record_wav(filename, duration=2.0, fs=16000):
    log(f" Recording {duration:.1f}s...", "info")
    audio=sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype="int16")
    sd.wait()
    wav_write(filename, fs, audio)
    return filename
def _upload_audio(filename):
    headers={"authorization": API_KEY}
    with open(filename, "rb") as f:
        resp = requests.post(f"{BASE_URL}/upload", headers=headers, data=f)
    if resp.status_code!=200:
        log(f"Upload failed [{resp.status_code}]: {resp.text}", "error")
        return None
    return resp.json().get("upload_url")
def _poll_transcript(transcript_id, fast=False):
    headers={"authorization": API_KEY}
    poll_interval=0.7 if fast else 2.0
    while True:
        data=requests.get(f"{BASE_URL}/transcript/{transcript_id}", headers=headers).json()
        status=data.get("status")
        if status=="completed":
            return data.get("text", "")
        if status=="error":
            log(f"Transcription error: {data.get('error')}", "error")
            return None
        time.sleep(poll_interval)
def _start_transcription(audio_url, *, payload_overrides=None):
    headers={"authorization": API_KEY, "content-type": "application/json"}
    payload={
        "audio_url": audio_url,
        "punctuate": True,
        "format_text": True,
        "language_code": "en_us",
    }
    if payload_overrides:
        payload.update(payload_overrides)
    resp = requests.post(f"{BASE_URL}/transcript", headers=headers, json=payload)
    if resp.status_code!=200:
        log(f"Start transcription failed [{resp.status_code}]: {resp.text}", "error")
        return None
    return resp.json().get("id")
def detect_wake_word(filename="wake.wav", duration=1.8, wake_variants=None):
    if wake_variants is None:
        wake_variants = ["eyra", "aira", "ira", "ayra", "aera", "era"]
    _record_wav(filename, duration=duration)
    audio_url = _upload_audio(filename)
    if not audio_url:
        return None
    payload_overrides = {
        "speed_boost": True,
        "word_boost": wake_variants,
        "boost_param": "high",
        "custom_spelling": [
            {"from": wake_variants, "to": "eyra"}
        ],
    }
    tr_id = _start_transcription(audio_url, payload_overrides=payload_overrides)
    if not tr_id:
        return None
    text = _poll_transcript(tr_id, fast=True)
    return text
def record_and_transcribe(filename="command.wav", duration=6.0):
    _record_wav(filename, duration=duration)
    audio_url = _upload_audio(filename)
    if not audio_url:
        return None
    tr_id = _start_transcription(audio_url)
    if not tr_id:
        return None
    return _poll_transcript(tr_id, fast=False)

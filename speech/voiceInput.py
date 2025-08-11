from vosk import Model, KaldiRecognizer
import sounddevice as sd
import queue, json

q= queue.Queue()

def callback(indata, frames, time, status):
    q.put(bytes(indata))

model = Model("models/vosk-model-small-en-us-0.15")


print("Listening...")
def listen():
        rec = KaldiRecognizer(model,16000)
        with sd.RawInputStream(samplerate=16000,blocksize=8000, dtype='int16',
                                channels=1 , callback=callback):
            while True:
                data=q.get()
                if rec.AcceptWaveform(data):
                    result= json.loads(rec.Result())
                    text = result.get("text", "").strip()
                    return text

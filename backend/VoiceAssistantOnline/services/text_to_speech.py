import pyttsx3
from utils.logger import log

engine = pyttsx3.init()

def speak(text):
    log(f"🗣️ Speaking: {text}", "info")
    engine.say(text)
    engine.runAndWait()

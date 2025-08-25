import time
from services.speech_to_text import record_and_transcribe
from services.text_to_speech import speak
from services.intent_recognition import handle_intent, intent_response
from services.haptic_feedback import trigger_haptic
from utils.logger import log

WAKE_WORD = "ira"

def main():
    log("=== Online Voice Assistant Started ===", "info")

    while True:
        # Step 1: Listen for wake word
        log("🎤 Say the wake word 'eyra'...", "info")
        wake_word = record_and_transcribe("wake.wav", duration=3)

        if not wake_word or WAKE_WORD not in wake_word.lower():
            continue

        log("✅ Wake word detected! Listening for your command...", "success")

        # Step 2: Record and transcribe command
        command = record_and_transcribe("command.wav", duration=6)

        if not command:
            speak("Sorry, I didn’t catch that. Please repeat.")
            continue

        log(f"✅ You said: {command}", "success")

        # Step 3: Intent Recognition
        intent = handle_intent(command)
        response = intent_response(intent)

        # Step 4: Speak + Haptic Feedback
        if intent != "unknown" and response:
            speak(response)
            trigger_haptic(intent)
        else:
            speak("Sorry, I didn't understand that command.")

        time.sleep(1)

if __name__ == "__main__":
    main()

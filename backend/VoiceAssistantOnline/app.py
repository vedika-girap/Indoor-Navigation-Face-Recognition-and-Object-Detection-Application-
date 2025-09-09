from services.speech_to_text import record_and_transcribe, detect_wake_word
from services.nlu_handler import handle_intent
from services.intent_recognition import get_intent_response
from services.text_to_speech import speak
from services.haptic_feedback import trigger_haptic
import time
def main():
    print("Online Voice Assistant Started")
    while True:
        print("Say the wake word 'eyra'...")
        wake_word=detect_wake_word("wake.wav", duration=3)
        if not wake_word or "eyra" not in wake_word.lower():
            continue
        print("Wake word detected! I'm listening... Say 'quit' to exit.")
        speak("Eyra: Yes, I'm listening. You can say quit to stop me.")
        while True:
            print("Listening for your command...")
            command=record_and_transcribe("command.wav", duration=5)
            if not command:
                speak("Sorry, I didn't catch that. Can you please repeat.")
                continue
            print(f"You said: {command}")
            intent=handle_intent(command)
            response=get_intent_response(intent)
            if intent=="quit":
                speak("Goodbye! Exiting assistant.")
                return  
            if response:
                speak(response)
                trigger_haptic(intent)
            else:
                speak("Sorry, I didn't understand that command.")
            time.sleep(1)
if __name__ == "__main__":
    main()

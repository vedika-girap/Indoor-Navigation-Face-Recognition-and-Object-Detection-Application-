from speech.voiceInput import listen
from speech.voiceOutput import speak
from commands.handler import handle_cmd

def main():
    speak("Hello, I am ready to help.")

    while True:
        text = listen()
        if not text:
            continue

        print("User said:", text)
        if "exit" in text or "quit" in text:
            speak("Goodbye!")
            break

        response = handle_cmd(text)
        speak(response)

if __name__ == "__main__":
    main()
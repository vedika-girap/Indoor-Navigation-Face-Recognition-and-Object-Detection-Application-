# from commands.utils import current_time

def handle_cmd(text):
    text = text.lower()

    if "siri" in text:
        return "Whats up Gadhiii"
    
    elif "hello" in text:
        return "Hello! How can I assist you today?"

    elif "where am i now" in text or "tell me my current location":
        return "Your current location cannot be determined."

    elif "take me to" in text or "":
        return "your current location is ... your destination is set to..."

    else:
        return "Sorry, I didn't understand that."
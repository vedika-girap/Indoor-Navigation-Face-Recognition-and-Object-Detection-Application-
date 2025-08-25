def handle_intent(command: str) -> str:
    command = command.lower()
    if "library" in command:
        return "locate_library"
    elif "washroom" in command:
        return "locate_washroom"
    elif "classroom" in command:
        return "locate_classroom"
    else:
        return "unknown"

def intent_response(intent: str) -> str:
    responses = {
        "locate_library": "The library is on the first floor, next to the computer lab.",
        "locate_washroom": "The washroom is on the ground floor, near the main entrance.",
        "locate_classroom": "Your classroom is on the second floor, room 203.",
    }
    return responses.get(intent, None)

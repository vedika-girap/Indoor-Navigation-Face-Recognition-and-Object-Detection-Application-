def handle_intent(command: str) -> str:
    cmd = command.lower()
    if "library" in cmd:
        return "locate_library"
    elif "washroom" in cmd or "toilet" in cmd or "restroom" in cmd:
        return "locate_washroom"
    elif "classroom" in cmd:
        return "locate_classroom"
    elif "exit" in cmd or "way out" in cmd:
        return "locate_exit"
    elif "staffroom" in cmd or "teacher" in cmd:
        return "locate_staffroom"
    elif "help" in cmd or "what can you do" in cmd:
        return "help"
    return "unknown"

def get_intent_response(intent: str) -> str:
    responses ={
        "locate_library": "The library is on the first floor, next to the computer lab.",
        "locate_washroom": "The washroom is on the ground floor, near the main entrance.",
        "locate_classroom": "Which classroom? Please specify the number.",
        "locate_exit": "The exit is straight ahead, past the reception desk.",
        "locate_staffroom": "The staffroom is on the second floor, near the staircase.",
        "help": "I can help you find places like the library, washroom, classrooms, exit, and staffroom.",
        "quit": "Goodbye! Exiting assistant."
    }
    return responses.get(intent, "Sorry, I don’t understand that request.")

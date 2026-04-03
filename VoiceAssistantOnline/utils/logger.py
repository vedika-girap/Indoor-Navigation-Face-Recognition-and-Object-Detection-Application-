def log(message, level="info"):
    colors = {
        "info": "\033[94m",      # Blue
        "success": "\033[92m",   # Green
        "error": "\033[91m",     # Red
    }
    reset = "\033[0m"
    print(f"{colors.get(level, '')}{message}{reset}")

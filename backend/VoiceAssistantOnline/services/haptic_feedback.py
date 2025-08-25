from utils.logger import log
import time

def trigger_haptic(intent):
    patterns = {
        "locate_library": [0.2, 0.2, 0.2],
        "locate_washroom": [0.5, 0.5],
        "locate_classroom": [1.0]
    }

    pattern = patterns.get(intent)
    if not pattern:
        return

    log(f"🔔 Triggering haptic feedback for {intent}", "info")

    for p in pattern:
        log("💥 Vibration", "info")
        time.sleep(p)

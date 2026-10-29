# Ziya — Indoor Navigation with Object & Face Identification

**A voice-first, smartphone-based assistive application for blind and visually impaired individuals.**

Ziya is an AI-powered indoor navigation system designed to help visually impaired users navigate indoor environments such as college buildings, hospitals, offices, and shopping malls. It combines floor-plan-based route planning, real-time object detection, face recognition, and spoken feedback to provide contextual assistance without requiring dedicated hardware.

The application uses **React Native (Expo)** for the mobile interface and a **Python FastAPI backend** for AI inference, image processing, and route computation.

> **Project:** Final-Year B.E. Computer Science & Engineering (2025–2026)  
> **Institution:** Mangalore Institute of Technology & Engineering (MITE), Moodabidri  
> **Affiliation:** Visvesvaraya Technological University (VTU), Belagavi

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Running the Application](#running-the-application)
- [How to Use](#how-to-use)
- [Core Modules](#core-modules)
- [Testing](#testing)
- [Limitations](#limitations)
- [Future Enhancements](#future-enhancements)
- [Team](#team)
- [Acknowledgements](#acknowledgements)

## Overview

Indoor environments present significant navigation challenges for people with visual impairments. GPS signals are unreliable indoors, while conventional navigation applications generally lack real-time awareness of nearby obstacles, room layouts, and people.

Ziya addresses these challenges through three complementary capabilities:

1. **Indoor navigation:** Processes floor plans, constructs a navigation graph, calculates routes using the A* pathfinding algorithm, and delivers step-based voice instructions.
2. **Object and obstacle detection:** Uses YOLO11n to identify supported objects in camera frames and announce relevant surroundings.
3. **Face recognition:** Recognizes previously registered individuals and allows unknown faces to be saved for future identification.

The application is modular, allowing users to operate navigation, object detection, and face recognition independently or in combination.

## Key Features

### 1. Voice-Guided Indoor Navigation
- Upload and process indoor floor plans.
- Select a starting point and destination.
- Generate routes using the A* pathfinding algorithm.
- Convert route waypoints into spoken, step-based instructions.
- Support room-oriented navigation within mapped indoor environments.

### 2. Real-Time Object Detection
- Detect supported objects using the YOLO11n model.
- Process camera frames through the Python backend.
- Provide spoken descriptions of detected surroundings.
- Select detection ranges: **Short, Medium, and All**.
- Support object awareness during navigation.

### 3. Face Recognition
- Recognize registered individuals using the `face_recognition` library.
- Announce the names of recognized people through voice output.
- Register unknown faces with a user-provided name.
- View, rename, and delete saved face records.

### 4. Floor Map Management
- Upload indoor floor-plan images.
- Process maps using OpenCV-based image processing.
- Extract available room labels and spatial information.
- Generate a graph for route computation.
- View and delete stored floor maps.

*Map-processing accuracy depends on the layout, image quality, and effectiveness of room-label and coordinate extraction.*

### 5. Accessibility and Personalization
- **Brief:** Concise voice announcements.
- **Detailed:** More descriptive feedback.
- **Learning:** More explanatory guidance.
- Haptic feedback support.
- Automatic mode suggestions.
- Action history for reviewing recent operations.

### 6. Modular Architecture
Navigation, object detection, face recognition, and map management are separate functional modules. This allows individual components to be tested and used without requiring every module to be active.

## System Architecture

```text
┌───────────────────────────────────────┐
│          User / Environment            │
│        Camera Input and Voice          │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│       React Native Mobile App          │
│               Expo                     │
│                                       │
│  • Camera and frame capture             │
│  • Navigation interface                 │
│  • Voice output and haptics             │
│  • Map and face management              │
│  • API communication                    │
└──────────────────┬────────────────────┘
                   │
                   │ HTTP requests
                   ▼
┌───────────────────────────────────────┐
│           FastAPI Backend              │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ Object Detection — YOLO11n      │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Face Recognition — dlib          │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Floor-Plan Processing — OpenCV  │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Navigation — Graph + A*         │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Metadata and Map Management     │  │
│  └─────────────────────────────────┘  │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│       Results Returned to App          │
│                                       │
│  • Object labels and detection results │
│  • Face identification results         │
│  • Route waypoints and directions      │
│  • Map and management responses        │
└──────────────────┬────────────────────┘
                   │
                   ▼
          Spoken User Feedback
```

### Processing Workflow

**Object detection**
1. The mobile application captures a camera frame.
2. The frame is submitted to the backend.
3. YOLO11n processes the image and returns supported object detections.
4. The application converts relevant results into spoken feedback.

**Face recognition**
1. The application captures and submits an image.
2. The backend detects faces and compares available face encodings.
3. A matching identity or an unknown-face result is returned.
4. The application announces the result and supports registration where appropriate.

**Indoor navigation**
1. The user uploads a floor-plan image.
2. The backend processes the map and extracts available room information.
3. A navigation graph is constructed from the processed spatial representation.
4. The A* algorithm computes a route between the selected locations.
5. The application translates route information into spoken directions.

## Technology Stack

| Component | Technologies |
|---|---|
| Mobile application | React Native, Expo, JavaScript, JSX |
| Backend framework | Python, FastAPI, Uvicorn |
| Object detection | YOLO11n, Ultralytics |
| Face recognition | `face_recognition`, dlib, NumPy |
| Image processing | OpenCV |
| Route computation | Graph representation, A* algorithm |
| Voice assistance | Device-side text-to-speech / speech output |
| Mobile-backend communication | HTTP APIs |
| Development tools | Node.js, npm, Python virtual environments |
| Native build dependencies | CMake, C/C++ compiler for dlib where required |

## Project Structure

```text
.
├── backend/
│   ├── server.py                 # FastAPI application entry point
│   └── floor_maps_cli.py         # Floor-map metadata utility
│
├── Navigation/                   # Indoor navigation screens and logic
├── ObjectDetection/              # Object detection interface
├── VoiceAssistantOnline/         # Ziya voice assistant module
├── FloorMap2d/                   # Floor-map assets and 2D handling
├── eyra/                         # Additional application module
├── hsd-indoor-navigation/        # Additional navigation module
│
├── Documents/                    # Project reports and documentation
├── data.yaml                     # YOLO dataset configuration
├── yolo11n.pt                    # YOLO11n model weights
│
├── .expo/                        # Expo-generated configuration/cache
└── .vscode/                      # Editor configuration
```

*The tree highlights the main directories supplied for the project. Additional files, configuration files, and modules may exist in the repository.*

## Getting Started

### Prerequisites

Install the following tools before running the application:

- Python 3.8 or a compatible version supported by the installed dependencies.
- Node.js and npm.
- Expo Go on a compatible smartphone, or an Android emulator.
- CMake and a compatible C/C++ compiler if dlib needs to be built locally.
- Git.
- A computer and smartphone connected to the same Wi-Fi network for local development.

**Important:** Check the Python version requirements of your installed Ultralytics, PyTorch, and dlib dependencies before selecting the environment. Newer releases may require a newer Python version.

### 1. Clone the Repository

```bash
git clone https://github.com/vedika-girap/Indoor-Navigation-Face-Recognition-and-Object-Detection-Application-.git

cd Indoor-Navigation-Face-Recognition-and-Object-Detection-Application-
```

### 2. Set Up the Python Backend

Create and activate a virtual environment.

**Windows — Command Prompt**

```bash
python -m venv venv
venv\Scripts\activate
```

**Windows — PowerShell**

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Linux / macOS**

```bash
python3 -m venv venv
source venv/bin/activate
```

Install the backend dependencies:

```bash
python -m pip install --upgrade pip

pip install fastapi uvicorn ultralytics opencv-python face-recognition numpy
```

If the repository contains a complete `requirements.txt`, install the pinned project dependencies instead:

```bash
pip install -r requirements.txt
```

#### dlib Installation Notes

The `face_recognition` package depends on dlib. Installation can require CMake, a compatible C/C++ compiler, and a supported Python environment. Follow the installation instructions for your operating system if installation fails.

### 3. Start the Backend Server

From the repository root, run:

```bash
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

The API server should be accessible from the development computer at:

```text
http://127.0.0.1:8000
```

FastAPI's interactive API documentation is normally available at:

```text
http://127.0.0.1:8000/docs
```

The `/docs` page lists the endpoints actually registered by the running application.

### 4. Configure and Run the Mobile App

Open a second terminal at the repository root:

```bash
npm install
npx expo start
```

Scan the Expo QR code using Expo Go, or launch the app using an available emulator.

#### Configure the API Base URL

When using a physical phone, replace `127.0.0.1` or `localhost` in the mobile application's API configuration with your computer's local IPv4 address.

For example:

```text
http://192.168.1.10:8000
```

Replace the example address with your computer's actual local IP address.

Make sure that:

- Both devices are connected to the same Wi-Fi network.
- The backend is listening on an address accessible from the phone.
- The computer's firewall permits the required local connections.
- The mobile app uses the correct backend URL.

For production deployments, use an appropriately secured HTTPS endpoint rather than exposing an unsecured development server.

## How to Use

### 1. Launch Ziya
Open the application and choose the required module from the home screen.

### 2. Add an Indoor Map
Open **Map Management**, select the floor-plan processing option, and upload a suitable floor-plan image.

### 3. Plan a Route
Open **Indoor Navigation**, select a processed map, choose the source and destination, and calculate the route.

### 4. Start Voice Navigation
Start navigation to receive the generated step-based spoken instructions.

### 5. Detect Objects
Open **Object Detection**, select the preferred detection range, and point the camera toward the surrounding environment. The app announces relevant detections returned by the backend.

### 6. Recognize People
Open the face recognition functionality and point the camera toward a person. Previously registered people can be identified, while unknown faces can be registered with a name.

### 7. Manage Settings and Records
Use the available settings, map management, and face management screens to customize feedback and maintain saved information.

**Safety note:** Ziya is an assistive prototype, not a replacement for a white cane, guide dog, trained mobility support, or other established mobility aids. Users should not rely on camera-based detections or generated routes as the sole means of avoiding hazards.

## Core Modules

### Indoor Navigation
Uses a graph-based representation of processed indoor maps and A* search to determine a path between selected locations. The mobile interface converts route information into spoken directions.

### Object Detection
Uses the YOLO11n model to identify objects supported by the model's classes. The backend returns detection information that can be filtered and announced by the application.

Detection range settings control the intended level of nearby-object feedback. Their exact behavior depends on the application's implementation.

### Face Recognition
Uses facial encodings to compare detected faces with registered identities. Recognition quality depends on image conditions, camera position, and the stored reference images.

### Floor-Plan Processing
Uses image processing to extract useful spatial and room information from floor plans. The resulting map representation supports navigation graph construction and route calculation.

### Voice Assistant
Provides spoken alerts, navigation instructions, and recognition feedback. Accessibility preferences determine the level of detail used in announcements.

## Utilities

The backend includes a floor-map metadata command-line utility.

Inspect available map metadata using the following commands:

```bash
python backend/floor_maps_cli.py --file <user_maps>.json stats
```

```bash
python backend/floor_maps_cli.py --file <user_maps>.json list
```

```bash
python backend/floor_maps_cli.py --file <user_maps>.json get <map_id>
```

Replace `<user_maps>.json` with the appropriate metadata file path and `<map_id>` with the identifier of the map you want to inspect.

These commands are intended for inspecting map metadata; use the actual storage paths configured in the project.

## Screenshots

Screenshots can be added to a `screenshots/` directory to demonstrate the application's interface and core functionality.

Suggested screenshots:

| Home Screen | Object Detection | Route Planning |
|---|---|---|
| Add `screenshots/home.png` | Add `screenshots/object-detection.png` | Add `screenshots/route-planning.png` |

| Voice Navigation | Face Management | Accessibility Settings |
|---|---|---|
| Add `screenshots/navigation.png` | Add `screenshots/saved-faces.png` | Add `screenshots/settings.png` |

Once the images are committed, replace the placeholders with image links, for example:

```markdown
![Ziya Home Screen](screenshots/home.png)
```

## Testing

The project testing process covers the major functional modules and their integration.

| Test Area | Test Scenario | Expected Outcome |
|---|---|---|
| Application launch | Open the mobile application | Home screen loads |
| Map management | Upload a valid floor plan | Map is processed or an appropriate error is reported |
| Route planning | Select valid source and destination nodes | A valid route is generated when one exists |
| Object detection | Submit a supported camera image | Detection results are returned |
| Face recognition | Submit an image containing a registered person | Matching identity is returned when recognition succeeds |
| Face management | Register, rename, or delete a face | Changes are reflected in stored records |
| Voice assistance | Receive navigation or detection results | Relevant spoken feedback is provided |
| Module integration | Run supported modules together | Responses remain usable within the application's performance constraints |

The project was tested in controlled indoor settings, including college hallways and classrooms.

*Record actual test results, measured response times, and pass/fail outcomes in the final report. Do not mark a test as passed unless it has been executed and verified.*

## Limitations

- **Localization:** Floor-plan route planning does not automatically establish the user's live physical position. Reliable real-time indoor localization is needed to guide a person accurately along a route.
- **Obstacle avoidance:** Object detection identifies supported visual classes but does not guarantee reliable distance estimation or collision avoidance.
- **Map processing:** Room extraction and graph construction depend on the quality and structure of the uploaded floor plan.
- **Network dependency:** Sending camera frames to a remote backend requires a working network connection and can introduce latency.
- **Recognition accuracy:** Lighting, occlusion, camera quality, and viewing angle affect object and face recognition.
- **Performance:** Model inference and frame transmission can create delays on low-end devices or slower networks.
- **Multi-floor navigation:** Elevators, staircases, floor transitions, and cross-floor localization require additional logic.
- **Privacy:** Face images and facial encodings are sensitive personal data and must be stored, accessed, and deleted responsibly.
- **Safety:** The prototype should not be treated as a certified mobility aid or used as the sole source of navigation information.

## Future Enhancements

- **Indoor localization:** Integrate BLE beacons, visual positioning, or other localization techniques to estimate the user's live position.
- **Improved obstacle awareness:** Explore depth estimation, distance sensing, and motion-aware obstacle detection.
- **Multi-floor routing:** Support navigation between floors, including stairs, elevators, and accessible routes.
- **Offline assistance:** Explore on-device inference to reduce latency and dependence on network connectivity.
- **Natural-language commands:** Enable requests such as "Take me to the nearest restroom."
- **Improved floor-map processing:** Add robust room-label extraction, graph validation, and map-editing tools.
- **Privacy and security:** Add appropriate access controls, protected storage, consent workflows, and configurable retention of face records.
- **Performance optimization:** Introduce frame sampling, asynchronous processing, and optimized inference to improve responsiveness.
- **Accessibility improvements:** Expand multilingual voice feedback, configurable speech speed, and user-specific guidance preferences.

## Team

| Team Member | USN |
|---|---|
| Rohan A S | 4MT22CS132 |
| Sinchana | 4MT22CS140 |
| Sameeksha | 4MT22CS159 |
| Vedika L Girap | 4MT22CS181 |

**Project Guide:** Mr. Annappa Swamy D R, Associate Professor, Department of CS&E, MITE Moodabidri

**Head of Department:** Dr. Ravinarayana B

**Principal:** Dr. Prashanth C M

## Acknowledgements

Ziya builds upon open-source technologies and libraries, including:

- [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) — object detection.
- [face_recognition](https://github.com/ageitgey/face_recognition) — face recognition.
- [FastAPI](https://fastapi.tiangolo.com/) — backend API framework.
- [OpenCV](https://opencv.org/) — computer vision and image processing.
- [Expo](https://expo.dev/) — React Native application development.

We acknowledge the open-source communities behind these technologies and the guidance provided by our faculty during the development of this project.

---

**Ziya — Making indoor environments more accessible through AI, computer vision, and voice-first assistance.**

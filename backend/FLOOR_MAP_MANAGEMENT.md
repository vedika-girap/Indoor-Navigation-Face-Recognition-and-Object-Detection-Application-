# Floor Map Management System

## Overview

WhatsApp-style floor map management where **actual image files stay on the user's device** and only **metadata is stored on the server**.

## ✅ EXPO OPTIMIZED - Ready to Use!

This system is **fully optimized for Expo React Native apps**. The architecture is:

- **Frontend (Expo)**: Uses `expo-file-system` to store images locally in app's document directory
- **Backend (FastAPI)**: Only stores metadata (JSON files), never handles actual image files
- **Storage**: Images stay on device using `FileSystem.documentDirectory` (permanent storage)
- **Works Offline**: Once downloaded, maps work without internet connection

### How It Works in Expo:

```
📱 Device (Expo App):
└── FileSystem.documentDirectory/floor_maps/
    ├── map_1730820000000.png  ← Actual image file (1-10MB each)
    ├── map_1730821000000.png
    └── map_1730822000000.png

☁️ Server (FastAPI):
└── floor_maps_metadata/
    └── user123_maps.json  ← Only metadata (~1KB)
```

**No changes needed to backend** - it already follows this architecture!

## Key Features

✅ Add floor maps with metadata  
✅ List all user's floor maps  
✅ Get specific floor map details  
✅ Update map metadata  
✅ Soft delete (mark as inactive)  
✅ Permanent delete (remove metadata)  
✅ Statistics and analytics  
✅ Multi-user support  
✅ Building and floor organization

## How It Works (WhatsApp-Style)

### Data Storage

```
Device Side (User):
├── /storage/maps/
│   ├── building_a_floor_1.png  ← Actual image file
│   ├── building_a_floor_2.png
│   └── building_b_floor_1.png

Server Side:
└── floor_maps_metadata/
    └── user123_maps.json  ← Only metadata
```

### Metadata Structure

```json
{
  "maps": [
    {
      "map_id": "map_123",
      "map_name": "Main Building - Floor 1",
      "building_name": "Main Building",
      "floor_number": "1",
      "local_uri": "file:///storage/maps/building_a_floor_1.png",
      "metadata": {
        "width": 2000,
        "height": 1500,
        "file_size": 524288,
        "added_at": "2025-11-05T10:30:00"
      },
      "added_at": "2025-11-05T10:30:00",
      "last_accessed": "2025-11-05T14:25:00",
      "is_active": true
    }
  ]
}
```

## API Endpoints

### 1. Add Floor Map

**POST** `/floor_maps/add`

Add a new floor map or update existing one.

**Form Data:**

```
user_id: string (required)
map_id: string (required) - Unique identifier for this map
map_name: string (required) - Display name
building_name: string (optional) - Building name
floor_number: string (optional) - Floor number/name
local_uri: string (required) - Local device file path
metadata: string (optional) - JSON string with additional data
```

**Example Request:**

```javascript
const formData = new FormData();
formData.append("user_id", "user123");
formData.append("map_id", "map_" + Date.now());
formData.append("map_name", "Main Building - Floor 1");
formData.append("building_name", "Main Building");
formData.append("floor_number", "1");
formData.append("local_uri", "file:///storage/maps/floor1.png");
formData.append(
  "metadata",
  JSON.stringify({
    width: 2000,
    height: 1500,
    added_at: new Date().toISOString(),
  })
);

const response = await fetch("http://SERVER/floor_maps/add", {
  method: "POST",
  body: formData,
});
```

**Response:**

```json
{
  "success": true,
  "message": "Floor map 'Main Building - Floor 1' added successfully",
  "action": "added",
  "map": {
    "map_id": "map_123",
    "map_name": "Main Building - Floor 1",
    "building_name": "Main Building",
    "floor_number": "1",
    "local_uri": "file:///storage/maps/floor1.png",
    "metadata": {...},
    "is_active": true
  },
  "total_maps": 5
}
```

---

### 2. List All Floor Maps

**GET** `/floor_maps/list/{user_id}`

Get all active floor maps for a user.

**Example Request:**

```javascript
const response = await fetch("http://SERVER/floor_maps/list/user123");
const data = await response.json();
```

**Response:**

```json
{
  "success": true,
  "user_id": "user123",
  "maps": [
    {
      "map_id": "map_123",
      "map_name": "Main Building - Floor 1",
      "building_name": "Main Building",
      "floor_number": "1",
      "local_uri": "file:///storage/maps/floor1.png",
      "metadata": {...},
      "is_active": true
    },
    {...}
  ],
  "total_maps": 5
}
```

---

### 3. Get Specific Floor Map

**GET** `/floor_maps/get/{user_id}/{map_id}`

Get details of a specific floor map.

**Example Request:**

```javascript
const response = await fetch("http://SERVER/floor_maps/get/user123/map_123");
const data = await response.json();
```

**Response:**

```json
{
  "success": true,
  "map": {
    "map_id": "map_123",
    "map_name": "Main Building - Floor 1",
    "local_uri": "file:///storage/maps/floor1.png",
    "last_accessed": "2025-11-05T14:30:00",
    ...
  }
}
```

---

### 4. Update Floor Map Metadata

**POST** `/floor_maps/update_metadata/{user_id}/{map_id}`

Update map information without changing the local file.

**Form Data:**

```
map_name: string (optional)
building_name: string (optional)
floor_number: string (optional)
metadata: string (optional) - JSON to merge with existing
```

**Example Request:**

```javascript
const formData = new FormData();
formData.append("map_name", "Main Building - Ground Floor");
formData.append("floor_number", "G");
formData.append(
  "metadata",
  JSON.stringify({
    notes: "Recently renovated",
  })
);

const response = await fetch(
  "http://SERVER/floor_maps/update_metadata/user123/map_123",
  { method: "POST", body: formData }
);
```

**Response:**

```json
{
  "success": true,
  "message": "Floor map metadata updated successfully",
  "map": {...}
}
```

---

### 5. Soft Delete Floor Map

**DELETE** `/floor_maps/delete/{user_id}/{map_id}`

Mark floor map as inactive (can be restored later).

**Example Request:**

```javascript
const response = await fetch(
  "http://SERVER/floor_maps/delete/user123/map_123",
  { method: "DELETE" }
);
```

**Response:**

```json
{
  "success": true,
  "message": "Floor map 'Main Building - Floor 1' deleted successfully",
  "remaining_maps": 4
}
```

---

### 6. Permanently Delete Floor Map

**DELETE** `/floor_maps/delete_permanent/{user_id}/{map_id}`

Permanently remove metadata from server. **User must delete local file separately.**

**Example Request:**

```javascript
const response = await fetch(
  "http://SERVER/floor_maps/delete_permanent/user123/map_123",
  { method: "DELETE" }
);
```

**Response:**

```json
{
  "success": true,
  "message": "Floor map 'Main Building - Floor 1' permanently deleted from server",
  "note": "Remember to delete the local file from your device",
  "local_uri": "file:///storage/maps/floor1.png",
  "remaining_maps": 4
}
```

---

### 7. Get Statistics

**GET** `/floor_maps/stats/{user_id}`

Get statistics about user's floor maps.

**Example Request:**

```javascript
const response = await fetch("http://SERVER/floor_maps/stats/user123");
const data = await response.json();
```

**Response:**

```json
{
  "success": true,
  "user_id": "user123",
  "stats": {
    "total_maps": 5,
    "total_deleted": 2,
    "unique_buildings": 3,
    "unique_floors": 8,
    "buildings": ["Main Building", "Annex", "Library"],
    "floors": ["1", "2", "3", "G", "B1"]
  }
}
```

---

## React Native Implementation

### Save Map to Device and Register

```javascript
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";

const addFloorMap = async (userId) => {
  try {
    // 1. Let user pick a map image
    const result = await DocumentPicker.getDocumentAsync({
      type: "image/*",
      copyToCacheDirectory: false,
    });

    if (result.canceled) return;

    const file = result.assets[0];

    // 2. Copy to permanent app storage
    const fileName = `map_${Date.now()}.png`;
    const destPath = `${FileSystem.documentDirectory}maps/${fileName}`;

    // Create directory if needed
    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}maps/`,
      { intermediates: true }
    );

    // Copy file
    await FileSystem.copyAsync({
      from: file.uri,
      to: destPath,
    });

    // 3. Register metadata with server
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("map_id", `map_${Date.now()}`);
    formData.append("map_name", file.name);
    formData.append("local_uri", destPath);
    formData.append(
      "metadata",
      JSON.stringify({
        original_name: file.name,
        file_size: file.size,
        added_at: new Date().toISOString(),
      })
    );

    const response = await fetch("http://SERVER/floor_maps/add", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    console.log("Map added:", data);

    return data;
  } catch (error) {
    console.error("Error adding map:", error);
    throw error;
  }
};
```

### Load and Display Map

```javascript
import { Image } from "react-native";

const loadFloorMap = async (userId, mapId) => {
  try {
    // 1. Get metadata from server
    const response = await fetch(
      `http://SERVER/floor_maps/get/${userId}/${mapId}`
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error("Map not found");
    }

    const map = data.map;

    // 2. Check if local file exists
    const fileInfo = await FileSystem.getInfoAsync(map.local_uri);

    if (!fileInfo.exists) {
      Alert.alert("Error", "Map file not found on device");
      return null;
    }

    // 3. Display the map
    return (
      <Image
        source={{ uri: map.local_uri }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="contain"
      />
    );
  } catch (error) {
    console.error("Error loading map:", error);
    throw error;
  }
};
```

### Delete Map (Both Server and Device)

```javascript
const deleteFloorMap = async (userId, mapId) => {
  try {
    // 1. Get map details to find local URI
    const getResponse = await fetch(
      `http://SERVER/floor_maps/get/${userId}/${mapId}`
    );
    const getData = await getResponse.json();

    if (!getData.success) {
      throw new Error("Map not found");
    }

    const localUri = getData.map.local_uri;

    // 2. Delete from server (permanent)
    const deleteResponse = await fetch(
      `http://SERVER/floor_maps/delete_permanent/${userId}/${mapId}`,
      { method: "DELETE" }
    );

    // 3. Delete local file
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri);
      console.log("Local file deleted");
    }

    console.log("Map completely deleted");
    return true;
  } catch (error) {
    console.error("Error deleting map:", error);
    throw error;
  }
};
```

### List All Maps

```javascript
const FloorMapsList = ({ userId }) => {
  const [maps, setMaps] = useState([]);

  useEffect(() => {
    loadMaps();
  }, []);

  const loadMaps = async () => {
    try {
      const response = await fetch(`http://SERVER/floor_maps/list/${userId}`);
      const data = await response.json();

      if (data.success) {
        setMaps(data.maps);
      }
    } catch (error) {
      console.error("Error loading maps:", error);
    }
  };

  return (
    <ScrollView>
      {maps.map((map) => (
        <TouchableOpacity
          key={map.map_id}
          onPress={() => navigation.navigate("MapView", { map })}
        >
          <Text>{map.map_name}</Text>
          <Text>
            {map.building_name} - Floor {map.floor_number}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
```

---

## Benefits of This Approach

### 1. **Low Server Storage**

- Only JSON metadata stored on server (~1KB per map)
- Actual images (1-10MB each) stay on device
- Scales to thousands of users easily

### 2. **Offline Access**

- Maps available without internet connection
- Fast loading (local file access)
- No download delays

### 3. **Privacy**

- Sensitive building layouts stay on user's device
- User controls when to delete actual files
- Server only tracks metadata

### 4. **Flexibility**

- Users can backup/restore maps independently
- Easy to transfer maps between devices
- Server can be down, maps still accessible

### 5. **Cost Effective**

- Minimal server bandwidth usage
- No image hosting costs
- Simple JSON file storage

---

## Error Handling

```javascript
const safeLoadMap = async (userId, mapId) => {
  try {
    // Get metadata
    const response = await fetch(
      `http://SERVER/floor_maps/get/${userId}/${mapId}`
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error("Map metadata not found on server");
    }

    // Check local file
    const fileInfo = await FileSystem.getInfoAsync(data.map.local_uri);

    if (!fileInfo.exists) {
      // File missing - offer to re-download or delete metadata
      Alert.alert(
        "Map File Missing",
        "The map file is not on this device. Would you like to remove it from your list?",
        [
          {
            text: "Keep in List",
            style: "cancel",
          },
          {
            text: "Remove",
            onPress: async () => {
              await fetch(
                `http://SERVER/floor_maps/delete/${userId}/${mapId}`,
                { method: "DELETE" }
              );
            },
          },
        ]
      );
      return null;
    }

    return data.map;
  } catch (error) {
    console.error("Error loading map:", error);
    Alert.alert("Error", "Failed to load map: " + error.message);
    return null;
  }
};
```

---

## Storage Locations

### Server

```
backend/
└── floor_maps_metadata/
    ├── user123_maps.json
    ├── user456_maps.json
    └── user789_maps.json
```

### Device (Example)

```
/data/data/com.yourapp/files/
└── maps/
    ├── map_1730820000000.png
    ├── map_1730821000000.png
    └── map_1730822000000.png
```

---

## Testing

### Test with cURL

```bash
# Add a map
curl -X POST http://localhost:8000/floor_maps/add \
  -F "user_id=user123" \
  -F "map_id=map_test_1" \
  -F "map_name=Test Building - Floor 1" \
  -F "building_name=Test Building" \
  -F "floor_number=1" \
  -F "local_uri=file:///storage/test_map.png" \
  -F "metadata={\"test\":true}"

# List maps
curl http://localhost:8000/floor_maps/list/user123

# Get specific map
curl http://localhost:8000/floor_maps/get/user123/map_test_1

# Update metadata
curl -X POST http://localhost:8000/floor_maps/update_metadata/user123/map_test_1 \
  -F "map_name=Updated Name"

# Soft delete
curl -X DELETE http://localhost:8000/floor_maps/delete/user123/map_test_1

# Get stats
curl http://localhost:8000/floor_maps/stats/user123
```

---

## Migration Guide

If you already have floor maps stored differently:

1. **From Server Storage:**

   - Download each map to device
   - Register local URI with new API
   - Optionally delete from server storage

2. **From Cloud Storage:**

   - Download to device storage
   - Register with API
   - Keep cloud backup if desired

3. **From Other Apps:**
   - Export maps to device
   - Import into your app's storage
   - Register with API

---

## Best Practices

1. **Always check file exists** before loading
2. **Handle missing files gracefully** (offer to remove metadata)
3. **Use consistent naming** for local files
4. **Store in app's document directory** (survives app updates)
5. **Implement backup/restore** functionality
6. **Validate file integrity** (size, format) before displaying
7. **Clean up orphaned files** periodically
8. **Sync metadata** when switching devices

---

## Security Considerations

1. **User Isolation:** Each user's maps are separate (user_id)
2. **No File Access:** Server never accesses actual image files
3. **Metadata Only:** Server stores only non-sensitive metadata
4. **Local Control:** Users control file deletion
5. **Optional Encryption:** Implement device-side encryption if needed

---

**Summary:** This system provides WhatsApp-style floor map management with minimal server storage, maximum user control, and offline functionality! 🗺️

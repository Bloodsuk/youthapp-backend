# Live Phlebotomist Tracking — Flutter Integration Guide

## Overview

Real-time location tracking so the **customer can see how far the phleb is** while en route. Uses Socket.io for live updates + a REST endpoint as fallback.

---

## Flutter Package Required

```yaml
# pubspec.yaml
dependencies:
  socket_io_client: ^2.0.3+1
```

---

## Socket.io Connection

Connect to the same server URL/port as the REST API. Pass the JWT token (from login) in the `auth` object.

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io('http://YOUR_SERVER_URL:7010', 
  IO.OptionBuilder()
    .setTransports(['websocket'])
    .setAuth({'token': jwtToken}) // JWT from login response
    .disableAutoConnect()
    .build()
);

socket.connect();

socket.onConnect((_) {
  print('Connected to tracking server');
});

socket.onDisconnect((_) {
  print('Disconnected from tracking server');
});

socket.on('error_msg', (data) {
  print('Error: ${data['message']}');
});
```

---

## For CUSTOMER App (Tracking the Phleb)

### 1. Subscribe to tracking (when customer opens tracking screen)

Send your current GPS coordinates along with the order ID:

```dart
// Get customer's current position first
Position position = await Geolocator.getCurrentPosition();

socket.emit('track_job', {
  'order_id': 123,          // the order ID
  'lat': position.latitude,  // customer's current latitude
  'lng': position.longitude, // customer's current longitude
});
```

### 2. Listen for location updates

```dart
socket.on('location_update', (data) {
  // data = {
  //   "pleb_lat": 51.5074,        // Phleb's current latitude
  //   "pleb_lng": -0.1278,        // Phleb's current longitude
  //   "distance_text": "3.2 km",  // Human-readable distance
  //   "duration_text": "8 mins",  // Human-readable ETA
  //   "distance_value": 3200,     // Distance in meters
  //   "duration_value": 480,      // Duration in seconds
  //   "updated_at": "2026-05-21T05:30:00.000Z"
  // }
  
  double plebLat = data['pleb_lat'];
  double plebLng = data['pleb_lng'];
  String distance = data['distance_text'];
  String eta = data['duration_text'];
  
  // Update UI — show on map + display ETA
});
```

### 3. Unsubscribe (when customer leaves tracking screen)

```dart
socket.emit('stop_tracking', {'order_id': 123});
```

### 4. Full customer example

```dart
class TrackingScreen extends StatefulWidget {
  final int orderId;
  const TrackingScreen({required this.orderId});
  
  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  late IO.Socket socket;
  double? plebLat;
  double? plebLng;
  String distance = 'Calculating...';
  String eta = 'Calculating...';

  @override
  void initState() {
    super.initState();
    connectSocket();
  }

  void connectSocket() async {
    socket = IO.io('http://YOUR_SERVER_URL:7010',
      IO.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': authToken})
        .disableAutoConnect()
        .build()
    );

    socket.connect();

    socket.onConnect((_) async {
      Position pos = await Geolocator.getCurrentPosition();
      socket.emit('track_job', {
        'order_id': widget.orderId,
        'lat': pos.latitude,
        'lng': pos.longitude,
      });
    });

    socket.on('location_update', (data) {
      setState(() {
        plebLat = data['pleb_lat']?.toDouble();
        plebLng = data['pleb_lng']?.toDouble();
        distance = data['distance_text'] ?? 'Unknown';
        eta = data['duration_text'] ?? 'Unknown';
      });
    });

    socket.on('error_msg', (data) {
      print('Tracking error: ${data['message']}');
    });
  }

  @override
  void dispose() {
    socket.emit('stop_tracking', {'order_id': widget.orderId});
    socket.disconnect();
    socket.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // Show map with phleb marker at (plebLat, plebLng)
          Text('Distance: $distance'),
          Text('ETA: $eta'),
        ],
      ),
    );
  }
}
```

---

## For PHLEB App (Sending Location)

### 1. Start sending location when job begins

```dart
import 'package:geolocator/geolocator.dart';

late IO.Socket socket;
StreamSubscription<Position>? locationStream;

void startTracking(int jobId) {
  socket.connect();
  
  // Send location every 10 seconds
  locationStream = Geolocator.getPositionStream(
    locationSettings: LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 50, // meters — only fire if moved 50m+
    ),
  ).listen((Position position) {
    socket.emit('update_location', {
      'job_id': jobId,  // pleb_jobs.id (the job row ID)
      'lat': position.latitude,
      'lng': position.longitude,
    });
  });
}
```

### 2. Stop tracking when job is completed

```dart
void stopTracking(int jobId) {
  locationStream?.cancel();
  socket.emit('stop_tracking', {'job_id': jobId});
  socket.disconnect();
}
```

### Important: `job_id` is the `pleb_jobs.id` (the ID returned when the job was assigned), NOT the order_id.

---

## REST Fallback (if WebSocket drops)

If the socket connection is unreliable, the customer app can poll this endpoint:

```
GET /api/pleb_jobs/live_location/:order_id
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "pleb_lat": 51.5074,
    "pleb_lng": -0.1278,
    "distance_text": "3.2 km",
    "duration_text": "8 mins",
    "distance_value": 3200,
    "duration_value": 480,
    "updated_at": "2026-05-21T05:30:00.000Z"
  }
}
```

**Response (404 — phleb hasn't started tracking yet):**
```json
{
  "success": false,
  "error": "No live location available for this order."
}
```

---

## Event Summary Table

| Who | Event | Direction | Payload |
|-----|-------|-----------|---------|
| Customer | `track_job` | Emit → Server | `{ order_id: int, lat: double, lng: double }` |
| Customer | `stop_tracking` | Emit → Server | `{ order_id: int }` |
| Customer | `location_update` | Server → Listen | `{ pleb_lat, pleb_lng, distance_text, duration_text, distance_value, duration_value, updated_at }` |
| Phleb | `update_location` | Emit → Server | `{ job_id: int, lat: double, lng: double }` |
| Phleb | `stop_tracking` | Emit → Server | `{ job_id: int }` |
| Both | `error_msg` | Server → Listen | `{ message: string }` |

---

## Notes

- Server URL is the same as the API base URL (same port)
- JWT token is the same one received from `/api/auth/login`
- The server identifies user role from the JWT — phlebotomists can only send location, customers can only subscribe
- Location updates are only sent while the job status is active (not Delivered/Cancelled)
- Distance is calculated via Google Maps driving directions using coordinates on both sides (phleb GPS + customer GPS)
- Customer sends their lat/lng when they emit `track_job` — this is stored in the `pleb_live_locations` table
- If customer doesn't send lat/lng, fallback uses the customer's text address from the database
- If phleb hasn't moved significantly (<100m), cached distance is returned to save API calls

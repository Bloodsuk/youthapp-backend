# Pleb Availability & Range Implementation - COMPLETE ✅

## 📋 Overview

Created a flexible availability system that allows plebs to set multiple time slots per day (e.g., Monday 9am-12pm and 5pm-8pm) along with their service range/distance.

**Existing fields in `phlebotomy_applications` remain unchanged:**
- `working_hours` (string) - kept for quick onboarding
- `travel_radius` (string) - kept for quick onboarding

## 🗄️ Database Schema

### Table: `pleb_availability`

**Single table for both availability slots and service range!**

```sql
CREATE TABLE pleb_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pleb_id INT NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
  start_time TIME NOT NULL,  -- e.g., '09:00:00'
  end_time TIME NOT NULL,    -- e.g., '12:00:00'
  is_available TINYINT(1) DEFAULT 1,  -- Can temporarily disable slots
  
  -- Service range (stored on each row, same value for all rows of same pleb)
  max_distance_miles DECIMAL(10,2) NOT NULL,
  max_distance_km DECIMAL(10,2) GENERATED ALWAYS AS (max_distance_miles * 1.60934) STORED,
  unit ENUM('miles', 'km') DEFAULT 'miles',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (pleb_id) REFERENCES phlebotomy_applications(id) ON DELETE CASCADE,
  INDEX idx_pleb_id (pleb_id),
  INDEX idx_day_time (day_of_week, start_time, end_time),
  INDEX idx_available (is_available),
  INDEX idx_distance (max_distance_miles)
);
```

**Key Features:**
- ✅ Multiple time slots per day (separate rows)
- ✅ Distance/range stored on each row (same value for all slots of same pleb)
- ✅ Easy to query and filter
- ✅ Validates no overlapping slots

**Example Data:**
```
pleb_id=123, day_of_week='Monday', start_time='09:00:00', end_time='12:00:00', max_distance_miles=50.00
pleb_id=123, day_of_week='Monday', start_time='17:00:00', end_time='20:00:00', max_distance_miles=50.00
pleb_id=123, day_of_week='Tuesday', start_time='09:00:00', end_time='17:00:00', max_distance_miles=50.00
```

---

## 📡 API Endpoints

### 1. GET Availability & Range
```
GET /pleb_jobs/availability/:pleb_id?
```

**Access:**
- **Plebs:** Get their own (no `pleb_id` needed, uses token)
- **Customers:** Get any pleb's availability (requires `pleb_id` param)
- **Admins:** Get any pleb's availability (requires `pleb_id` param)

**Response:**
```json
{
  "success": true,
  "data": {
    "pleb_id": 123,
    "availability": {
      "Monday": [
        { "id": 1, "start_time": "09:00", "end_time": "12:00", "is_available": true },
        { "id": 2, "start_time": "17:00", "end_time": "20:00", "is_available": true }
      ],
      "Tuesday": [
        { "id": 3, "start_time": "09:00", "end_time": "17:00", "is_available": true }
      ],
      "Wednesday": [],
      "Thursday": [],
      "Friday": [],
      "Saturday": [],
      "Sunday": []
    },
    "service_range": {
      "max_distance_miles": 50.00,
      "max_distance_km": 80.47,
      "unit": "miles"
    }
  }
}
```

---

### 2. PUT/UPDATE Availability & Range
```
PUT /pleb_jobs/availability
```

**Access:**
- **Plebs:** Update their own (pleb_id from token)
- **Admins:** Update any pleb (pleb_id in body)

**Request Body:**
```json
{
  "availability": {
    "Monday": [
      { "start_time": "09:00", "end_time": "12:00", "is_available": true },
      { "start_time": "17:00", "end_time": "20:00", "is_available": true }
    ],
    "Tuesday": [
      { "start_time": "09:00", "end_time": "17:00", "is_available": true }
    ],
    "Wednesday": [],
    "Thursday": [],
    "Friday": [],
    "Saturday": [],
    "Sunday": []
  },
  "service_range": {
    "max_distance": 50,
    "unit": "miles"
  }
}
```

**Note:** This **replaces** all existing slots for the pleb. If a day is not provided or is empty array, all slots for that day are removed.

**Response:**
```json
{
  "success": true,
  "message": "Availability and range updated successfully",
  "data": {
    "pleb_id": 123,
    "availability": {...},
    "service_range": {...}
  }
}
```

---

## ✅ Validation Rules

1. **Time Format:** Must be "HH:mm" (e.g., "09:00", "17:00")
2. **Time Range:** Start time must be before end time
3. **Overlapping Slots:** Cannot overlap on the same day
4. **Distance:** Must be greater than 0
5. **Unit:** Must be 'miles' or 'km' (automatically converted to miles for storage)

---

## 🚀 Migration

**Run the migration:**
```bash
mysql -u YOUR_USER -p YOUR_DATABASE < scripts/create_pleb_availability_table.sql
```

**File:** `scripts/create_pleb_availability_table.sql`

---

## 📂 Files Created/Modified

### New Files:
- ✅ `scripts/create_pleb_availability_table.sql` - Migration script
- ✅ `src/interfaces/IPlebAvailability.ts` - TypeScript interfaces
- ✅ `src/services/PlebAvailabilityService.ts` - Business logic
- ✅ `src/controllers/PlebAvailabilityController.ts` - API handlers

### Modified Files:
- ✅ `src/router/plebJobRouter.ts` - Added new routes
- ✅ `src/constants/Paths.ts` - Added path constants

---

## 🔄 Usage Examples

### Example 1: Pleb sets multiple slots for Monday
```json
PUT /pleb_jobs/availability
{
  "availability": {
    "Monday": [
      { "start_time": "09:00", "end_time": "12:00", "is_available": true },
      { "start_time": "17:00", "end_time": "20:00", "is_available": true }
    ],
    "Tuesday": [
      { "start_time": "09:00", "end_time": "17:00", "is_available": true }
    ],
    "Wednesday": [],
    "Thursday": [],
    "Friday": [],
    "Saturday": [],
    "Sunday": []
  },
  "service_range": {
    "max_distance": 50,
    "unit": "miles"
  }
}
```

### Example 2: Customer views pleb availability
```bash
GET /pleb_jobs/availability/123
Authorization: Bearer <customer_token>
```

---

## 🎯 Key Features

1. ✅ **Flexible:** Multiple time slots per day
2. ✅ **Validated:** No overlapping slots
3. ✅ **Atomic Updates:** Transaction-based (all or nothing)
4. ✅ **Easy Filtering:** Can query "available plebs on Monday at 10am"
5. ✅ **Single Table:** Availability + range in one table
6. ✅ **Backward Compatible:** Existing `working_hours` and `travel_radius` fields remain

---

## 📝 Notes

- Distance is stored on every row (same value for all slots of same pleb)
- When updating, all existing slots are replaced (not merged)
- Empty days remove all slots for that day
- Time slots are stored in TIME format in database, returned as "HH:mm" in API

---

**Status: ✅ COMPLETE and READY TO USE!**


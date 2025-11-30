# Pleb Availability & Range Implementation Overview

## 📋 Current State Analysis

### Existing Tables:
1. **`phlebotomy_applications`** - Main pleb/phlebotomist table
   - Has `travel_radius` (string), `working_hours` (string), `unavailable_times` (string)
   - These are currently stored as simple text fields
   - Has `lat`, `lng` for location

2. **`pleb_jobs`** - Links plebs to orders/jobs
   - Fields: `id`, `pleb_id`, `order_id`, `job_status`, `tracking_number`, `created_at`

### Existing Functionality:
- ✅ Distance calculation between pleb location and customer (Google Maps API)
- ✅ Job assignment workflow
- ✅ Pleb authentication

---

## 🗄️ Proposed Database Schema

### Option 1: Separate Tables (Recommended) ⭐

#### 1. `pleb_availability` Table
Stores weekly availability schedule with day-of-week and time ranges.

```sql
CREATE TABLE pleb_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pleb_id INT NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
  start_time TIME NOT NULL,  -- e.g., '09:00:00'
  end_time TIME NOT NULL,    -- e.g., '17:00:00'
  is_available TINYINT(1) DEFAULT 1,  -- Can mark specific days as unavailable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pleb_id) REFERENCES phlebotomy_applications(id) ON DELETE CASCADE,
  UNIQUE KEY unique_pleb_day (pleb_id, day_of_week),
  INDEX idx_pleb_id (pleb_id),
  INDEX idx_day_available (day_of_week, is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Benefits:**
- ✅ Easy to query "available plebs on Monday"
- ✅ Can store multiple time slots per day (if needed in future)
- ✅ Normalized data structure
- ✅ Easy to validate time ranges

**Data Example:**
```
pleb_id=1, day_of_week='Monday', start_time='09:00:00', end_time='17:00:00', is_available=1
pleb_id=1, day_of_week='Tuesday', start_time='09:00:00', end_time='17:00:00', is_available=1
pleb_id=1, day_of_week='Wednesday', start_time='09:00:00', end_time='17:00:00', is_available=1
...
pleb_id=1, day_of_week='Saturday', start_time=NULL, end_time=NULL, is_available=0
```

---

#### 2. `pleb_service_range` Table
Stores the maximum distance/range a pleb is willing to travel.

```sql
CREATE TABLE pleb_service_range (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pleb_id INT NOT NULL UNIQUE,  -- One range per pleb
  max_distance_miles DECIMAL(10,2) NOT NULL,  -- e.g., 50.00
  max_distance_km DECIMAL(10,2) GENERATED ALWAYS AS (max_distance_miles * 1.60934) STORED,
  unit ENUM('miles', 'km') DEFAULT 'miles',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pleb_id) REFERENCES phlebotomy_applications(id) ON DELETE CASCADE,
  INDEX idx_distance (max_distance_miles)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Benefits:**
- ✅ One record per pleb (simple)
- ✅ Auto-calculates km from miles
- ✅ Easy to filter plebs by distance capability
- ✅ Can be used with existing distance calculation logic

**Data Example:**
```
pleb_id=1, max_distance_miles=50.00, unit='miles'
pleb_id=2, max_distance_miles=30.00, unit='miles'
```

---

### Alternative: Option 2 - JSON Columns
Store as JSON in `phlebotomy_applications` table:
- `availability_schedule JSON`
- `service_range JSON`

**Not Recommended** because:
- ❌ Harder to query/filter
- ❌ No referential integrity
- ❌ More complex to validate

---

## 📝 TypeScript Interfaces

```typescript
// src/interfaces/IPlebAvailability.ts
export interface IPlebAvailability {
  id: number;
  pleb_id: number;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  start_time: string;  // Format: "HH:mm:ss" or "HH:mm"
  end_time: string;
  is_available: number;  // 0 or 1
  created_at: string;
  updated_at: string;
}

// src/interfaces/IPlebServiceRange.ts
export interface IPlebServiceRange {
  id: number;
  pleb_id: number;
  max_distance_miles: number;
  max_distance_km: number;
  unit: 'miles' | 'km';
  created_at: string;
  updated_at: string;
}

// Request/Response DTOs
export interface IPlebAvailabilityUpdateRequest {
  availability: Array<{
    day_of_week: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
  }>;
  service_range: {
    max_distance: number;
    unit: 'miles' | 'km';
  };
}
```

---

## 🚀 API Design

### Single API Approach (Recommended) ⭐

**Endpoint:** `PUT /pleb_jobs/availability/:pleb_id`

**Why Single API:**
- ✅ Availability and range are related - usually updated together
- ✅ Reduces number of API calls
- ✅ Atomic updates (can use transactions)
- ✅ Simpler frontend integration
- ✅ Less network overhead

**Request Body:**
```json
{
  "availability": [
    {
      "day_of_week": "Monday",
      "start_time": "09:00",
      "end_time": "17:00",
      "is_available": true
    },
    {
      "day_of_week": "Tuesday",
      "start_time": "09:00",
      "end_time": "17:00",
      "is_available": true
    },
    {
      "day_of_week": "Saturday",
      "is_available": false
    }
    // ... all 7 days
  ],
  "service_range": {
    "max_distance": 50,
    "unit": "miles"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Availability and range updated successfully",
  "data": {
    "pleb_id": 1,
    "availability": [...],
    "service_range": {
      "max_distance_miles": 50.00,
      "max_distance_km": 80.47,
      "unit": "miles"
    }
  }
}
```

**Alternative Endpoints (if needed separately):**
- `GET /pleb_jobs/availability/:pleb_id` - Get current availability
- `PUT /pleb_jobs/availability/:pleb_id` - Update availability & range
- `GET /pleb_jobs/range/:pleb_id` - Get current range
- `PUT /pleb_jobs/range/:pleb_id` - Update range only

---

## 📂 File Structure

Following existing patterns:

```
src/
├── interfaces/
│   ├── IPlebAvailability.ts       (NEW)
│   └── IPlebServiceRange.ts       (NEW)
├── controllers/
│   └── PlebAvailabilityController.ts  (NEW)
├── services/
│   └── PlebAvailabilityService.ts     (NEW)
├── router/
│   └── plebAvailabilityRouter.ts      (NEW) OR extend plebJobRouter.ts
└── constants/
    └── Paths.ts                      (UPDATE - add new routes)
```

---

## 🔄 Implementation Flow

### 1. **GET Availability & Range**
- Route: `GET /pleb_jobs/availability/:pleb_id`
- Returns: Full weekly schedule + service range
- Validation: Check if pleb exists and is active

### 2. **UPDATE Availability & Range**
- Route: `PUT /pleb_jobs/availability/:pleb_id`
- Action:
  - Delete existing availability records for this pleb
  - Insert new availability records (transaction)
  - Upsert service range (INSERT ON DUPLICATE KEY UPDATE)
- Validation:
  - Pleb exists and is active
  - Time format validation (HH:mm)
  - Start time < End time
  - All 7 days should be provided
  - Distance > 0

### 3. **Query Available Plebs** (Future Enhancement)
- Filter plebs by:
  - Day of week
  - Time slot
  - Distance from customer location
- Useful for automatic job assignment

---

## 🔐 Authentication & Authorization

Based on existing patterns:
- ✅ Pleb can update their own availability/range
- ✅ Admin can update any pleb's availability/range
- ✅ Use existing session middleware: `res.locals.sessionUser`
- ✅ Check `isPleb` flag or user_level

---

## 🧪 Validation Rules

1. **Availability:**
   - All 7 days must be provided
   - Time format: "HH:mm" or "HH:mm:ss"
   - Start time must be before end time
   - If `is_available=false`, start_time and end_time can be null
   
2. **Service Range:**
   - Distance must be > 0
   - Unit must be 'miles' or 'km'
   - If unit is 'km', convert to miles for storage

3. **Pleb:**
   - Must exist in `phlebotomy_applications`
   - Must be active (`is_active = 1`)

---

## 🔄 Migration Strategy

1. **Create new tables** (backward compatible)
2. **Migrate existing data** (if any):
   - Parse `working_hours` string → create availability records
   - Parse `travel_radius` string → create service_range record
3. **Keep old columns** temporarily for backward compatibility
4. **Phase out old columns** after frontend is updated

---

## 📊 Usage Examples

### Example 1: Pleb sets weekly schedule
```javascript
// Pleb available Mon-Fri 9AM-5PM, weekends off, 50 mile range
PUT /pleb_jobs/availability/123
{
  "availability": [
    { "day_of_week": "Monday", "start_time": "09:00", "end_time": "17:00", "is_available": true },
    { "day_of_week": "Tuesday", "start_time": "09:00", "end_time": "17:00", "is_available": true },
    // ... Wed, Thu, Fri
    { "day_of_week": "Saturday", "is_available": false },
    { "day_of_week": "Sunday", "is_available": false }
  ],
  "service_range": {
    "max_distance": 50,
    "unit": "miles"
  }
}
```

### Example 2: Get current schedule
```javascript
GET /pleb_jobs/availability/123

Response:
{
  "success": true,
  "data": {
    "pleb_id": 123,
    "availability": [
      { "day_of_week": "Monday", "start_time": "09:00", "end_time": "17:00", "is_available": 1 },
      ...
    ],
    "service_range": {
      "max_distance_miles": 50.00,
      "max_distance_km": 80.47,
      "unit": "miles"
    }
  }
}
```

---

## 🎯 Benefits of This Approach

1. **Structured Data** - Easy to query and filter
2. **Scalable** - Can extend to multiple time slots per day later
3. **Integrates with existing code** - Uses existing distance calculation
4. **Type-safe** - TypeScript interfaces
5. **Follows existing patterns** - Similar to PlebJobController structure
6. **Single API** - Simpler frontend integration

---

## ⚠️ Considerations

1. **Time Zones** - Consider storing timezone or standardize to UTC
2. **Multiple Slots** - Current design supports one slot per day, but can extend
3. **Holidays** - May need separate table for holiday exceptions
4. **Backward Compatibility** - Keep old string fields during migration
5. **Distance Calculation** - Already exists, just need to compare against max_distance

---

## 🚦 Next Steps (After Approval)

1. Create database migration script
2. Create TypeScript interfaces
3. Create Service layer (PlebAvailabilityService)
4. Create Controller layer (PlebAvailabilityController)
5. Add routes to router
6. Update Paths.ts constants
7. Add validation middleware
8. Write tests
9. Update existing distance calculation to check against max_distance

---

**Recommendation:** Use **Option 1 (Separate Tables)** with **Single API** approach for best balance of flexibility and simplicity.



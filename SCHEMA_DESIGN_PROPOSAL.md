# Pleb Availability & Range Table - Schema Design Proposal

## Overview
Create a new table for flexible availability management that allows:
- Multiple time slots per day (e.g., Monday 9am-12pm and 5pm-8pm)
- Distance/range information
- Easy filtering and updates

## Proposed Schema Design

### Option 1: Separate Rows for Each Time Slot (Recommended) ⭐

**Table: `pleb_availability`**

Each time slot is a separate row, allowing unlimited slots per day.

```sql
CREATE TABLE pleb_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pleb_id INT NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
  start_time TIME NOT NULL,  -- e.g., '09:00:00'
  end_time TIME NOT NULL,    -- e.g., '12:00:00'
  is_available TINYINT(1) DEFAULT 1,  -- Can temporarily disable a slot
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pleb_id) REFERENCES phlebotomy_applications(id) ON DELETE CASCADE,
  INDEX idx_pleb_id (pleb_id),
  INDEX idx_day_time (day_of_week, start_time, end_time),
  INDEX idx_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Table: `pleb_service_range`**

One row per pleb for distance/range (stored separately since it's not day-specific).

```sql
CREATE TABLE pleb_service_range (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pleb_id INT NOT NULL UNIQUE,
  max_distance_miles DECIMAL(10,2) NOT NULL,  -- e.g., 50.00
  max_distance_km DECIMAL(10,2) GENERATED ALWAYS AS (max_distance_miles * 1.60934) STORED,
  unit ENUM('miles', 'km') DEFAULT 'miles',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pleb_id) REFERENCES phlebotomy_applications(id) ON DELETE CASCADE,
  INDEX idx_distance (max_distance_miles)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Example Data:**
```
pleb_availability:
id=1, pleb_id=123, day_of_week='Monday', start_time='09:00:00', end_time='12:00:00', is_available=1
id=2, pleb_id=123, day_of_week='Monday', start_time='17:00:00', end_time='20:00:00', is_available=1
id=3, pleb_id=123, day_of_week='Tuesday', start_time='09:00:00', end_time='17:00:00', is_available=1
...

pleb_service_range:
id=1, pleb_id=123, max_distance_miles=50.00, unit='miles'
```

**Pros:**
- ✅ Very flexible - unlimited slots per day
- ✅ Easy to query "available plebs on Monday between 10am-11am"
- ✅ Easy to add/remove individual time slots
- ✅ Normalized and efficient

**Cons:**
- ⚠️ Two tables (but both simple)

---

### Option 2: Combined Table with JSON (Alternative)

**Table: `pleb_availability_and_range`**

Store all time slots per day as JSON, distance in same table.

```sql
CREATE TABLE pleb_availability_and_range (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pleb_id INT NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
  time_slots JSON NOT NULL,  -- [{"start":"09:00","end":"12:00"},{"start":"17:00","end":"20:00"}]
  is_available TINYINT(1) DEFAULT 1,
  max_distance_miles DECIMAL(10,2) NULL,
  max_distance_km DECIMAL(10,2) GENERATED ALWAYS AS (max_distance_miles * 1.60934) STORED,
  unit ENUM('miles', 'km') DEFAULT 'miles',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pleb_id) REFERENCES phlebotomy_applications(id) ON DELETE CASCADE,
  UNIQUE KEY unique_pleb_day (pleb_id, day_of_week),
  INDEX idx_pleb_id (pleb_id),
  INDEX idx_day_available (day_of_week, is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Cons:**
- ❌ Harder to query time ranges in JSON
- ❌ Distance would be duplicated per day (not ideal)

---

## Questions Before Implementation:

1. **Distance/Range**: Should distance be:
   - Overall per pleb (one value)? ✅ Recommended
   - Or different distances for different days?

2. **Table Structure**: Do you prefer:
   - **Option 1**: Two simple tables (availability slots + range) ✅ Recommended
   - **Option 2**: One combined table with JSON

3. **Time Slots**: Should we allow:
   - Overlapping slots? (e.g., 9-12 and 10-2)
   - Or validate no overlaps?

4. **Default Behavior**: When a pleb has NO entries in the new table:
   - Should we fall back to `working_hours` from `phlebotomy_applications`?
   - Or require them to set up availability first?

5. **Weekly vs Daily**: Should availability be:
   - Recurring weekly (same every week)?
   - Or allow specific dates (e.g., "Monday Dec 25th only")?

## Recommendation

Use **Option 1** with two tables:
- `pleb_availability` - Multiple rows per day for time slots
- `pleb_service_range` - One row per pleb for distance

This gives maximum flexibility and easy querying! 🎯


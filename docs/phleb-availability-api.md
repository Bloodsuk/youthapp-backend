# Phleb Availability API Documentation

> For Mobile App Developers

## Overview

This module allows Phlebotomists (Phlebs) to manage their availability using an **in-app calendar**. There are **two modes** of availability:

| Mode | What it does | Example |
|------|-------------|---------|
| **Per Dates** | Set availability for a specific calendar date | "April 25, 2026 — 09:00-13:00" |
| **Per Day** | Set a recurring weekly schedule by day of week | "Every Monday — 09:00-12:00, 14:00-17:00" |

Per Day slots automatically apply to **every matching weekday** in the calendar/bookings. Per Dates slots **override** the Per Day schedule for that exact date.

**Base URL:** `/api/pleb_jobs`

**Authentication:** All endpoints require a valid JWT token in the `Authorization: Bearer <token>` header.

**Access Rules:**
- **Phlebotomist:** Can only manage their own availability (pleb_id is automatically taken from the JWT token)
- **Admin:** Can manage any pleb's availability (must provide `pleb_id` in body/params)
- **Customer:** Read-only access (can view calendar, date availability, and day availability)

---

## Endpoints Summary

### Calendar

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/availability/calendar/:pleb_id?` | Monthly calendar view (main screen) |

### Mode 1: Per Dates (date-specific)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 2 | GET | `/availability/dates/:pleb_id?` | Get date-specific slots in a range |
| 3 | POST | `/availability/date` | Add slot(s) for specific date(s) |
| 4 | PUT | `/availability/date/:id` | Edit a date slot |
| 5 | DELETE | `/availability/date/:id` | Delete a date slot |

### Mode 2: Per Day (day-of-week recurring)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 6 | GET | `/availability/days/:pleb_id?` | Get all Per Day slots |
| 7 | POST | `/availability/day` | Add a single day slot (e.g. Monday 10:00-12:00) |
| 8 | PUT | `/availability/day/:id` | Edit a day slot |
| 9 | DELETE | `/availability/day/:id` | Delete a day slot |

---

## 1. GET Calendar View (Monthly)

The **primary endpoint for the calendar UI**. Returns a full month of availability, combining Per Day defaults with any Per Dates entries the phleb has added.

```
GET /api/pleb_jobs/availability/calendar/:pleb_id?
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| month | number | Yes | Month number (1-12) |
| year | number | Yes | Year (e.g. 2026) |

**URL Params:**
- `pleb_id` — Required for Admin/Customer. Phlebs don't need this (uses token).

**Example Request:**
```
GET /api/pleb_jobs/availability/calendar?month=4&year=2026
Authorization: Bearer <phleb_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "pleb_id": 5,
    "month": 4,
    "year": 2026,
    "service_range": {
      "max_distance_miles": 25,
      "max_distance_km": 40.23,
      "unit": "miles"
    },
    "days": [
      {
        "date": "2026-04-01",
        "day_of_week": "Wednesday",
        "source": "weekly_recurring",
        "slots": [
          {
            "id": 12,
            "start_time": "09:00",
            "end_time": "12:00",
            "is_available": true,
            "notes": null
          }
        ]
      },
      {
        "date": "2026-04-02",
        "day_of_week": "Thursday",
        "source": "date_specific",
        "slots": [
          {
            "id": 101,
            "start_time": "10:00",
            "end_time": "15:00",
            "is_available": true,
            "notes": "Available for extra shift"
          }
        ]
      },
      {
        "date": "2026-04-03",
        "day_of_week": "Friday",
        "source": "none",
        "slots": []
      }
    ]
  }
}
```

**`source` field meaning:**
- `"date_specific"` — Phleb explicitly set availability for this exact date (Per Dates)
- `"weekly_recurring"` — No date entry exists; showing the Per Day schedule for this weekday
- `"none"` — No availability at all for this day

---

## Mode 1: Per Dates

Use these endpoints to manage availability for **specific calendar dates**.

### 2. GET Date-Specific Availability

Get only the Per Dates entries a phleb has added (ignores Per Day schedule).

```
GET /api/pleb_jobs/availability/dates/:pleb_id?
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| start_date | string | Yes | Start date (YYYY-MM-DD) |
| end_date | string | Yes | End date (YYYY-MM-DD) |

**Example Request:**
```
GET /api/pleb_jobs/availability/dates?start_date=2026-04-01&end_date=2026-04-30
Authorization: Bearer <phleb_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "pleb_id": 5,
      "specific_date": "2026-04-02",
      "start_time": "10:00",
      "end_time": "15:00",
      "is_available": 1,
      "max_distance_miles": 25,
      "max_distance_km": 40.23,
      "unit": "miles",
      "notes": "Available for extra shift",
      "created_at": "2026-04-01T10:30:00.000Z",
      "updated_at": "2026-04-01T10:30:00.000Z"
    }
  ]
}
```

---

### 3. POST Add Date-Specific Slot(s)

Add one or more availability slots for specific dates. This is the **main action when a phleb taps a calendar date and sets their times**.

```
POST /api/pleb_jobs/availability/date
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| slots | array | Yes | Array of slot objects (at least 1) |
| slots[].specific_date | string | Yes | Date in YYYY-MM-DD format |
| slots[].start_time | string | Yes | Start time in HH:mm format (e.g. "09:00") |
| slots[].end_time | string | Yes | End time in HH:mm format (e.g. "12:00") |
| slots[].is_available | boolean | No | Default: true |
| slots[].notes | string | No | Optional notes |
| service_range | object | Yes | Service distance settings |
| service_range.max_distance | number | Yes | Max travel distance (must be > 0) |
| service_range.unit | string | Yes | "miles" or "km" |
| pleb_id | number | Admin only | Required only when admin is managing a phleb |

**Example — Single slot on one day:**
```json
{
  "slots": [
    {
      "specific_date": "2026-04-25",
      "start_time": "09:00",
      "end_time": "13:00",
      "notes": "Morning shift"
    }
  ],
  "service_range": {
    "max_distance": 25,
    "unit": "miles"
  }
}
```

**Example — Multiple times on the same day:**
```json
{
  "slots": [
    {
      "specific_date": "2026-04-25",
      "start_time": "09:00",
      "end_time": "12:00"
    },
    {
      "specific_date": "2026-04-25",
      "start_time": "14:00",
      "end_time": "18:00"
    }
  ],
  "service_range": {
    "max_distance": 25,
    "unit": "miles"
  }
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Date-specific slot(s) added successfully",
  "data": {
    "ids": [101, 102]
  }
}
```

---

### 4. PUT Update a Date-Specific Slot

Edit an existing slot. Only send the fields you want to change.

```
PUT /api/pleb_jobs/availability/date/:id
```

**URL Params:**
- `id` — The slot ID to update

**Request Body (all fields optional):**

| Field | Type | Description |
|-------|------|-------------|
| specific_date | string | Move to a different date (YYYY-MM-DD) |
| start_time | string | New start time (HH:mm) |
| end_time | string | New end time (HH:mm) |
| is_available | boolean | Toggle availability on/off |
| notes | string | Update notes |
| service_range | object | Update travel distance |
| service_range.max_distance | number | New distance |
| service_range.unit | string | "miles" or "km" |
| pleb_id | number | Admin only |

**Example:**
```json
{
  "start_time": "10:00",
  "end_time": "14:00"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Date-specific slot updated successfully"
}
```

---

### 5. DELETE Remove a Date-Specific Slot

Permanently delete a date slot from the calendar.

```
DELETE /api/pleb_jobs/availability/date/:id
```

**URL Params:**
- `id` — The slot ID to delete

**Request Body (Admin only):**
```json
{
  "pleb_id": 5
}
```

Phlebs don't need a request body — ownership is verified via JWT.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Date-specific slot deleted successfully"
}
```

---

## Mode 2: Per Day

Use these endpoints to manage **recurring day-of-week** availability. Per Day slots apply to every matching weekday automatically (e.g. a Monday slot shows up on every Monday in the calendar). When a Per Dates entry exists for a specific date, it overrides the Per Day schedule for that date.

### 6. GET Day-of-Week Availability

Get all Per Day (recurring) slots for a phleb, grouped by day of week.

```
GET /api/pleb_jobs/availability/days/:pleb_id?
```

**URL Params:**
- `pleb_id` — Required for Admin/Customer. Phlebs don't need this (uses token).

**Example Request:**
```
GET /api/pleb_jobs/availability/days
Authorization: Bearer <phleb_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "pleb_id": 5,
      "day_of_week": "Monday",
      "start_time": "09:00",
      "end_time": "12:00",
      "is_available": 1,
      "max_distance_miles": 25,
      "max_distance_km": 40.23,
      "unit": "miles",
      "created_at": "2026-04-01T10:00:00.000Z",
      "updated_at": "2026-04-01T10:00:00.000Z"
    },
    {
      "id": 11,
      "pleb_id": 5,
      "day_of_week": "Monday",
      "start_time": "14:00",
      "end_time": "17:00",
      "is_available": 1,
      "max_distance_miles": 25,
      "max_distance_km": 40.23,
      "unit": "miles",
      "created_at": "2026-04-01T10:00:00.000Z",
      "updated_at": "2026-04-01T10:00:00.000Z"
    },
    {
      "id": 12,
      "pleb_id": 5,
      "day_of_week": "Wednesday",
      "start_time": "09:00",
      "end_time": "17:00",
      "is_available": 1,
      "max_distance_miles": 25,
      "max_distance_km": 40.23,
      "unit": "miles",
      "created_at": "2026-04-01T10:00:00.000Z",
      "updated_at": "2026-04-01T10:00:00.000Z"
    }
  ]
}
```

---

### 7. POST Add a Day Slot

Add a single recurring day-of-week slot.

```
POST /api/pleb_jobs/availability/day
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| day_of_week | string | Yes | "Monday" through "Sunday" |
| start_time | string | Yes | Start time in HH:mm format |
| end_time | string | Yes | End time in HH:mm format |
| is_available | boolean | No | Default: true |
| service_range | object | Yes | Service distance settings |
| service_range.max_distance | number | Yes | Max travel distance (must be > 0) |
| service_range.unit | string | Yes | "miles" or "km" |
| pleb_id | number | Admin only | Required only when admin is managing a phleb |

**Example:**
```json
{
  "day_of_week": "Monday",
  "start_time": "09:00",
  "end_time": "12:00",
  "service_range": {
    "max_distance": 25,
    "unit": "miles"
  }
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Day slot added successfully",
  "data": {
    "id": 15
  }
}
```

**Possible Errors:**
```json
{ "success": false, "error": "Invalid day_of_week. Must be Monday-Sunday" }
```
```json
{ "success": false, "error": "Time slots cannot overlap on the same day" }
```

---

### 8. PUT Update a Day Slot

Edit an existing day-of-week slot. Only send the fields you want to change.

```
PUT /api/pleb_jobs/availability/day/:id
```

**URL Params:**
- `id` — The slot ID to update

**Request Body (all fields optional):**

| Field | Type | Description |
|-------|------|-------------|
| day_of_week | string | Move to a different day ("Monday"-"Sunday") |
| start_time | string | New start time (HH:mm) |
| end_time | string | New end time (HH:mm) |
| is_available | boolean | Toggle availability on/off |
| service_range | object | Update travel distance |
| service_range.max_distance | number | New distance |
| service_range.unit | string | "miles" or "km" |
| pleb_id | number | Admin only |

**Example — Change time:**
```json
{
  "start_time": "10:00",
  "end_time": "14:00"
}
```

**Example — Move to different day:**
```json
{
  "day_of_week": "Tuesday"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Day slot updated successfully"
}
```

---

### 9. DELETE Remove a Day Slot

Permanently delete a recurring day-of-week slot.

```
DELETE /api/pleb_jobs/availability/day/:id
```

**URL Params:**
- `id` — The slot ID to delete

**Request Body (Admin only):**
```json
{
  "pleb_id": 5
}
```

Phlebs don't need a request body — ownership is verified via JWT.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Day slot deleted successfully"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Day slot not found"
}
```

---

## How the Two Modes Work Together

```
When checking availability for a booking on April 25, 2026 at 10:00am:

1. Look for Per Dates rows WHERE specific_date = '2026-04-25'
2. If found → use those (Per Day schedule is ignored for this phleb on this date)
3. If NOT found → look for Per Day rows WHERE day_of_week = 'Friday'
4. Apply distance check
```

Per Dates entries **always override** Per Day slots for that exact date. This means a phleb can set a general weekly schedule (Per Day) and then override specific dates as needed (Per Dates).

---

## Recommended App Flow

### Opening the Calendar Screen
1. Call **GET Calendar** with current month/year
2. Render each day:
   - Has slots → show as available (green/highlighted)
   - `source: "none"` or empty slots → show as unavailable (grey)
   - Optionally show a dot/badge for `"date_specific"` vs `"weekly_recurring"`

### Managing Per Day Schedule (Settings / Weekly View)
1. Call **GET Day-of-Week Availability** to load the weekly schedule
2. Display each day's time slots
3. Add → call **POST Add Day Slot**
4. Edit → call **PUT Update Day Slot**
5. Delete → call **DELETE Day Slot**

### Adding Availability for a Specific Date (Tap on a date)
1. User taps a date → opens time picker
2. User sets start time + end time (can add multiple)
3. Call **POST Add Date Slot(s)** with all the slots
4. Refresh the calendar view

### Editing a Slot (Tap on existing slot)
1. Show the existing times with edit/delete buttons
2. Edit → call **PUT Update Date Slot** or **PUT Update Day Slot** (depending on source)
3. Delete → call **DELETE Date Slot** or **DELETE Day Slot** (depending on source)

### Navigating Months
- When user swipes to next/previous month, call **GET Calendar** with new month/year

---

## Validation Rules

| Rule | When it fails |
|------|---------------|
| Time must be HH:mm format | `"Invalid time format. Use HH:mm format (e.g., 09:00)"` |
| Start time < end time | `"Start time must be before end time"` |
| No overlapping times on same date/day | `"Time slots cannot overlap on the same day"` |
| Distance must be > 0 | `"Distance must be greater than 0"` |
| Unit must be miles or km | `"Unit must be 'miles' or 'km'"` |
| Date must be YYYY-MM-DD | `"Invalid date format. Use YYYY-MM-DD"` |
| Day must be Monday-Sunday | `"Invalid day_of_week. Must be Monday-Sunday"` |

---

## Database Structure

Everything lives in **one table: `pleb_availability`**

| Column | Type | Purpose |
|--------|------|---------|
| id | INT | Primary key |
| pleb_id | INT | FK to phlebotomy_applications |
| day_of_week | ENUM | For Per Day slots (NULL for Per Dates) |
| specific_date | DATE | For Per Dates entries (NULL for Per Day) |
| start_time | TIME | Slot start |
| end_time | TIME | Slot end |
| is_available | TINYINT | 1 = available, 0 = blocked |
| max_distance_miles | DECIMAL | Travel range |
| unit | ENUM | "miles" or "km" |
| notes | VARCHAR | Optional note (Per Dates only) |

**How rows are distinguished:**
- `specific_date IS NOT NULL` → Per Dates (calendar entry for a specific date)
- `specific_date IS NULL` → Per Day (recurring weekly schedule)

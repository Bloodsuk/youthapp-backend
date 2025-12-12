# Phlebotomist Slot Validation Logic

## Overview
The system now validates postcodes and towns, checks them against the database, and determines zones (London/Standard/Out of Area) with appropriate error handling.

## Validation Flow

### Priority Order:
1. **Check Postcode First** (if provided)
   - Check if postcode exists in `customers` table
   - If found in DB → Validate format → Determine zone → Return slots
   - If not found in DB → Validate format → If invalid, try town → Determine zone

2. **Check Town Second** (if postcode not found/invalid)
   - Check if town exists in `customers` table
   - If found in DB → Determine zone → Return slots
   - If not found in DB → Validate format → Determine zone

3. **Out of Area** (if both invalid/not found)
   - Return error message with contact button

## Zone Detection

### London Zone
**Postcode prefixes:** EC, WC, E, N, NW, SE, SW, W

**London Towns:**
- LONDON, WESTMINSTER, CAMDEN, ISLINGTON, HACKNEY
- TOWER HAMLETS, GREENWICH, LEWISHAM, SOUTHWARK
- LAMBETH, WANDSWORTH, HAMMERSMITH, KENSINGTON
- CHELSEA, FULHAM, EALING, HOUNSLOW, RICHMOND
- KINGSTON, MERTON, SUTTON, CROYDON, BROMLEY
- BEXLEY, HAVERING, BARKING, REDBRIDGE, NEWHAM
- WALTHAM FOREST, HARINGEY, ENFIELD, BARNET
- HARROW, BRENT, HILLINGDON

### Standard Zone
- All other valid UK postcodes
- All other valid UK towns (not in London list)

### Out of Area
- Invalid postcode format (not matching UK pattern)
- Invalid town format (empty, too short, too long)
- Non-UK locations
- Neither postcode nor town provided
- Both postcode and town not found in database and invalid format

## API Endpoint

### GET `/api/orders/phleb-slots`

**Query Parameters:**
- `postcode` (optional): Customer postcode
- `town` (optional): Customer town

**Note:** At least one of `postcode` or `town` must be provided.

### Response Examples

#### Success - London Zone
```json
{
  "success": true,
  "zone": "london",
  "slots": [
    {
      "shift_type": "Early Morning",
      "slot_times": "7:00 AM - 9:00 AM",
      "price": "65",
      "weekend_surcharge": "10"
    },
    {
      "shift_type": "Daytime",
      "slot_times": "9:00 AM - 4:00 PM",
      "price": "55",
      "weekend_surcharge": "10"
    },
    {
      "shift_type": "Evening",
      "slot_times": "4:00 PM - 7:30 PM",
      "price": "65",
      "weekend_surcharge": "10"
    }
  ]
}
```

#### Success - Standard Zone
```json
{
  "success": true,
  "zone": "standard",
  "slots": [
    {
      "shift_type": "Early Morning",
      "slot_times": "7:00 AM - 9:00 AM",
      "price": "55",
      "weekend_surcharge": "10"
    },
    {
      "shift_type": "Daytime",
      "slot_times": "9:00 AM - 4:00 PM",
      "price": "45",
      "weekend_surcharge": "10"
    },
    {
      "shift_type": "Evening",
      "slot_times": "4:00 PM - 7:30 PM",
      "price": "55",
      "weekend_surcharge": "10"
    }
  ]
}
```

#### Out of Area Error
```json
{
  "success": false,
  "error": "We're not able to offer standard pricing at your location. Please send us a what's app message and we'll work out a tailored quote for your area.",
  "showContactButton": true,
  "zone": "out_of_area"
}
```

#### Missing Parameters Error
```json
{
  "success": false,
  "error": "Postcode or town is required"
}
```

## Validation Rules

### Postcode Validation
- **Format:** UK postcode pattern: `[A-Z]{1,2}[0-9]{1,2}[A-Z]?[0-9][A-Z]{2}`
- **Examples:**
  - Valid: `SW1A1AA`, `M11AA`, `EC1A1BB`
  - Invalid: `12345`, `ABC`, `SW1` (incomplete)

### Town Validation
- **Minimum length:** 2 characters
- **Maximum length:** 100 characters
- **Cannot be empty or whitespace only**

## Database Queries

### Postcode Check
```sql
SELECT COUNT(*) as count 
FROM customers 
WHERE UPPER(REPLACE(postal_code, ' ', '')) = ? 
LIMIT 1
```

### Town Check
```sql
SELECT COUNT(*) as count 
FROM customers 
WHERE UPPER(TRIM(town)) = UPPER(TRIM(?)) 
LIMIT 1
```

## Test Cases

### Test Case 1: Valid London Postcode in DB
```
GET /api/orders/phleb-slots?postcode=SW1A1AA
```
**Expected:** London zone slots

### Test Case 2: Valid Standard Postcode in DB
```
GET /api/orders/phleb-slots?postcode=M11AA
```
**Expected:** Standard zone slots

### Test Case 3: Invalid Postcode, Valid Town
```
GET /api/orders/phleb-slots?postcode=INVALID&town=London
```
**Expected:** London zone slots (based on town)

### Test Case 4: Invalid Postcode, Invalid Town
```
GET /api/orders/phleb-slots?postcode=INVALID&town=XYZ
```
**Expected:** Out of area error

### Test Case 5: No Postcode, Valid Town
```
GET /api/orders/phleb-slots?town=Manchester
```
**Expected:** Standard zone slots

### Test Case 6: No Parameters
```
GET /api/orders/phleb-slots
```
**Expected:** "Postcode or town is required" error

### Test Case 7: Out of Area Postcode
```
GET /api/orders/phleb-slots?postcode=90210
```
**Expected:** Out of area error (US postcode)

## Implementation Notes

1. **Database Lookup:** The system first checks if postcode/town exists in the `customers` table
2. **Format Validation:** If not in DB, validates format before determining zone
3. **Fallback Logic:** If postcode fails, automatically tries town
4. **Error Handling:** Out of area locations return a user-friendly error message with contact option
5. **Zone Priority:** London detection takes priority over Standard

## Future Enhancements

- Add more comprehensive UK postcode validation library
- Expand London town list based on actual coverage areas
- Add specific "out of area" postcode/town blacklist
- Implement geolocation-based zone detection
- Add caching for frequently queried postcodes/towns


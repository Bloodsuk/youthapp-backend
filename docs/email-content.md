# Email Notification Content

This document describes the subject lines and core body copy for the automated emails sent during the pleb job lifecycle. Dynamic values are shown in curly braces.

## Status Mapping

| DB Status | Display Name |
|-----------|-------------|
| Assigned | Allocated |
| Picked Up | Booked In |
| Delivered / Completed | Sample Posted |
| Cancelled | Cancelled |

## Admin Recipients

Every status-change email is sent to admin via a unified notification. The following addresses **always** receive admin emails:

- `info@youth-revisited.co.uk`
- `Bloodservices@mail.com`

Plus any dynamically resolved admin (order creator, assigning user, or all active admins as fallback).

---

## 1. Customer – Allocated (Assigned)

- **Subject:** `Your Appointment Has Been Allocated – Order {orderRef}`
- **Greeting:** `Dear {customerName},`
- **Body:**
  - We are pleased to inform you that your appointment has now been allocated to a member of our clinical team.
  - **Appointment Details:**
    - Order Reference: `{orderRef}`
    - Status: Allocated
  - **Assigned Phlebotomist:**
    - Name: `{plebName}`
    - Contact Number: `{plebPhone}`
  - Your assigned phlebotomist will confirm a time and date for your upcoming appointment and attend your appointment as scheduled. If you need to communicate any important information prior to the visit, please feel free to contact them directly.
- **Sign-off:** Kind regards, Youth Revisited Team

## 2. Customer – Booked In (Picked Up)

- **Subject:** `Your appointment has been confirmed – Order {orderRef}`
- **Greeting:** `Dear {customerName},`
- **Body:**
  - We are pleased to confirm that your phlebotomy visit has now been booked in.
  - **Order Details:**
    - Order Reference: `{orderRef}`
    - Status: Booked In
    - Appointment Date & Time: `{bookingDate}, {bookingStartTime} – {bookingEndTime}` *(shown when available)*
- **Sign-off:** Kind regards, Youth Revisited Team

## 3. Customer – Sample Posted (Delivered)

- **Subject:** `Your sample has been Posted – Order {orderRef}`
- **Greeting:** `Dear {customerName},`
- **Body:**
  - We are pleased to confirm that your sample has been posted back to the Laboratory.
  - **Order Summary:**
    - Order Reference: `{orderRef}`
    - Status: Posted
    - Tracking Number: `{trackingNumber}` *(shown when available)*
  - Your visit has been successfully finalised. Your sample has been posted to the Laboratory today and if any follow-up is required, a member of our team will be in touch.
  - We truly appreciate your trust in Youth Revisited. If you require any further assistance, please don't hesitate to contact us.
- **Sign-off:** Warm regards, Youth Revisited Team

## 4. Customer – Cancelled

- **Subject:** `Update Regarding Your Order – Order {orderRef}`
- **Greeting:** `Dear {customerName},`
- **Body:**
  - We regret to inform you that your visit has been cancelled.
  - **Order Details:**
    - Order Reference: `{orderRef}`
    - Status: Cancelled
  - If this cancellation was not requested by you, or if you would like to reschedule, please contact our support team.
  - We apologise for any inconvenience this may cause and remain committed to providing you with the highest standard of care.
- **Sign-off:** Kind regards, Youth Revisited Team

---

## 5. Admin – Unified Status Notification

Sent on every status change (assignment, picked up, delivered, cancelled).

- **Subject:** `Order Update ({displayStatus}): {orderRef}`
- **Greeting:** `Hello Admin,`
- **Body:**
  - Order `{orderRef}` status has been updated to `{displayStatus}`.
  - **Appointment Details:**
    - Order Reference: `{orderRef}`
    - Status: `{displayStatus}`
    - Phlebotomist: `{plebName}`
    - Phlebotomist Phone: `{plebPhone}`
    - Customer: `{customerName}`
    - Customer Phone: `{customerPhone}`
    - Customer Address: `{customerAddress}`
    - Tracking Number: `{trackingNumber}` *(shown when available)*
  - You can review the details in the admin dashboard.
- **Sign-off:** Kind regards, Youth Revisited Team

---

## 6. Phlebotomist – Job Assigned

- **Subject:** `Job Assigned: {orderRef}`
- **Greeting:** `Hi {plebName},`
- **Body:**
  - A new job has been assigned to you.
  - Order `{orderRef}` is ready for you to review.
  - Details: Order Reference, Customer, Customer Phone, Customer Address, Starting Status
  - Please log in to your phlebotomist portal for full job details and keep the status updated as you progress.

## 7. Phlebotomist – Status Update

- **Subject:** `Job Update: {displayStatus} - {orderRef}`
- **Greeting:** `Hi {plebName},`
- **Body:**
  - The status for order `{orderRef}` has been updated to `{displayStatus}`.
  - Details: Order Reference, Customer, Status

## 8. Phlebotomist – Completion

- **Subject:** `Visit Completed - {orderRef}`
- **Greeting:** `Hi {plebName},`
- **Body:**
  - Order `{orderRef}` has been marked as `{displayStatus}`.
  - Thank you for completing this visit.
  - Details: Order Reference, Customer, Status, Tracking Number

---

All emails use the Youth Revisited branded template with blue (#07274a) header containing the logo, white body, and blue footer with contact info and privacy/help links.

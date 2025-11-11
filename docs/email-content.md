# Email Notification Content

This document describes the subject lines and core body copy for the automated emails that are sent during the pleb job lifecycle. Dynamic values are shown in curly braces.

## 1. Admin – Job Assigned
- **Subject:** `Job Assigned: {orderRef} → {plebName}`
- **Greeting:** `Hello Admin,`
- **Body:**
  - `{plebName} has been assigned to order {orderRef}.`
  - Detail table includes:
    - Order Reference `{orderRef}`
    - Pleb `{plebName}`
    - Pleb Phone `{plebPhone}`
    - Customer `{customerName}`
    - Customer Phone `{customerPhone}`
    - Customer Address `{customerAddress}`
  - Closing line: `You can review the assignment details in the admin dashboard.`

## 2. Pleb – Job Assigned
- **Subject:** `Job Assigned: {orderRef}`
- **Greeting:** `Hi {plebName},`
- **Body:**
  - `A new job has been assigned to you.`
  - `Order {orderRef} is ready for you to review.`
  - Detail table includes:
    - Order Reference `{orderRef}`
    - Customer `{customerName}`
    - Customer Phone `{customerPhone}`
    - Customer Address `{customerAddress}`
    - Starting Status `{jobStatus}`
  - Closing line: `Please log in to your phlebotomist portal for full job details and keep the status updated as you progress.`

## 3. Customer – Job Assigned
- **Subject:** `Your Phlebotomist: {plebName}`
- **Greeting:** `Hello {customerName},` *(falls back to `Hello,` if the name is unavailable)*
- **Body:**
  - `{plebName} has been assigned to carry out your blood draw for order {orderRef}.`
  - Detail table includes:
    - Order Reference `{orderRef}`
    - Assigned Phlebotomist `{plebName}`
    - Pleb Phone `{plebPhone}`
  - Closing line: `They will reach out if any additional coordination is required.`

## 4. Admin – Job Status Updated
- **Subject:** `Job Status Updated ({newStatus}): {orderRef}`
- **Greeting:** `Hello Admin,`
- **Body:**
  - `{plebName} updated the status for order {orderRef}.`
  - Detail table includes:
    - Order Reference `{orderRef}`
    - Pleb `{plebName}`
    - New Status `{newStatus}`
    - Tracking Number `{trackingNumber}`
  - Closing line: `Please review if any additional action is needed.`

## 5. Customer – Job Status Updated
- **Subject:** `Status Update: {newStatus} for {orderRef}`
- **Greeting:** `Hello {customerName},` *(falls back to `Hello,` if the name is unavailable)*
- **Body:**
  - `{plebName} has updated the status of your order ({orderRef}) to "{newStatus}".`
  - Detail table includes:
    - Order Reference `{orderRef}`
    - Pleb `{plebName}`
    - New Status `{newStatus}`
  - Closing line: `We will keep you updated as the job progresses.`

## 6. Admin – Job Completed
- **Subject:** `Job Completed: {orderRef}`
- **Greeting:** `Hello Admin,`
- **Body:**
  - `{plebName} marked order {orderRef} as "{newStatus}".`
  - Detail table includes:
    - Order Reference `{orderRef}`
    - Pleb `{plebName}`
    - Status `{newStatus}`
    - Tracking Number `{trackingNumber}`
  - Closing line: `Please ensure the logistics follow-up is handled promptly.`

## 7. Customer – Job Completed
- **Subject:** `Blood Sample Collected for {orderRef}`
- **Greeting:** `Hello {customerName},` *(falls back to `Hello,` if the name is unavailable)*
- **Body:**
  - `{plebName} has updated your order ({orderRef}) to "{newStatus}".`
  - `The blood sample has been collected successfully.`
  - `Thank you for your cooperation. We will notify you once your results are available.`
  - Detail table includes:
    - Order Reference `{orderRef}`
    - Status `{newStatus}`
    - Tracking Number `{trackingNumber}`

All emails end with the signature: `Regards, Youth Revisited Team`.


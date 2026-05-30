# Client Check-Ins API

Practitioner-facing endpoints for creating, retrieving, updating, and reviewing client check-ins.

All endpoints require authentication, tenant context, and a minimum role of `ASSISTANT` (which covers `OWNER`, `ADMIN`, `DIETITIAN`, and `ASSISTANT`).

---

## 1. Create Check-in
Create a new check-in for a specific client.

* **Endpoint**: `POST /api/v1/clients/:clientId/check-ins`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `clientId`: (Required, String) Client CUID.
* **Request Body**:
  * `dietPlanId`: (Optional, String) CUID of a linked diet plan.
  * `checkInDate`: (Optional, Date) Date of the check-in. Defaults to current server time.
  * `status`: (Optional, CheckInStatus) `PENDING` or `SUBMITTED`. Defaults to `SUBMITTED`.
  * `requiresFollowUp`: (Optional, Boolean) Default: `false`.
  * `weightKg`: (Optional, Float) Weight in kg (2–500).
  * `waistCm`: (Optional, Float) Waist size in cm (min 0).
  * `hipCm`: (Optional, Float) Hip size in cm (min 0).
  * `chestCm`: (Optional, Float) Chest size in cm (min 0).
  * `armCm`: (Optional, Float) Arm size in cm (min 0).
  * `thighCm`: (Optional, Float) Thigh size in cm (min 0).
  * `waterIntakeLiters`: (Optional, Float) Water intake (0–20 L).
  * `sleepHours`: (Optional, Float) Sleep hours (0–24).
  * `exerciseDays`: (Optional, Integer) Days exercised this week (0–7).
  * `energyLevel`: (Optional, Integer) Rating (1–5).
  * `stressLevel`: (Optional, Integer) Rating (1–5).
  * `moodLevel`: (Optional, Integer) Rating (1–5).
  * `planAdherence`: (Optional, Integer) Rating (1–5).
  * `adherenceNotes`: (Optional, String) Optional compliance/adherence notes.
  * `clientNotes`: (Optional, String) Comments from the client.

* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Check-in created successfully",
    "data": {
      "checkIn": {
        "id": "ck_cuid",
        "clientId": "cl_cuid",
        "dietPlanId": "dp_cuid",
        "checkInDate": "2026-05-30",
        "submittedAt": "2026-05-30T10:18:37.000Z",
        "reviewedAt": null,
        "reviewedBy": null,
        "status": "SUBMITTED",
        "requiresFollowUp": false,
        "weightKg": 82.5,
        "waistCm": 90.0,
        "hipCm": 102.0,
        "chestCm": 105.0,
        "armCm": 35.0,
        "thighCm": 58.0,
        "waterIntakeLiters": 2.5,
        "sleepHours": 7.5,
        "exerciseDays": 3,
        "energyLevel": 4,
        "stressLevel": 2,
        "moodLevel": 4,
        "planAdherence": 4,
        "adherenceNotes": "Felt good, missed one meal item",
        "clientNotes": "Feeling steady",
        "practitionerNotes": null,
        "weightChange": null,
        "waistChange": null,
        "hipChange": null,
        "chestChange": null,
        "armChange": null,
        "thighChange": null,
        "createdAt": "2026-05-30T10:18:37.000Z",
        "updatedAt": "2026-05-30T10:18:37.000Z"
      }
    }
  }
  ```

---

## 2. List Client Check-ins
Retrieve a paginated, filtered, and sorted list of check-ins for a specific client.

* **Endpoint**: `GET /api/v1/clients/:clientId/check-ins`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `clientId`: (Required, String) Client CUID.
* **Query Parameters**:
  * `page`: (Optional, Integer) Default `1`.
  * `limit`: (Optional, Integer) Default `10`.
  * `status`: (Optional, CheckInStatus) `PENDING`, `SUBMITTED`, or `REVIEWED`.
  * `fromDate`: (Optional, ISO Date String) Filter check-ins starting from this date.
  * `toDate`: (Optional, ISO Date String) Filter check-ins ending at this date.
  * `sortBy`: (Optional) `checkInDate`, `submittedAt`, `createdAt`, `weightKg`. Default: `checkInDate`.
  * `sortOrder`: (Optional) `asc` or `desc`. Default: `desc`.

* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Client check-ins retrieved successfully",
    "data": {
      "checkIns": [
        {
          "id": "ck_cuid_2",
          "clientId": "cl_cuid",
          "dietPlanId": "dp_cuid",
          "checkInDate": "2026-06-05",
          "submittedAt": "2026-06-05T12:00:00.000Z",
          "reviewedAt": null,
          "status": "SUBMITTED",
          "requiresFollowUp": false,
          "weightKg": 81.2,
          "weightChange": -1.3,
          "waistChange": -0.8
          // ... rest of fields
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

---

## 3. List All Check-ins (Global List)
Retrieve a global list of check-ins across the tenant for dashboard feeds or active practitioner review tables.

* **Endpoint**: `GET /api/v1/check-ins`
* **Headers**: `Authorization: Bearer <token>`
* **Query Parameters**:
  * `page`: (Optional) Default `1`.
  * `limit`: (Optional) Default `10`.
  * `status`: (Optional) `PENDING`, `SUBMITTED`, or `REVIEWED`.
  * `requiresFollowUp`: (Optional, Boolean) Filter check-ins that need immediate practitioner review/attention.
  * `fromDate`: (Optional) ISO Date.
  * `toDate`: (Optional) ISO Date.
  * `sortBy`: (Optional) `checkInDate`, `submittedAt`, `createdAt`, `weightKg`. Default: `checkInDate`.
  * `sortOrder`: (Optional) `asc` or `desc`. Default: `desc`.

* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "All check-ins retrieved successfully",
    "data": {
      "checkIns": [
        {
          "id": "ck_cuid_2",
          "clientId": "cl_cuid",
          "checkInDate": "2026-06-05",
          "status": "SUBMITTED",
          "requiresFollowUp": true,
          "weightKg": 81.2,
          "client": {
            "id": "cl_cuid",
            "firstName": "John",
            "lastName": "Doe",
            "fullName": "John Doe",
            "email": "john@example.com"
          }
          // ...
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 25,
        "totalPages": 3
      }
    }
  }
  ```

---

## 4. Get Check-in Details
Retrieve details of a single check-in.

* **Endpoint**: `GET /api/v1/check-ins/:id`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `id`: (Required, String) Check-in CUID.

* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Check-in details retrieved successfully",
    "data": {
      "checkIn": {
        "id": "ck_cuid_2",
        "clientId": "cl_cuid",
        "weightKg": 81.2,
        "weightChange": -1.3,
        "waistChange": -0.8
        // ... all fields, including client object and reviewedBy user details
      }
    }
  }
  ```

---

## 5. Update Check-in
Update metrics, lifestyle logs, or notes. Edits are allowed even after reviews, updating the audit timestamp `updatedAt`. Modifying the status away from `REVIEWED` or reviewing from `PENDING` status directly is blocked.

* **Endpoint**: `PATCH /api/v1/check-ins/:id`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `id`: Check-in CUID.
* **Body**:
  * Any of the check-in metrics, notes, dates or status.

* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Check-in updated successfully",
    "data": {
      "checkIn": {
        // ... updated check-in resource
      }
    }
  }
  ```

---

## 6. Review Check-in
Practitioner review workflow endpoint. Validates that the check-in status is currently `SUBMITTED`, transitioning it strictly to `REVIEWED`. Sets timestamps and tracks reviewer ID.

* **Endpoint**: `POST /api/v1/check-ins/:id/review`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `id`: Check-in CUID.
* **Body**:
  * `practitionerNotes`: (Optional, String) Comments and instructions from the practitioner.
  * `status`: (Required, String) Must be exactly `"REVIEWED"`.

* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Check-in reviewed successfully",
    "data": {
      "checkIn": {
        "id": "ck_cuid_2",
        "status": "REVIEWED",
        "reviewedAt": "2026-05-30T12:00:00.000Z",
        "reviewedBy": {
          "id": "pr_cuid",
          "firstName": "Jane",
          "lastName": "Smith",
          "name": "Jane Smith",
          "email": "jane@clinic.com"
        },
        "practitionerNotes": "Excellent weight loss. Keep up the solid sleep routine."
      }
    }
  }
  ```

---

## 7. Soft-Delete Check-in
Soft-deletes a check-in record.

* **Endpoint**: `DELETE /api/v1/check-ins/:id`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `id`: Check-in CUID.

* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Check-in deleted successfully"
  }
  ```

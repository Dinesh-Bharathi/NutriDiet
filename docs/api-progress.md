# Client Progress & Practitioner Review Dashboard API

Practitioner-facing endpoints for retrieving client progress trends, snapshots, and the dashboard of pending reviews and client risk metrics.

All endpoints require authentication, tenant context, and a minimum role of `ASSISTANT`.

---

## 1. Client Progress Trends
Retrieves chronological progress trends grouped by weight, BMI, body measurements, lifestyle, and plan adherence.

* **Endpoint**: `GET /api/v1/clients/:clientId/progress`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `clientId`: Client CUID.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Client progress trends retrieved successfully",
    "data": {
      "weight": [
        { "date": "2026-05-10", "value": 80.0, "change": null, "trend": "STABLE" },
        { "date": "2026-05-15", "value": 78.2, "change": -1.8, "trend": "DOWN" }
      ],
      "bmi": [
        { "date": "2026-05-10", "value": 26.12, "change": null, "trend": "STABLE" },
        { "date": "2026-05-15", "value": 25.53, "change": -0.59, "trend": "DOWN" }
      ],
      "measurements": [
        {
          "date": "2026-05-10",
          "waist": 90.0, "waistChange": null, "waistTrend": "STABLE",
          "hip": 100.0, "hipChange": null, "hipTrend": "STABLE",
          "chest": 105.0, "chestChange": null, "chestTrend": "STABLE",
          "arm": 35.0, "armChange": null, "armTrend": "STABLE",
          "thigh": 58.0, "thighChange": null, "thighTrend": "STABLE"
        },
        {
          "date": "2026-05-15",
          "waist": 89.0, "waistChange": -1.0, "waistTrend": "DOWN",
          "hip": 99.0, "hipChange": -1.0, "hipTrend": "DOWN",
          "chest": 104.0, "chestChange": -1.0, "chestTrend": "DOWN",
          "arm": 34.5, "armChange": -0.5, "armTrend": "DOWN",
          "thigh": 57.0, "thighChange": -1.0, "thighTrend": "DOWN"
        }
      ],
      "lifestyle": [
        { "date": "2026-05-10", "sleepHours": 7.5, "waterIntakeLiters": 2.5, "exerciseDays": 3 }
      ],
      "adherence": [
        { "date": "2026-05-10", "value": 4, "notes": "Adhered to diet well" }
      ]
    }
  }
  ```

---

## 2. Client Progress Summary
Provides detailed summary calculations including starting metrics, current metrics, total cumulative changes, and averages.

* **Endpoint**: `GET /api/v1/clients/:clientId/progress-summary`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `clientId`: Client CUID.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Client progress summary retrieved successfully",
    "data": {
      "currentWeight": 78.2,
      "startingWeight": 80.0,
      "weightChange": -1.8,
      "weightTrend": "DOWN",
      "currentWaist": 89.0,
      "startingWaist": 90.0,
      "waistChange": -1.0,
      "waistTrend": "DOWN",
      "currentHip": 99.0,
      "startingHip": 100.0,
      "hipChange": -1.0,
      "hipTrend": "DOWN",
      "currentChest": 104.0,
      "startingChest": 105.0,
      "chestChange": -1.0,
      "chestTrend": "DOWN",
      "currentArm": 34.5,
      "startingArm": 35.0,
      "armChange": -0.5,
      "armTrend": "DOWN",
      "currentThigh": 57.0,
      "startingThigh": 58.0,
      "thighChange": -1.0,
      "thighTrend": "DOWN",
      "averageSleep": 7.5,
      "averageWater": 2.5,
      "averageAdherence": 4.0,
      "lastCheckInDate": "2026-05-15",
      "checkInCount": 2
    }
  }
  ```

---

## 3. Client Progress Dashboard Snapshot
Provides a simplified, high-level metrics card object suitable for summary panels and client profiles.

* **Endpoint**: `GET /api/v1/clients/:clientId/progress-snapshot`
* **Headers**: `Authorization: Bearer <token>`
* **Params**:
  * `clientId`: Client CUID.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Client progress snapshot retrieved successfully",
    "data": {
      "weightLost": 1.8,
      "waistLost": 1.0,
      "averageAdherence": 80,
      "averageSleep": 7.5,
      "checkInCount": 2
    }
  }
  ```

---

## 4. Review Dashboard
Compiles widgets data, risk evaluations, and completion KPIs.

* **Endpoint**: `GET /api/v1/reviews/dashboard`
* **Headers**: `Authorization: Bearer <token>`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Review dashboard retrieved successfully",
    "data": {
      "pendingReviews": [
        {
          "id": "cmprvnpt0000jpjnwa50ppxp3",
          "clientId": "cmprvnjjc000fpjnwwj1jkcml",
          "checkInDate": "2026-05-10",
          "status": "SUBMITTED",
          "client": {
            "id": "cmprvnjjc000fpjnwwj1jkcml",
            "firstName": "John",
            "lastName": "Doe",
            "fullName": "John Doe",
            "email": "johndoe@example.com"
          }
        }
      ],
      "requiresFollowUp": [],
      "recentCheckIns": [],
      "lowAdherenceClients": [
        {
          "clientId": "cmprvnjjc000fpjnwwj1jkcml",
          "fullName": "John Doe",
          "latestWeight": 78.2,
          "averageAdherence": 2.5
        }
      ],
      "weightStalledClients": [
        {
          "clientId": "cmprvnjjc000fpjnwwj1jkcml",
          "fullName": "John Doe",
          "latestWeight": 78.2,
          "weightChange": 0.1
        }
      ],
      "reviewCompletionRate": 85
    }
  }
  ```

---

## Analytical Calculations & Service Rules

### 1. BMI Calculation
* **Formula**: $BMI = \frac{weightKg}{(heightCm / 100)^2}$
* Height is fetched dynamically from the client's latest non-deleted Assessment. If no assessment is found containing height, the `bmi` trend array is returned empty.

### 2. Weight Stalled Evaluation
* **Rule**: Weight stalled if net weight change over the last 3 check-ins (chronologically) is `>= -0.2 kg` (meaning lost less than 0.2kg, maintained, or gained weight).
* Clients with less than 2 check-ins with weights are omitted.

### 3. Low Adherence Evaluation
* **Rule**: Average of `planAdherence` across all non-deleted check-ins is `< 3` (on a scale of 1-5).
* Conversions to percentage in snapshot: $\text{adherencePercentage} = \text{averageAdherence} \times 20$.

### 4. Review Completion Rate
* **Formula**: $\frac{\text{Reviewed Check-ins}}{\text{Reviewed} + \text{Submitted Check-ins}} \times 100$.

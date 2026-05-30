# Calendar Engine API & Resolution Documentation

This document describes the Calendar Engine's core resolution algorithm, preview rendering endpoints, and backward-compatibility mapping.

---

## The Resolution Algorithm

To determine what meals are assigned on any target calendar date:
1. Find the client's **ACTIVE** diet plan spanning the target date (`startDate <= targetDate && (endDate >= targetDate || endDate == null)`).
2. If the plan has no cycles, it is a **Static Plan**. Return the plan's default root-level meals.
3. If the plan has cycles:
   - Identify the plan's starting anchor point: `plan.cycleStartDate` (with fallback to `plan.startDate` or `plan.createdAt`).
   - Calculate elapsed calendar days: `daysElapsed = targetDate - startAnchorDate`.
   - Compute plan day number: `planDay = daysElapsed + 1`.
   - Determine which cycle is active by sorting plan cycles by `startDay` descending and selecting the first cycle where `startDay <= planDay`.
   - Filter the cycle's child days to include only active days (`isActive == true`).
   - Resolve the day offset inside the cycle: `offset = planDay - activeCycle.startDay`.
   - Select the day using a modulo calculation: `dayIndex = offset % activeDays.length`.
   - Return the meals and targets of `activeDays[dayIndex]`.

---

## Endpoints

### 1. Get Plan for Date
Retrieve a client's resolved diet plan for a specific date. If the plan is cycle-based, the meals belonging to the resolved cycle day are mapped into the root `meals` array of the response to ensure full backward compatibility.
- **URL**: `GET /api/v1/clients/:clientId/diet-plan-for-date`
- **Query Parameters**:
  - `date`: Target date (`YYYY-MM-DD`). Defaults to today.
- **Headers**:
  - `Authorization: Bearer <token>`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Diet plan for date retrieved successfully",
    "data": {
      "dietPlan": {
        "id": "cuid-plan-1",
        "clientId": "cuid-client-1",
        "title": "Hypertrophy Program A",
        "description": "Cycle-based bodybuilding routine",
        "cycleStartDate": "2026-06-01",
        "meals": [
          {
            "id": "cuid-meal-1",
            "name": "Breakfast",
            "mealOrder": 1,
            "items": []
          }
        ],
        "resolvedCycleDay": {
          "id": "cuid-day-1",
          "dayNumber": 1,
          "dayLabel": "Training Day - High Carb",
          "plannedCalories": 3200,
          "plannedProtein": 180,
          "plannedCarbs": 400,
          "plannedFat": 80
        }
      }
    }
  }
  ```

### 2. Render Calendar Preview
Simulate a cycle's forward path to show practitioners and clients which cycle day label resolves on each upcoming date.
- **URL**: `GET /api/v1/diet-plans/:id/calendar-preview`
- **Query Parameters**:
  - `limit`: Number of days to simulate (Default: `30`, Max: `90`).
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Calendar preview retrieved successfully",
    "data": [
      { "date": "2026-06-01", "dayLabel": "Day A - Training" },
      { "date": "2026-06-02", "dayLabel": "Day B - Rest" },
      { "date": "2026-06-03", "dayLabel": "Day A - Training" }
    ]
  }
  ```

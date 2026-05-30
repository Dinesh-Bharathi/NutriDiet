# Repeat Cycles API Documentation

This document describes the API endpoints for managing cycles and cycle days for both active/draft Diet Plans and Diet Plan Templates.

---

## Diet Plan Cycles

### 1. Create Diet Plan Cycle
Create a new cycle under a specific Diet Plan.
- **URL**: `POST /api/v1/diet-plans/:id/cycles`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "name": "Training Cycle",
    "description": "Used during heavy training weeks",
    "startDay": 1
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Diet plan cycle created successfully",
    "data": {
      "id": "cuid-cycle-1",
      "name": "Training Cycle",
      "description": "Used during heavy training weeks",
      "startDay": 1,
      "days": [],
      "totalPlannedCalories": 0,
      "totalPlannedProtein": 0,
      "totalPlannedCarbs": 0,
      "totalPlannedFat": 0,
      "totalActualCalories": 0,
      "totalActualProtein": 0,
      "totalActualCarbs": 0,
      "totalActualFat": 0
    }
  }
  ```

### 2. List Diet Plan Cycles
Retrieve all cycles associated with a Diet Plan, including total nutrition aggregations.
- **URL**: `GET /api/v1/diet-plans/:id/cycles`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Diet plan cycles retrieved successfully",
    "data": [
      {
        "id": "cuid-cycle-1",
        "name": "Training Cycle",
        "description": "Used during heavy training weeks",
        "startDay": 1,
        "days": [],
        "totalPlannedCalories": 3200,
        "totalPlannedProtein": 180,
        "totalPlannedCarbs": 400,
        "totalPlannedFat": 80
      }
    ]
  }
  ```

### 3. Update Cycle
Update basic parameters of a cycle.
- **URL**: `PATCH /api/v1/cycles/:cycleId`
- **Body**:
  ```json
  {
    "name": "High Carb Cycle",
    "startDay": 2
  }
  ```
- **Response** (`200 OK`)

### 4. Delete Cycle
Delete a cycle, cascading down to delete all child days and removing references from meals.
- **URL**: `DELETE /api/v1/cycles/:cycleId`
- **Response** (`200 OK`)

---

## Cycle Days

### 1. Create Cycle Day
Add a Day number to a Cycle with target/planned nutrition constraints.
- **URL**: `POST /api/v1/cycles/:cycleId/days`
- **Body**:
  ```json
  {
    "dayNumber": 1,
    "dayLabel": "Day A - Low Carb",
    "description": "Focus on high fat and protein",
    "plannedCalories": 2200,
    "plannedProtein": 180,
    "plannedCarbs": 100,
    "plannedFat": 120
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Cycle day created successfully",
    "data": {
      "id": "cuid-day-1",
      "dayNumber": 1,
      "dayLabel": "Day A - Low Carb",
      "description": "Focus on high fat and protein",
      "isActive": true,
      "plannedCalories": 2200,
      "plannedProtein": 180,
      "plannedCarbs": 100,
      "plannedFat": 120,
      "actualCalories": 0,
      "actualProtein": 0,
      "actualCarbs": 0,
      "actualFat": 0
    }
  }
  ```

### 2. List Cycle Days
- **URL**: `GET /api/v1/cycles/:cycleId/days`
- **Response** (`200 OK`)

### 3. Update Cycle Day
Update day labels, target planned nutrition, or toggle `isActive`.
- **URL**: `PATCH /api/v1/cycle-days/:dayId`
- **Body**:
  ```json
  {
    "dayLabel": "Rest Day A",
    "isActive": false
  }
  ```
- **Response** (`200 OK`)

### 4. Delete Cycle Day
- **URL**: `DELETE /api/v1/cycle-days/:dayId`
- **Response** (`200 OK`)

---

## Diet Plan Template Cycles

Templates support the identical endpoints under:
- `POST /api/v1/diet-plan-templates/:id/cycles`
- `GET /api/v1/diet-plan-templates/:id/cycles`
- `PATCH /api/v1/template-cycles/:cycleId`
- `DELETE /api/v1/template-cycles/:cycleId`
- `POST /api/v1/template-cycles/:cycleId/days`
- `GET /api/v1/template-cycles/:cycleId/days`
- `PATCH /api/v1/template-cycle-days/:dayId`
- `DELETE /api/v1/template-cycle-days/:dayId`

# Diet Plan Templates API Specification

Practitioners can build, customize, and clone reusable diet templates.

## Endpoints

### 1. Create Diet Plan Template
`POST /api/v1/diet-plan-templates`

**Request Body:**
```json
{
  "title": "Low Carb Template",
  "description": "Standard high-protein low-carbohydrate plan template",
  "goal": "Weight Loss",
  "dailyCalories": 1800,
  "proteinGrams": 140,
  "carbGrams": 100,
  "fatGrams": 70,
  "isPublic": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Diet plan template created successfully",
  "data": {
    "template": {
      "id": "cmpstpl10000000000000000",
      "title": "Low Carb Template",
      "dailyCalories": 1800,
      "totalCalories": 0,
      "totalProtein": 0,
      "totalCarbs": 0,
      "totalFat": 0,
      "isPublic": false,
      "createdBy": "cmpsuser10000000000000",
      "meals": []
    }
  }
}
```

### 2. Save Diet Plan as Reusable Template (Clone)
`POST /api/v1/diet-plans/:id/save-template`

**Request Body:**
```json
{
  "title": "Keto Transition Template v2",
  "description": "Cloned from client plan",
  "isPublic": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Diet plan saved as template successfully",
  "data": {
    "template": {
      "id": "cmpstpl20000000000000000",
      "title": "Keto Transition Template v2",
      "totalCalories": 1950,
      "meals": [...]
    }
  }
}
```

### 3. Apply Template to Client
`POST /api/v1/diet-plan-templates/:id/apply`

**Request Body:**
```json
{
  "clientId": "cmpsclient1000000",
  "startDate": "2026-06-01",
  "endDate": "2026-06-30",
  "status": "DRAFT"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Template applied to client successfully",
  "data": {
    "dietPlan": {
      "id": "cmpsplan9900000000000",
      "clientId": "cmpsclient1000000",
      "title": "Keto Transition Template v2",
      "status": "DRAFT",
      "versionNumber": 1,
      "meals": [...]
    }
  }
}
```

### 4. Other Standard CRUD Endpoints
* `GET /api/v1/diet-plan-templates` - List templates with pagination.
* `GET /api/v1/diet-plan-templates/:id` - Get template details (with fully hydrated nested meals and meal items).
* `PATCH /api/v1/diet-plan-templates/:id` - Update template details.
* `DELETE /api/v1/diet-plan-templates/:id` - Soft delete template.

---

## Template Meal and Item Endpoints

### 5. Create Template Meal
`POST /api/v1/diet-plan-templates/:id/meals`

Creates a new meal inside a template. Enforces unique `mealOrder` values within the same template.

**Request Body:**
```json
{
  "name": "BREAKFAST",
  "mealOrder": 1,
  "mealTime": "08:00 AM",
  "notes": "Include warm liquids first"
}
```

### 6. Update Template Meal
`PATCH /api/v1/template-meals/:mealId`

Updates template meal parameters (e.g. `mealOrder` or `name`). Enforces uniqueness on `mealOrder` if changed.

### 7. Delete Template Meal
`DELETE /api/v1/template-meals/:mealId`

Deletes a template meal and all its items cascaded in a transaction. Recalculates total template nutrition.

### 8. Create Template Meal Item (with optional Food Library Snapshotting)
`POST /api/v1/template-meals/:mealId/items`

Adds an item to a template meal. Supports optional `foodLibraryId` association. When `foodLibraryId` is supplied:
1. Snapshot values (`foodName`, `quantity`, `unit`, `calories`, `protein`, `carbs`, `fat`, `sourceType`) are retrieved from the Food Library.
2. If `foodName` or `unit` are omitted in the request body, they default to those in the library.
3. Automatically triggers template nutrition auto-aggregation.

**Request Body Example (Using Food Library):**
```json
{
  "foodLibraryId": "cmprso1rc0005u2bep29p9bsl",
  "quantity": 100,
  "unit": "grams",
  "notes": "Enjoy with unsweetened almond milk"
}
```

**Request Body Example (Custom Food Item):**
```json
{
  "foodName": "Fresh Strawberry",
  "quantity": 150,
  "unit": "grams",
  "calories": 48,
  "protein": 1,
  "carbs": 11,
  "fat": 0.4
}
```

### 9. Update Template Meal Item
`PATCH /api/v1/template-meal-items/:itemId`

Updates a meal item's details. Triggers template nutrition auto-aggregation.

### 10. Delete Template Meal Item
`DELETE /api/v1/template-meal-items/:itemId`

Deletes a template meal item. Triggers template nutrition auto-aggregation.

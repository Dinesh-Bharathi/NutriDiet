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
* `GET /api/v1/diet-plan-templates`
* `GET /api/v1/diet-plan-templates/:id`
* `PATCH /api/v1/diet-plan-templates/:id`
* `DELETE /api/v1/diet-plan-templates/:id`

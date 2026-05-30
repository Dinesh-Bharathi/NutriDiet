# Diet Plan Builder API Reference

The Diet Plan Builder Module allows practitioners to design, manage, and build diet plans, meals, and meal items for clients. All endpoints require a valid Bearer Token and are strictly tenant-isolated.

---

## 1. Diet Plan Endpoints

### 1.1 Create Diet Plan
Creates a new diet plan for a client. Can optionally reference a client assessment.

* **URL**: `/api/v1/clients/:clientId/diet-plans`
* **Method**: `POST`
* **Auth Required**: Yes (`Bearer Token`)
* **Min Role**: `ASSISTANT`
* **Request Params**:
  * `clientId` (string, required)
* **Request Body**:
  ```json
  {
    "title": "Keto Transition Plan",
    "description": "High-fat, low-carb plan for fat adaptation.",
    "goal": "Induce ketosis and maintain energy levels.",
    "assessmentId": "cmpr8mmrj000537gl83y17w5x",
    "dailyCalories": 2000,
    "proteinGrams": 120.0,
    "carbGrams": 30.0,
    "fatGrams": 155.0,
    "startDate": "2026-06-01",
    "endDate": "2026-06-30",
    "status": "DRAFT"
  }
  ```
  *(Note: `title` is required; all other fields are optional. `status` must be one of: `DRAFT`, `ACTIVE`, `ARCHIVED`)*
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Diet plan created successfully",
    "data": {
      "dietPlan": {
        "id": "cmpz2mopk000137gl83yaabc1",
        "clientId": "cmpr8mk9w000337glaa2n0ooa",
        "assessmentId": "cmpr8mmrj000537gl83y17w5x",
        "title": "Keto Transition Plan",
        "description": "High-fat, low-carb plan for fat adaptation.",
        "goal": "Induce ketosis and maintain energy levels.",
        "dailyCalories": 2000,
        "proteinGrams": 120.0,
        "carbGrams": 30.0,
        "fatGrams": 155.0,
        "startDate": "2026-06-01",
        "endDate": "2026-06-30",
        "status": "DRAFT",
        "createdAt": "2026-05-30T00:40:00.000Z",
        "updatedAt": "2026-05-30T00:40:00.000Z",
        "creator": {
          "id": "cmpr1vjnd0002zm1gsmwr7ss0",
          "firstName": "Demo",
          "lastName": "Owner",
          "fullName": "Demo Owner",
          "email": "owner@demo-clinic.com"
        },
        "meals": []
      }
    }
  }
  ```

### 1.2 List Client Diet Plans
Retrieves a paginated list of diet plans for a client, sorted by `createdAt` descending.

* **URL**: `/api/v1/clients/:clientId/diet-plans`
* **Method**: `GET`
* **Auth Required**: Yes (`Bearer Token`)
* **Min Role**: `ASSISTANT`
* **Request Params**:
  * `clientId` (string, required)
* **Query Parameters**:
  * `page` (integer, optional, default: 1)
  * `limit` (integer, optional, default: 10)
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Diet plans retrieved successfully",
    "data": {
      "dietPlans": [
        {
          "id": "cmpz2mopk000137gl83yaabc1",
          "clientId": "cmpr8mk9w000337glaa2n0ooa",
          "title": "Keto Transition Plan",
          "status": "DRAFT",
          "createdAt": "2026-05-30T00:40:00.000Z",
          "updatedAt": "2026-05-30T00:40:00.000Z",
          "creator": {
            "id": "cmpr1vjnd0002zm1gsmwr7ss0",
            "firstName": "Demo",
            "lastName": "Owner",
            "fullName": "Demo Owner",
            "email": "owner@demo-clinic.com"
          }
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

### 1.3 Get Diet Plan Details
Retrieves detailed information about a single diet plan, including all meals and meal items.

* **URL**: `/api/v1/diet-plans/:id`
* **Method**: `GET`
* **Auth Required**: Yes (`Bearer Token`)
* **Min Role**: `ASSISTANT`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Diet plan retrieved successfully",
    "data": {
      "dietPlan": {
        "id": "cmpz2mopk000137gl83yaabc1",
        "clientId": "cmpr8mk9w000337glaa2n0ooa",
        "title": "Keto Transition Plan",
        "description": "High-fat, low-carb plan for fat adaptation.",
        "dailyCalories": 2000,
        "status": "DRAFT",
        "createdAt": "2026-05-30T00:40:00.000Z",
        "creator": { "id": "cmpr1vjnd0002zm1gsmwr7ss0", "fullName": "Demo Owner" },
        "meals": [
          {
            "id": "cmpz5mopk000237gl83yaabc2",
            "dietPlanId": "cmpz2mopk000137gl83yaabc1",
            "name": "BREAKFAST",
            "mealOrder": 1,
            "mealTime": "08:30",
            "notes": "Drink warm water first.",
            "items": [
              {
                "id": "cmpz7mopk000337gl83yaabc3",
                "mealId": "cmpz5mopk000237gl83yaabc2",
                "foodName": "Eggs Fried in Butter",
                "quantity": 3,
                "unit": "pieces",
                "calories": 270,
                "protein": 18,
                "carbs": 1.5,
                "fat": 21,
                "notes": "Use grass-fed butter."
              }
            ]
          }
        ]
      }
    }
  }
  ```

### 1.4 Update Diet Plan
Partially updates diet plan details.

* **URL**: `/api/v1/diet-plans/:id`
* **Method**: `PATCH`
* **Request Body**: (Any subset of `create` fields)
* **Success Response (200 OK)**:
  *(Returns the updated diet plan object)*

### 1.5 Delete Diet Plan (Soft-Delete)
Soft-deletes a diet plan.

* **URL**: `/api/v1/diet-plans/:id`
* **Method**: `DELETE`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Diet plan deleted successfully"
  }
  ```

---

## 2. Meal Endpoints

### 2.1 Create Meal
Adds a meal header to a diet plan.

* **URL**: `/api/v1/diet-plans/:id/meals`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "name": "BREAKFAST",
    "mealOrder": 1,
    "mealTime": "08:30",
    "notes": "Ensure high hydration."
  }
  ```
  *(Note: `name` must be one of: `BREAKFAST`, `MID_MORNING`, `LUNCH`, `EVENING_SNACK`, `DINNER`, `BEDTIME`)*
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Meal created successfully",
    "data": {
      "meal": {
        "id": "cmpz5mopk000237gl83yaabc2",
        "dietPlanId": "cmpz2mopk000137gl83yaabc1",
        "name": "BREAKFAST",
        "mealOrder": 1,
        "mealTime": "08:30",
        "notes": "Ensure high hydration.",
        "items": []
      }
    }
  }
  ```

### 2.2 Update Meal
Updates meal details.

* **URL**: `/api/v1/meals/:mealId`
* **Method**: `PATCH`
* **Request Body**:
  ```json
  {
    "mealTime": "09:00"
  }
  ```
* **Success Response (200 OK)**:
  *(Returns the updated meal object)*

### 2.3 Delete Meal (Cascade/Hard-Delete)
Removes a meal and all its items from the plan.

* **URL**: `/api/v1/meals/:mealId`
* **Method**: `DELETE`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Meal deleted successfully"
  }
  ```

---

## 3. Meal Item Endpoints

### 3.1 Create Meal Item
Adds a food item to an existing meal.

* **URL**: `/api/v1/meals/:mealId/items`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "foodName": "Avocado",
    "quantity": 1,
    "unit": "medium size",
    "calories": 240,
    "protein": 3,
    "carbs": 12,
    "fat": 22,
    "notes": "Freshly sliced."
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Meal item created successfully",
    "data": {
      "mealItem": {
        "id": "cmpz7mopk000337gl83yaabc3",
        "mealId": "cmpz5mopk000237gl83yaabc2",
        "foodName": "Avocado",
        "quantity": 1,
        "unit": "medium size",
        "calories": 240,
        "protein": 3,
        "carbs": 12,
        "fat": 22,
        "notes": "Freshly sliced."
      }
    }
  }
  ```

### 3.2 Update Meal Item
Updates nutrition details or quantity.

* **URL**: `/api/v1/meal-items/:itemId`
* **Method**: `PATCH`
* **Request Body**:
  ```json
  {
    "quantity": 1.5
  }
  ```
* **Success Response (200 OK)**:
  *(Returns the updated meal item)*

### 3.3 Delete Meal Item
Removes a food item.

* **URL**: `/api/v1/meal-items/:itemId`
* **Method**: `DELETE`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Meal item deleted successfully"
  }
  ```

# Food Library V2 API Documentation

## Overview
Food Library V2 introduces a structured structure for categories, tagging, serving definitions, and food equivalents. This foundation supports future smart meal swap systems.

All endpoints require:
- A valid Bearer JWT (`Authorization: Bearer <token>`)
- Tenant context resolver header or user assignment context.
- User role must be `ASSISTANT` or above.

---

## 1. Food Categories API

### Create Category
* **Method & URL**: `POST /api/v1/food-categories`
* **Request Body**:
```json
{
  "name": "Chicken",
  "description": "Poultry meat variations",
  "parentCategoryId": "cmppvbjde0000wc6f5tr5jjns"
}
```
* **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Food category created successfully",
  "data": {
    "category": {
      "id": "cmprcategory0001",
      "tenantId": "cmppvbitw0001wc6f0askim9u",
      "name": "Chicken",
      "description": "Poultry meat variations",
      "isSystem": false,
      "parentCategoryId": "cmppvbjde0000wc6f5tr5jjns",
      "createdAt": "2026-05-30T10:00:00.000Z",
      "updatedAt": "2026-05-30T10:00:00.000Z"
    }
  }
}
```

### List Categories
* **Method & URL**: `GET /api/v1/food-categories`
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Food categories retrieved successfully",
  "data": {
    "categories": [
      {
        "id": "cmprcategory0001",
        "name": "Chicken",
        "parentCategory": { "id": "cmppvbjde0000", "name": "Protein" },
        "children": []
      }
    ]
  }
}
```

### Update Category
* **Method & URL**: `PATCH /api/v1/food-categories/:id`
* **Request Body**:
```json
{
  "name": "Chicken Breast"
}
```
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Food category updated successfully",
  "data": {
    "category": { "id": "cmprcategory0001", "name": "Chicken Breast" }
  }
}
```

### Delete Category (Soft Delete)
* **Method & URL**: `DELETE /api/v1/food-categories/:id`
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Food category deleted successfully"
}
```

---

## 2. Food Tags API

### Create Tag
* **Method & URL**: `POST /api/v1/food-tags`
* **Request Body**:
```json
{
  "name": "Keto Friendly",
  "description": "Foods conforming to low carb high fat targets"
}
```

### List Tags
* **Method & URL**: `GET /api/v1/food-tags`

### Update Tag
* **Method & URL**: `PATCH /api/v1/food-tags/:id`

### Delete Tag
* **Method & URL**: `DELETE /api/v1/food-tags/:id`

---

## 3. Servings (Custom Portions) API

### Add Custom Serving to Food
* **Method & URL**: `POST /api/v1/foods/:id/servings`
* **Request Body**:
```json
{
  "name": "1 Cup",
  "grams": 180,
  "unitType": "CUP",
  "isDefault": true,
  "displayOrder": 1
}
```
> [!NOTE]
> Setting `isDefault: true` automatically updates any other serving sizes on the same food item to `isDefault: false`.

### List Servings for Food
* **Method & URL**: `GET /api/v1/foods/:id/servings`

### Update Serving
* **Method & URL**: `PATCH /api/v1/food-servings/:id`
* **Request Body**:
```json
{
  "grams": 190
}
```

### Delete Serving
* **Method & URL**: `DELETE /api/v1/food-servings/:id`

---

## 4. Equivalents API

### Create Equivalency Pairing
* **Method & URL**: `POST /api/v1/foods/:id/equivalents`
* **Request Body**:
```json
{
  "targetFoodId": "cmprtargetfood123",
  "equivalencyType": "PROTEIN",
  "similarityScore": 95
}
```

### Get Equivalents for Food
* **Method & URL**: `GET /api/v1/foods/:id/equivalents`
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Food equivalents retrieved successfully",
  "data": {
    "equivalents": [
      {
        "id": "cmprequivalent001",
        "equivalencyType": "PROTEIN",
        "similarityScore": 95,
        "food": {
          "id": "cmprtargetfood123",
          "foodName": "Turkey Breast",
          "caloriesPer100g": 135,
          "proteinPer100g": 30
        }
      }
    ]
  }
}
```

### Delete Equivalency Pairing
* **Method & URL**: `DELETE /api/v1/food-equivalents/:id`

---

## 5. Food Details Endpoint

### Get Food Details
* **Method & URL**: `GET /api/v1/foods/:id/details`
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Food details retrieved successfully",
  "data": {
    "details": {
      "food": {
        "id": "cmprsourcefood123",
        "foodName": "Chicken Breast",
        "calories": 165,
        "protein": 31,
        "carbs": 0,
        "fat": 3.6,
        "status": "ACTIVE"
      },
      "category": {
        "id": "cmprcategory0001",
        "name": "Chicken"
      },
      "tags": [
        {
          "id": "cmprtag001",
          "name": "High Protein"
        }
      ],
      "servings": [
        {
          "id": "cmprserving001",
          "name": "100g",
          "grams": 100,
          "unitType": "GRAM",
          "isDefault": true
        }
      ],
      "equivalents": [
        {
          "id": "cmpreq001",
          "targetFoodId": "cmprtargetfood123",
          "equivalencyType": "PROTEIN",
          "similarityScore": 95,
          "targetFood": {
            "id": "cmprtargetfood123",
            "foodName": "Turkey Breast",
            "calories": 135,
            "protein": 30
          }
        }
      ]
    }
  }
}
```

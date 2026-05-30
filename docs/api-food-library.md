# Food Library API Specification

Practitioners can manage their food database library (custom foods) and search items.

## Endpoints

### 1. Create Food Item
`POST /api/v1/food-library`

**Headers:**
`Authorization: Bearer <token>`

**Request Body:**
```json
{
  "foodName": "Avocado",
  "sourceType": "CUSTOM",
  "defaultQuantity": 100,
  "defaultUnit": "grams",
  "servingSize": 1,
  "servingUnit": "medium",
  "calories": 160,
  "protein": 2,
  "carbs": 8.5,
  "fat": 14.7
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Food item created successfully",
  "data": {
    "food": {
      "id": "cmpsfood10000000000000000",
      "foodName": "Avocado",
      "sourceType": "CUSTOM",
      "defaultQuantity": 100,
      "defaultUnit": "grams",
      "servingSize": 1,
      "servingUnit": "medium",
      "calories": 160,
      "protein": 2,
      "carbs": 8.5,
      "fat": 14.7,
      "createdAt": "2026-05-30T02:30:00.000Z",
      "updatedAt": "2026-05-30T02:30:00.000Z"
    }
  }
}
```

### 2. Search & Autocomplete
`GET /api/v1/food-library/search?q=avo`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Food search completed successfully",
  "data": {
    "foods": [
      {
        "id": "cmpsfood10000000000000000",
        "foodName": "Avocado",
        "sourceType": "CUSTOM",
        "defaultQuantity": 100,
        "defaultUnit": "grams",
        "servingSize": 1,
        "servingUnit": "medium",
        "calories": 160,
        "protein": 2,
        "carbs": 8.5,
        "fat": 14.7
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

### 3. List Food Library
`GET /api/v1/food-library?page=1&limit=20`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Food library retrieved successfully",
  "data": {
    "foods": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### 4. Get Food Item
`GET /api/v1/food-library/:id`

### 5. Update Food Item
`PATCH /api/v1/food-library/:id`

**Request Body:**
```json
{
  "calories": 170
}
```

### 6. Delete Food Item
`DELETE /api/v1/food-library/:id`

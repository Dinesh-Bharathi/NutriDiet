# Frontend Handover: Food Library

Use this guide to integrate the new Food Library features into the NutriDiet frontend.

## API Integration

### Search / Autocomplete Component
Use this to implement quick autocomplete when practitioners search and add foods to meal items:

```typescript
// Fetch suggestions while typing
async function fetchFoodSuggestions(query: string) {
  const res = await api.get(`/food-library/search?q=${encodeURIComponent(query)}`);
  return res.data.data.foods; // List of matched FoodLibrary entries
}
```

### Response Schema Shape
Each food library object has this structure:
```json
{
  "id": "cuid",
  "foodName": "Rice",
  "sourceType": "CUSTOM",
  "defaultQuantity": 100,
  "defaultUnit": "grams",
  "servingSize": 1,
  "servingUnit": "cup",
  "calories": 130,
  "protein": 2.7,
  "carbs": 28,
  "fat": 0.3
}
```

### Food Library Management UI
You can build a "Food Database" tab in the dashboard settings or resources sidebar. This allows users to view, add, and modify custom food items.
- `GET /api/v1/food-library` (paginated list of foods)
- `POST /api/v1/food-library` (create food)
- `PATCH /api/v1/food-library/:id` (update calories/macros/units)
- `DELETE /api/v1/food-library/:id` (delete custom food)

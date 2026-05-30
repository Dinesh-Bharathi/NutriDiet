# Frontend Food Library V2 Handover Documentation

## Key Upgrades

### 1. Hierarchical Categories
Categories now support a nested structure. Parent and child links exist via `parentCategoryId` and `children`.
- E.g. `Protein` category ➔ child categories like `Chicken`, `Fish`, `Red Meat`.
- Use this when rendering nested selection drop-downs or filters in the food library manager.

### 2. Standardized Portions (Serving Sizes)
Portions use standard unit categories to facilitate UI rendering and calculation:
- Available Units (`FoodServingUnitType`): `GRAM`, `CUP`, `BOWL`, `TBSP`, `TSP`, `PIECE`, `SLICE`, `SCOOP`, `SERVING`.
- Instead of raw strings, map to these pre-defined enums on food details creation or edit.
- Default Portion constraint: The backend forces exactly **one** default portion per food item. When `isDefault` is toggled true on a portion, other portions default back to false.

### 3. Food Status Toggling (ACTIVE / ARCHIVED)
- Foods should not be deleted if referenced in previous client templates or cycles. Instead, toggle `status: "ARCHIVED"`.
- The main list view filter matches only `status: "ACTIVE"` foods by default. Show a toggle to view `status: "ARCHIVED"` items.

### 4. Advanced Filter Engine
The `GET /api/v1/food-library` (or autocomplete `GET /api/v1/food-library/search`) endpoint accepts new query filters:
- `categoryId`: filter by category ID.
- `tagIds`: comma-separated string of Tag IDs (e.g. `?tagIds=cuid1,cuid2`).
- `minCalories`, `maxCalories`, `minProtein`, `maxProtein`.
- `query`: searches across name, commonName, brandName, and searchKeywords.
- `status`: filter by status (`ACTIVE` or `ARCHIVED`).

### 5. Unified Food Details API
Instead of calling multiple endpoints, fetch:
`GET /api/v1/foods/:id/details`
Which resolves:
```json
{
  "food": { "id", "foodName", "commonName", "brandName", "status", ... },
  "category": { "id", "name" },
  "tags": [ { "id", "name" } ],
  "servings": [ { "id", "name", "grams", "unitType", "isDefault" } ],
  "equivalents": [ { "id", "targetFoodId", "equivalencyType", "similarityScore" } ]
}
```
Use this endpoint to populate the Food Editor or Food Profile page on the practitioner interface.

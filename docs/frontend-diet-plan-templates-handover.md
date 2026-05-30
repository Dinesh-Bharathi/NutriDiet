# Frontend Handover: Diet Plan Templates

Use this guide to integrate Diet Plan Templating in the NutriDiet frontend.

## Integration Workflows

### 1. Save Plan as Reusable Template
Add a "Save as Template" button in the Diet Plan builder UI. Clicking it opens a small modal with `title` (required), `description`, and `isPublic` options.

**Endpoint:**
`POST /api/v1/diet-plans/:id/save-template`

**Body:**
```json
{
  "title": "Low Carb Kickstart Template",
  "description": "Standard high-protein low-carbohydrate plan template",
  "isPublic": false
}
```

### 2. Apply Template to Client
Add an "Apply Template" button when viewing a client's empty Diet Plans state. This should open a modal listing available templates, allowing the user to select one, set the date range, and select initial status.

**Endpoint:**
`POST /api/v1/diet-plan-templates/:id/apply`

**Body:**
```json
{
  "clientId": "client-id",
  "startDate": "2026-06-01",
  "endDate": "2026-06-30",
  "status": "DRAFT" // Default is DRAFT
}
```

### 3. Template CRUD management
You can build a "Templates" tab in the dietitian's main dashboard sidebar to allow previewing, building, and updating templates directly without attaching them to a specific client first.
* `GET /api/v1/diet-plan-templates`
* `POST /api/v1/diet-plan-templates`
* `GET /api/v1/diet-plan-templates/:id`
* `PATCH /api/v1/diet-plan-templates/:id`
* `DELETE /api/v1/diet-plan-templates/:id`

---

## Interactive Template Builder (Upgraded)

The frontend can now offer a full drag-and-drop or checklist-based template meal plan builder, similar to the client diet plan builder.

### A. Template Meal Management
Allows managing meal blocks (e.g. Breakfast, Lunch) on the template.

* **Add Meal**: `POST /api/v1/diet-plan-templates/:id/meals`
  * Body: `{ "name": "BREAKFAST", "mealOrder": 1, "mealTime": "08:30 AM" }`
  * **Tip**: Enforce unique `mealOrder` values client-side to prevent backend conflict errors.
* **Update Meal**: `PATCH /api/v1/template-meals/:mealId`
* **Delete Meal**: `DELETE /api/v1/template-meals/:mealId`

### B. Template Meal Item & Food Library Integration
Allows adding food ingredients or items to template meals.

* **Add Item**: `POST /api/v1/template-meals/:mealId/items`
  * **Body Option 1 (Custom Food)**:
    ```json
    {
      "foodName": "Custom Protein Shake",
      "quantity": 1,
      "unit": "scoop",
      "calories": 120,
      "protein": 24,
      "carbs": 3,
      "fat": 1.5
    }
    ```
  * **Body Option 2 (Food Library integration)**:
    Provide `foodLibraryId` to link the item. The backend will fetch default values and store a snapshot to protect history.
    ```json
    {
      "foodLibraryId": "cmprso1rc0005u2bep29p9bsl",
      "quantity": 100,
      "unit": "grams",
      "notes": "Add to template item"
    }
    ```
* **Update Item**: `PATCH /api/v1/template-meal-items/:itemId`
* **Delete Item**: `DELETE /api/v1/template-meal-items/:itemId`

### C. Live Macro Auto-Aggregation
Whenever template meals or items are modified, the backend automatically recalculates `totalCalories`, `totalProtein`, `totalCarbs`, and `totalFat` on the template. When rendering the page, fetch `GET /api/v1/diet-plan-templates/:id` to display the updated values instantly.

# Frontend Integration Guide: Diet Plan Builder Module

This guide details how to integrate the newly implemented **Diet Plan Builder** API endpoints in the React/Next.js frontend.

---

## 1. API Endpoints Reference

### Diet Plans
| Purpose | Method | Path | Request Body / Query Params |
| :--- | :--- | :--- | :--- |
| **Create Diet Plan** | `POST` | `/api/v1/clients/:clientId/diet-plans` | Body: `{ title, description?, goal?, assessmentId?, dailyCalories?, proteinGrams?, carbGrams?, fatGrams?, startDate?, endDate?, status? }` |
| **List Diet Plans** | `GET` | `/api/v1/clients/:clientId/diet-plans` | Query: `?page=1&limit=10` |
| **Get Details** (with meals & items) | `GET` | `/api/v1/diet-plans/:id` | N/A |
| **Update Diet Plan** | `PATCH`| `/api/v1/diet-plans/:id` | Body: `{ title?, description?, goal?, dailyCalories?, ... }` |
| **Delete Diet Plan** | `DELETE`| `/api/v1/diet-plans/:id` | N/A |

### Meals
| Purpose | Method | Path | Request Body |
| :--- | :--- | :--- | :--- |
| **Create Meal** | `POST` | `/api/v1/diet-plans/:id/meals` | Body: `{ name, mealOrder, mealTime?, notes? }` |
| **Update Meal** | `PATCH`| `/api/v1/meals/:mealId` | Body: `{ name?, mealOrder?, mealTime?, notes? }` |
| **Delete Meal** | `DELETE`| `/api/v1/meals/:mealId` | N/A |

### Meal Items
| Purpose | Method | Path | Request Body |
| :--- | :--- | :--- | :--- |
| **Create Meal Item** | `POST` | `/api/v1/meals/:mealId/items` | Body: `{ foodName, quantity, unit, calories?, protein?, carbs?, fat?, notes? }` |
| **Update Meal Item** | `PATCH`| `/api/v1/meal-items/:itemId` | Body: `{ foodName?, quantity?, unit?, calories?, ... }` |
| **Delete Meal Item** | `DELETE`| `/api/v1/meal-items/:itemId` | N/A |

---

## 2. Enums and Options

When building selection lists or dropdowns, match these enum string constants:

* **DietPlanStatus**: `DRAFT`, `ACTIVE`, `ARCHIVED`
* **MealType**:
  * `BREAKFAST` (Breakfast)
  * `MID_MORNING` (Mid-Morning Snack)
  * `LUNCH` (Lunch)
  * `EVENING_SNACK` (Evening Snack)
  * `DINNER` (Dinner)
  * `BEDTIME` (Bedtime Snack)

---

## 3. Recommended Frontend API Hook/Service Methods

```javascript
// src/services/dietPlan.service.js
import api from './api';

export const dietPlanService = {
  // ─── Diet Plans ────────────────────────────────────────────────────────────
  create: async (clientId, data) => {
    const response = await api.post(`/clients/${clientId}/diet-plans`, data);
    return response.data;
  },

  list: async (clientId, page = 1, limit = 10) => {
    const response = await api.get(`/clients/${clientId}/diet-plans`, {
      params: { page, limit },
    });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/diet-plans/${id}`);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.patch(`/diet-plans/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/diet-plans/${id}`);
    return response.data;
  },

  // ─── Meals ─────────────────────────────────────────────────────────────────
  createMeal: async (dietPlanId, data) => {
    const response = await api.post(`/diet-plans/${dietPlanId}/meals`, data);
    return response.data;
  },

  updateMeal: async (mealId, data) => {
    const response = await api.patch(`/meals/${mealId}`, data);
    return response.data;
  },

  deleteMeal: async (mealId) => {
    const response = await api.delete(`/meals/${mealId}`);
    return response.data;
  },

  // ─── Meal Items ────────────────────────────────────────────────────────────
  createMealItem: async (mealId, data) => {
    const response = await api.post(`/meals/${mealId}/items`, data);
    return response.data;
  },

  updateMealItem: async (itemId, data) => {
    const response = await api.patch(`/meal-items/${itemId}`, data);
    return response.data;
  },

  deleteMealItem: async (itemId) => {
    const response = await api.delete(`/meal-items/${itemId}`);
    return response.data;
  },
};
```

---

## 4. UI Recommendations

1. **Diet Plans Tab**:
   * Add a "Diet Plans" tab inside the Client Detail page (`/dashboard/clients/[id]`).
   * Display a list of client diet plans. Under each, show the status badge (`DRAFT` = yellow, `ACTIVE` = green, `ARCHIVED` = gray) and calorie/macronutrient summaries.

2. **Diet Plan Builder Workspace**:
   * When clicking a plan, open a detailed workspace or drawer displaying the full plan details.
   * Organize meals vertically sorted by `mealOrder` or chronologically.
   * Provide options to:
     * Add a meal (from the `MealType` dropdown list).
     * Add food items inside a meal header.
     * Edit/delete individual food items inline.
     * Edit/delete meal sections.

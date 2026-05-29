# Frontend Integration Guide: Client Assessments Module

This guide details how to integrate the newly implemented **Client Assessments** API endpoints in the React/Next.js frontend.

---

## 1. API Endpoints Reference

| Purpose | Method | Path | Request Body / Query Params |
| :--- | :--- | :--- | :--- |
| **Create Assessment** | `POST` | `/api/v1/clients/:clientId/assessments` | Body: `{ title, assessmentDate, heightCm?, weightKg?, goal?, activityLevel?, waterIntakeLiters?, sleepHours?, medicalConditions?, allergies?, medications?, foodPreferences?, foodRestrictions?, notes? }` |
| **List Assessments** | `GET` | `/api/v1/clients/:clientId/assessments` | Query: `?page=1&limit=10` |
| **Get Details** | `GET` | `/api/v1/assessments/:id` | N/A |
| **Update Assessment** | `PATCH`| `/api/v1/assessments/:id` | Body: `{ title?, assessmentDate?, heightCm?, weightKg?, ... }` |
| **Delete Assessment** | `DELETE`| `/api/v1/assessments/:id` | N/A |

---

## 2. Activity Level Enum Values

If you implement a dropdown for the `activityLevel` field in your assessment form, use the following enum values:

* `SEDENTARY` (Sedentary)
* `LIGHTLY_ACTIVE` (Lightly Active)
* `MODERATELY_ACTIVE` (Moderately Active)
* `VERY_ACTIVE` (Very Active)
* `EXTRA_ACTIVE` (Extra Active)

---

## 3. Recommended Frontend API Hook/Service Methods

```javascript
// src/services/assessment.service.js
import api from './api';

export const assessmentService = {
  // Create an assessment
  create: async (clientId, data) => {
    const response = await api.post(`/clients/${clientId}/assessments`, data);
    return response.data;
  },

  // Get list of client assessments (paginated)
  list: async (clientId, page = 1, limit = 10) => {
    const response = await api.get(`/clients/${clientId}/assessments`, {
      params: { page, limit },
    });
    return response.data;
  },

  // Get single assessment details
  getById: async (id) => {
    const response = await api.get(`/assessments/${id}`);
    return response.data;
  },

  // Update assessment details
  update: async (id, data) => {
    const response = await api.patch(`/assessments/${id}`, data);
    return response.data;
  },

  // Soft delete assessment
  delete: async (id) => {
    const response = await api.delete(`/assessments/${id}`);
    return response.data;
  },
};
```

---

## 4. UI Recommendations

1. **Dashboard Tab**:
   * Integrate an "Assessments" tab inside `/dashboard/clients/[id]` alongside "Profile" and "Settings".
   * Display a timeline or list of prior assessments with titles, dates, weight, and automatically calculated BMIs.

2. **Creation Dialog/Modal**:
   * Create an "Add Assessment" modal.
   * Provide fields matching the domain attributes (numeric inputs for height, weight, water, sleep; text areas for allergies/medical conditions/notes; select dropdown for activity level).
   * Note that `bmi` is calculated dynamically on the backend and returned in the creation/update responses, so you don't need to perform calculations on the frontend.

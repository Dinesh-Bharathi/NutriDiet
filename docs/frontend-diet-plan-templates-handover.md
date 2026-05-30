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
- `GET /api/v1/diet-plan-templates`
- `POST /api/v1/diet-plan-templates`
- `GET /api/v1/diet-plan-templates/:id`
- `PATCH /api/v1/diet-plan-templates/:id`
- `DELETE /api/v1/diet-plan-templates/:id`

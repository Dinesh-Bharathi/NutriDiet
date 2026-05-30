# Frontend Progress & Reviews Handover Guide

This guide describes integration models, chart structures, response fields, and suggested layouts for rendering client progress charts and the review dashboards.

---

## 1. Routing Summary
The following API routes are available to the frontend. All require a valid JWT bearer token in the `Authorization` header:

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| **GET** | `/api/v1/clients/:clientId/progress` | Trend arrays for line charts (Weight, BMI, Sleep, Water, Adherence). |
| **GET** | `/api/v1/clients/:clientId/progress-summary` | Overall summaries, total changes, and averages. |
| **GET** | `/api/v1/clients/:clientId/progress-snapshot` | Simplified high-level metric card (weight lost, waist lost, adherence %). |
| **GET** | `/api/v1/reviews/dashboard` | Practitioner dashboard stats (Completion Rate, Stalled/Low Adherence, Inbox). |

---

## 2. Suggested Chart Data Mapping

### A. Weight & BMI Trends
Combine weight and BMI trend arrays for double-axis line charts or display them in adjacent cards.
* **Component Mapping (Recharts LineChart)**:
  * **Data**: `weight` / `bmi` arrays.
  * **X-Axis Key**: `date` (format: YYYY-MM-DD).
  * **Y-Axis Key**: `value`.
  * **Tooltip Info**: Includes `change` (e.g., `-1.8` kg) and `trend` (`DOWN` | `UP` | `STABLE`).

### B. Body Measurements Trend
Render multi-line charts tracking circumferences over time.
* **X-Axis Key**: `date`.
* **Line Series**: `waist` (waistChange), `hip` (hipChange), `chest` (chestChange), `arm` (armChange), `thigh` (thighChange).

### C. Lifestyle Compliance
Track sleep, water, and exercise in daily bar or area charts.
* **Values**: `sleepHours`, `waterIntakeLiters`, `exerciseDays`.

### D. Plan Adherence
Render a sparkline or rating dot plot.
* **Rating Scale**: `value` (integer 1-5).
* **Hover Tooltip**: Render `notes` (practitioner/client notes).

---

## 3. UI Layout Suggestions

### A. Client Profile: Progress Tab
* **Header Cards (using `/progress-snapshot`)**:
  * **Weight Lost**: Render value (e.g. `4.2 kg`) with downward green trend badge if positive.
  * **Waist Lost**: Render value (e.g. `6 cm`) with downward green trend badge if positive.
  * **Plan Adherence**: Render progress circle or bar indicating the percentage (e.g. `84%`).
  * **Sleep Average**: Render avg sleep value (e.g. `7.2 hrs`).
  * **Log Count**: Render the total check-ins count.
* **Chart Grid**:
  * **Widget 1 (Line Chart)**: Weight & BMI.
  * **Widget 2 (Line Chart)**: Body Measurements (waist, hip, chest).
  * **Widget 3 (Bar Chart)**: Lifestyle Hydration vs. Sleep.
  * **Widget 4 (Area Chart)**: Adherence timeline with comment overlays.

### B. Reviews Dashboard (Practitioner Home)
* **Stats Row**:
  * **Completion Rate**: Radial progress card showing `reviewCompletionRate` (e.g., `85%`).
  * **Requires Follow-up**: Card showing count or shortcut linking to flagged check-ins.
* **Risk Analytics Tables**:
  * **Low Adherence Queue**: Lists clients where `averageAdherence` is `< 3.0` with drill-down to adjust their diet plans.
  * **Weight Stalled Queue**: Lists clients whose weight change is `>= -0.2 kg` (no reduction) over their last 3 logs, letting practitioners flag reviews or adjust caloric intake.
* **Check-ins Inbox**:
  * Render `pendingReviews` (`status = SUBMITTED`) in a practitioner action queue allowing inline review dialogues.

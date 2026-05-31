# Demo Seed System Guide

The Nutri-Diet platform has a complete Demo Seed System that clears out business data and populates a rich, realistic, and consistent environment suitable for Sales Demos, QA testing, frontend integration, and walkthroughs.

## Seed Command

To wipe the existing database and repopulate it, run:

```bash
npm run db:seed
```

This command runs `prisma/seed.js` which performs the following steps:
1. **Clear Database**: Wipes all transactional and master tables in constraint-respecting order.
2. **Tenants**: Seeds two primary tenants representing distinct target businesses.
3. **Users**: Seeds four staff roles (`OWNER`, `ADMIN`, `DIETITIAN`, `ASSISTANT`) for each tenant with predictable credentials.
4. **Food Library**: Seeds 22 realistic foods per tenant complete with custom units, serving options, categories, and dietary tags.
5. **Clients**: Seeds 5 realistic client profiles per tenant assigned to a primary dietitian.
6. **Assessments**: Instantiates complete initial health intake records for all clients, fully populating sleep, activity, medical history, goals, etc.
7. **Templates**: Seeds three pre-configured master meal plan templates (e.g., High Protein, Fat Loss, Vegetarian Balance) containing Day A/Day B cycle days, scheduled meals, and calorie/macro distributions.
8. **Diet Plans**: Creates an active cycle-based diet plan with breakfasts, lunches, snacks, dinners, and foods for all 10 clients.
9. **Check-ins**: Seeds 6 historical weekly check-in records per client representing a weight/waist progression, with specific low adherence and weight stall anomalies designed to populate dashboards.

---

## Demo Credentials & Tenant Scoping

Both tenants use the same password for all seeded users: `Password@123`.

### Tenant 1: Nutri Diet Demo
* **Slug**: `nutri-diet-fe`
* **Plan**: `ENTERPRISE`
* **Region/Locale**: India (`IN`, `Asia/Kolkata`, `en-IN`, `INR`, `METRIC`)
* **Local URL Path**: `/tenant/nutri-diet-fe`

| Role | Email | Password |
|---|---|---|
| **OWNER** | `owner@nutridiet.demo` | `Password@123` |
| **ADMIN** | `admin@nutridiet.demo` | `Password@123` |
| **DIETITIAN** | `dietitian@nutridiet.demo` | `Password@123` |
| **ASSISTANT** | `assistant@nutridiet.demo` | `Password@123` |

### Tenant 2: FitLife Nutrition
* **Slug**: `fitlife`
* **Plan**: `PROFESSIONAL`
* **Region/Locale**: Australia (`AU`, `Australia/Sydney`, `en-AU`, `AUD`, `METRIC`)
* **Local URL Path**: `/tenant/fitlife`

| Role | Email | Password |
|---|---|---|
| **OWNER** | `owner@fitlife.demo` | `Password@123` |
| **ADMIN** | `admin@fitlife.demo` | `Password@123` |
| **DIETITIAN** | `dietitian@fitlife.demo` | `Password@123` |
| **ASSISTANT** | `assistant@fitlife.demo` | `Password@123` |

---

## Demo Data Coverage & Dashboard Scenarios

The seed system populates diverse states designed to make frontend dashboards and charts feel alive:

1. **Progress Dashboard Charts**:
   - Every client has 6 weeks of historical weekly check-in data.
   - 4 out of 5 clients demonstrate regular progress (steady fat/weight loss).
   - 1 client per tenant (Rohan Verma for Tenant 1, William Taylor for Tenant 2) is seeded with a **Weight Stall** profile (weight flatlining over the last 4 weeks) and a **Low Adherence** profile (adherence score dropping to 3/10 or 4/10 due to simulated work stress).

2. **Review Dashboard Mix**:
   - Weeks 1 to 5 check-ins are fully `REVIEWED` by the assigned dietitian with custom practitioner notes.
   - Week 6 (current week) check-ins are a mixture:
     - 3 clients are marked as `REVIEWED` (completed reviews).
     - 2 clients are marked as `SUBMITTED` (awaiting practitioner review), allowing the practitioner dashboard to show realistic pending items to action.

3. **Food Library & Cycles**:
   - 22 custom foods containing detailed search keywords (e.g., `chicken`, `avocado`, `whey`), brands (e.g., `Quaker`, `Fage`), and serving definitions (`CUP`, `PIECE`, `BOWL`, `TBSP`, `SCOOP`).
   - Active client plans are divided into **Day A (Training Day)** and **Day B (Rest Day)** cycles containing precise calorie/macro variations.

# Architecture — Nutri-Diet Backend

## Overview

The Nutri-Diet backend is a **Modular Monolith** — a single deployable unit with clean internal boundaries that allow future extraction into microservices without architectural rewrites.

---

## Architecture Philosophy

### Why Modular Monolith?

| Concern | Microservices | Modular Monolith |
|---------|--------------|------------------|
| Development velocity | Slow (distributed complexity) | Fast |
| Operational complexity | High (service mesh, tracing) | Low |
| Data consistency | Hard (distributed transactions) | Easy |
| Future migration | N/A | Clean module boundaries |
| Suitable for Phase 1 | ❌ | ✅ |

A modular monolith gives us clean architecture and clear module boundaries today. When traffic and team size justify it, individual modules can be extracted into independent services.

---

## Layer Architecture

```
Request
  │
  ▼
┌──────────────────────────────────┐
│          Security Layer          │  Helmet, CORS, Rate Limit, XSS
└──────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────┐
│           Auth Middleware        │  JWT verification → req.user
└──────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────┐
│          Tenant Middleware       │  Validate tenant status → req.tenant
└──────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────┐
│           RBAC Middleware        │  Role enforcement
└──────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────┐
│        Validation Middleware     │  Zod schema validation
└──────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────┐
│           Controller             │  HTTP in/out only — thin
└──────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────┐
│            Service               │  Business logic
└──────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────┐
│           Repository             │  DB access only — tenant-scoped
└──────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────┐
│        Prisma ORM / Redis        │  Infrastructure
└──────────────────────────────────┘
```

---

## Module Structure

Each module is self-contained under `src/modules/<module-name>/`:

```
src/modules/auth/
├── auth.routes.js        # Route declarations + middleware wiring
├── auth.controller.js    # HTTP layer (thin)
├── auth.service.js       # Business logic
├── auth.repository.js    # DB queries (always tenant-scoped)
└── auth.validator.js     # Zod schemas for this module
```

### Controller Rules
- Must be **thin**
- Extract params from `req`
- Call a service method
- Call `sendSuccess` / `sendError`
- Never contain business logic
- Never query the database

### Service Rules
- Contains all business logic
- Orchestrates repositories
- Throws `ApiError` for business violations
- Never touches `req` or `res`

### Repository Rules
- Only raw Prisma queries
- **Every query must include `tenantId` in the WHERE clause**
- Never contains business logic
- Returns plain data objects

---

## Tenant Isolation

Tenant isolation is enforced at two layers:

1. **Middleware Layer** — `resolveTenant` confirms tenant is active
2. **Repository Layer** — every query filters by `tenantId`

```js
// Every repository method looks like this:
async findById(tenantId, clientId) {
  return prisma.client.findFirst({
    where: {
      id: clientId,
      tenantId,          // ← MANDATORY
      deletedAt: null,   // ← Soft delete filter
    },
  });
}
```

The `tenantId` used in repository calls always comes from `req.user.tenantId` (JWT-extracted), never from request body or query params.

---

## Future Microservice Migration Path

Each module can become a microservice when needed:

1. Extract the module folder into a new service repository
2. Replace repository imports with REST/gRPC calls
3. The business logic in services remains unchanged
4. The database schema per module can be split into dedicated databases

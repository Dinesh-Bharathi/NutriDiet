# Database Rules — Nutri-Diet Backend

## Primary Key Strategy

All primary keys use **`cuid()`** (collision-resistant unique identifiers).

- URL-safe (no special characters)
- Sortable (time-ordered)
- Not guessable (unlike sequential integers)
- No UUID version complexity

```prisma
model Client {
  id String @id @default(cuid())
}
```

**Never** use auto-increment integers as primary keys for tenant-owned entities.

---

## Soft Delete Strategy

Business data is **never hard-deleted**. All entities use `deletedAt`:

```prisma
deletedAt DateTime?
```

### Rules

1. Set `deletedAt = new Date()` instead of calling `prisma.X.delete()`
2. Every repository `find*` query must include `deletedAt: null` in the WHERE clause
3. Only OWNER-level operations can purge soft-deleted data (future Phase)
4. Background cleanup jobs handle permanent removal after retention period

```js
// ✅ Correct — soft delete
await prisma.client.update({
  where: { id, tenantId },
  data: { deletedAt: new Date() },
});

// ❌ Wrong — hard delete
await prisma.client.delete({ where: { id } });
```

---

## Timestamps

Every model must have:

```prisma
createdAt DateTime  @default(now())
updatedAt DateTime  @updatedAt
deletedAt DateTime?
```

`updatedAt` is managed automatically by Prisma.

---

## Tenancy Rule

Every entity that belongs to a tenant MUST have:

```prisma
tenantId String
tenant   Tenant @relation(fields: [tenantId], references: [id])

@@index([tenantId])
```

And every repository query must filter by it:

```js
where: { tenantId, deletedAt: null }
```

---

## Indexing Rules

Always index:
- `tenantId` — on every tenant-owned table
- `tenantId, <role/status>` — compound indexes for common filter combos
- Foreign keys — Prisma does not auto-create FK indexes
- `email` within tenant scope — `@@unique([tenantId, email])`

---

## Unique Constraints

Email uniqueness is **scoped to the tenant**, not global:

```prisma
@@unique([tenantId, email])
```

This allows the same email address to belong to different tenants (e.g., a dietitian who works at two separate clinics).

---

## Migration Rules

1. Never edit an existing migration file — always create new migrations
2. Run `npm run db:migrate` in development
3. Run `npm run db:migrate:deploy` in CI/CD and production
4. Migration names must be descriptive: `add_client_health_profile`, not `update1`
5. Never drop columns — add nullable columns and migrate data in a later PR

---

## Naming Conventions

| Element      | Convention           | Example            |
|--------------|----------------------|--------------------|
| Table names  | snake_case (plural)  | `meal_plans`       |
| Column names | camelCase in schema  | `dietitianId`      |
| Model names  | PascalCase           | `MealPlan`         |
| Index names  | auto-generated       | Prisma handles     |
| Relations    | camelCase            | `assignedClients`  |

Use `@@map("table_name")` to control the PostgreSQL table name explicitly.

---

## Enum Strategy

Enums are defined in Prisma schema and synced to PostgreSQL as native enum types. Do not store role/status strings as plain VARCHAR — always use Prisma enums so invalid values are rejected at the database level.

---

## Sensitive Data

- Passwords are stored as **bcrypt hashes only** (`passwordHash`)
- PHI (Protected Health Information) fields go into a separate encrypted model (Phase 2)
- Never log or return `passwordHash` in API responses
- JWT secrets live only in environment variables — never in code or the database

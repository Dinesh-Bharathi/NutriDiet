# API Conventions — Nutri-Diet Backend

## Base URL

```
/api/v1
```

All routes are versioned. Breaking changes require a new version prefix (`v2`).

---

## HTTP Methods

| Method   | Usage                        |
|----------|------------------------------|
| `GET`    | Retrieve resource(s)         |
| `POST`   | Create a new resource        |
| `PUT`    | Replace a resource fully     |
| `PATCH`  | Partial resource update      |
| `DELETE` | Soft-delete a resource       |

---

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Clients fetched successfully",
  "data": { },
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

- `data` is omitted if there is no payload (e.g., 204 No Content)
- `meta` is omitted for non-paginated single-resource responses

### Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email address" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

- `errors` is omitted for non-validation errors (auth, not-found, etc.)

---

## HTTP Status Code Conventions

| Status | Meaning                              | When to use                        |
|--------|--------------------------------------|------------------------------------|
| `200`  | OK                                   | Successful GET, PATCH, PUT         |
| `201`  | Created                              | Successful POST (resource created) |
| `204`  | No Content                           | Successful DELETE                  |
| `400`  | Bad Request                          | Malformed request body             |
| `401`  | Unauthorized                         | Missing/invalid/expired JWT        |
| `403`  | Forbidden                            | Authenticated but not authorized   |
| `404`  | Not Found                            | Resource does not exist            |
| `409`  | Conflict                             | Duplicate resource (unique key)    |
| `422`  | Unprocessable Entity                 | Business rule violation            |
| `429`  | Too Many Requests                    | Rate limit exceeded                |
| `500`  | Internal Server Error                | Unexpected server error            |

---

## Pagination

All list endpoints support cursor-free page-based pagination via query parameters:

| Parameter | Default | Max  | Description    |
|-----------|---------|------|----------------|
| `page`    | `1`     | —    | Page number    |
| `limit`   | `20`    | `100`| Items per page |

Example: `GET /api/v1/clients?page=2&limit=50`

---

## Filtering & Sorting

- Filter parameters use direct field names: `?status=ACTIVE`
- Sort via `?sortBy=createdAt&sortOrder=desc`
- Default sort is always `createdAt DESC`

---

## Authentication

All protected routes require:

```
Authorization: Bearer <access_token>
```

Access tokens expire in 15 minutes. Refresh tokens are valid for 7 days.

---

## Naming Conventions

- Endpoints use **kebab-case**: `/meal-plans`, `/appointment-slots`
- Query params use **camelCase**: `?sortBy=firstName`
- JSON body and response keys use **camelCase**

---

## Route Naming Pattern

```
GET    /api/v1/clients           → List all clients (paginated)
POST   /api/v1/clients           → Create a client
GET    /api/v1/clients/:id       → Get a single client
PATCH  /api/v1/clients/:id       → Update a client
DELETE /api/v1/clients/:id       → Soft-delete a client
```

# Auth API Reference — Nutri-Diet Backend

## Base URL

```
/api/v1/auth
```

---

## POST /api/v1/auth/register

Creates a new tenant and its first OWNER user in a single atomic transaction.

**Rate limit:** 5 requests / hour per IP

### Request

```json
{
  "tenantName": "Green Wellness Clinic",
  "tenantSlug": "green-wellness",
  "firstName":  "Priya",
  "lastName":   "Sharma",
  "email":      "priya@greenwellness.com",
  "password":   "Secure@Pass1"
}
```

| Field        | Type   | Rules                                        |
|--------------|--------|----------------------------------------------|
| `tenantName` | string | 2–100 chars                                  |
| `tenantSlug` | string | 2–50 chars, `[a-z0-9-]`, no leading/trailing `-` |
| `firstName`  | string | 1–100 chars                                  |
| `lastName`   | string | 1–100 chars                                  |
| `email`      | string | valid email, lowercased                      |
| `password`   | string | min 8, 1 uppercase, 1 number, 1 special char |

### Response `201 Created`

```json
{
  "success": true,
  "message": "Registration successful. Welcome to Nutri-Diet!",
  "data": {
    "user": {
      "id":        "clu...",
      "email":     "priya@greenwellness.com",
      "firstName": "Priya",
      "lastName":  "Sharma",
      "fullName":  "Priya Sharma",
      "role":      "OWNER",
      "status":    "ACTIVE",
      "avatarUrl": null,
      "tenant": {
        "id":   "clt...",
        "name": "Green Wellness Clinic",
        "slug": "green-wellness",
        "plan": "FREE"
      },
      "createdAt": "2026-05-27T12:00:00.000Z"
    },
    "accessToken": "<jwt>"
  }
}
```

Sets `nd_access` and `nd_refresh` httpOnly cookies on the response.

### Error Responses

| Status | Message |
|--------|---------|
| `400`  | Validation failed (field-level errors in `errors[]`) |
| `409`  | This organisation URL is already taken |
| `429`  | Too many registration attempts |

---

## POST /api/v1/auth/login

**Rate limit:** 20 requests / 15 min per IP

### Request

```json
{
  "email":      "priya@greenwellness.com",
  "password":   "Secure@Pass1",
  "tenantSlug": "green-wellness"
}
```

> `tenantSlug` is required because email uniqueness is scoped per-tenant.
> Two separate clinics can have the same staff email address.

### Response `200 OK`

Same shape as `/register` response. Sets auth cookies.

### Error Responses

| Status | Message |
|--------|---------|
| `400`  | Validation failed |
| `401`  | Invalid email, password, or organisation _(generic — prevents enumeration)_ |
| `403`  | Account inactive / Organisation suspended or cancelled |
| `429`  | Too many authentication attempts |

---

## POST /api/v1/auth/refresh

Rotates the refresh token. Accepts the token from the `nd_refresh` httpOnly cookie
(browsers) or the `refreshToken` body field (REST/mobile clients).

**Token reuse detection:** If a revoked token is presented, ALL sessions for that user
are immediately terminated as a security measure.

### Request (body — optional for browser clients using cookie)

```json
{ "refreshToken": "<raw_refresh_token>" }
```

### Response `200 OK`

Same shape as login response. New cookies are set.

### Error Responses

| Status | Message |
|--------|---------|
| `401`  | Refresh token is required |
| `401`  | Invalid refresh token |
| `401`  | Security alert: refresh token reuse detected. All sessions terminated. |
| `401`  | Refresh token has expired. Please log in again. |

---

## POST /api/v1/auth/logout

Revokes the refresh token and clears auth cookies.
**Always returns `200`** — safe to call even when already logged out.

### Response `200 OK`

```json
{ "success": true, "message": "Logged out successfully" }
```

---

## GET /api/v1/auth/me

Returns the authenticated user's profile.

**Requires:** `Authorization: Bearer <access_token>` header or `nd_access` cookie.

### Response `200 OK`

```json
{
  "success": true,
  "message": "User profile retrieved",
  "data": {
    "id":        "clu...",
    "email":     "priya@greenwellness.com",
    "firstName": "Priya",
    "lastName":  "Sharma",
    "fullName":  "Priya Sharma",
    "role":      "OWNER",
    "status":    "ACTIVE",
    "avatarUrl": null,
    "tenant": {
      "id":   "clt...",
      "name": "Green Wellness Clinic",
      "slug": "green-wellness",
      "plan": "FREE"
    },
    "createdAt": "2026-05-27T12:00:00.000Z"
  }
}
```

### Error Responses

| Status | Message |
|--------|---------|
| `401`  | Authentication token is missing |
| `401`  | Token has expired, please login again |
| `404`  | User not found |

---

## Security Design Notes

### Why `tenantSlug` is required for login

Email uniqueness is **per-tenant**, not global. A user can belong to multiple tenants
with the same email address. The `tenantSlug` makes the login intent unambiguous.

### Token Strategy

| Token        | Lifetime | Storage        | Transport          |
|--------------|----------|----------------|--------------------|
| Access JWT   | 15 min   | httpOnly cookie + body | `Authorization: Bearer` or cookie |
| Refresh token| 7 days   | httpOnly cookie + DB (hashed) | Cookie only |

### Refresh Token Rotation

Every successful `/refresh` call:
1. Revokes the incoming token
2. Issues a new raw refresh token
3. Stores only the SHA-256 hash in the database

### Token Reuse Detection

If a refresh token that was already revoked is presented:
- All active refresh tokens for that user are revoked immediately
- A `401` error is returned with a security alert message
- The user must log in again

This detects token theft scenarios where both the legitimate user and an attacker
attempt to use the same token.

# Settings & Localization API Reference

## Endpoints

### 1. Retrieve Localization Options
Returns system-wide lists of supported countries, currencies, timezones, and locales. This response is cached in memory.

* **URL**: `/api/v1/settings/localization-options`
* **Method**: `GET`
* **Headers**:
  * `Authorization: Bearer <token>`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Localization options retrieved successfully",
    "data": {
      "countries": [
        { "code": "AD", "name": "Andorra" },
        { "code": "AE", "name": "United Arab Emirates" }
        // ...
      ],
      "currencies": [
        { "code": "AED", "name": "UAE Dirham" },
        { "code": "AFN", "name": "Afghani" }
        // ...
      ],
      "timezones": [
        { "name": "Africa/Abidjan", "utcOffset": 0, "utcOffsetStr": "+00:00" },
        { "name": "Africa/Accra", "utcOffset": 0, "utcOffsetStr": "+00:00" }
        // ...
      ],
      "locales": [
        { "code": "en-US", "name": "English (United States)" },
        { "code": "en-IN", "name": "English (India)" }
        // ...
      ]
    }
  }
  ```

---

### 2. Retrieve Tenant Settings
Retrieves localization and measurement settings configured for the current tenant.

* **URL**: `/api/v1/settings/tenant`
* **Method**: `GET`
* **Headers**:
  * `Authorization: Bearer <token>`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Tenant settings retrieved successfully",
    "data": {
      "countryCode": "IN",
      "timezone": "Asia/Kolkata",
      "locale": "en-IN",
      "currencyCode": "INR",
      "measurementSystem": "METRIC",
      "updatedAt": "2026-05-30T15:26:08.420Z"
    }
  }
  ```

---

### 3. Update Tenant Settings
Updates the corporate localization and measurement preferences for the tenant.

* **URL**: `/api/v1/settings/tenant`
* **Method**: `PATCH`
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "countryCode": "IN",
    "timezone": "Asia/Kolkata",
    "locale": "en-IN",
    "currencyCode": "INR",
    "measurementSystem": "METRIC"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Tenant settings updated successfully",
    "data": {
      "countryCode": "IN",
      "timezone": "Asia/Kolkata",
      "locale": "en-IN",
      "currencyCode": "INR",
      "measurementSystem": "METRIC",
      "updatedAt": "2026-05-30T15:26:08.420Z"
    }
  }
  ```

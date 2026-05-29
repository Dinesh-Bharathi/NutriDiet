# Client Assessments API Reference

The Client Assessments Module allows practitioners to record, update, retrieve, list, and soft-delete client assessments. All endpoints require a valid Bearer Token and are strictly tenant-isolated.

---

## 1. Create Client Assessment
Creates a new clinical assessment for a client. Calculates BMI automatically if both height and weight are provided.

* **URL**: `/api/v1/clients/:clientId/assessments`
* **Method**: `POST`
* **Auth Required**: Yes (`Bearer Token`)
* **Min Role**: `ASSISTANT`
* **Request Params**:
  * `clientId` (string, required)
* **Request Body**:
  ```json
  {
    "title": "Initial Intake Assessment",
    "assessmentDate": "2026-05-29T12:00:00Z",
    "heightCm": 180,
    "weightKg": 75,
    "goal": "Improve general fitness and muscle tone.",
    "activityLevel": "MODERATELY_ACTIVE",
    "waterIntakeLiters": 2.5,
    "sleepHours": 7.5,
    "medicalConditions": "None",
    "allergies": "Peanuts",
    "medications": "None",
    "foodPreferences": "High protein, loves berries",
    "foodRestrictions": "Gluten-free",
    "notes": "Overall good health, needs sleep schedule refinement."
  }
  ```
  *(Note: All fields except `title` are optional. `activityLevel` must be one of: `SEDENTARY`, `LIGHTLY_ACTIVE`, `MODERATELY_ACTIVE`, `VERY_ACTIVE`, `EXTRA_ACTIVE`)*
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Assessment created successfully",
    "data": {
      "assessment": {
        "id": "cmpr8mmrj000537gl83y17w5x",
        "clientId": "cmpr8mk9w000337glaa2n0ooa",
        "title": "Initial Intake Assessment",
        "assessmentDate": "2026-05-29",
        "heightCm": 180,
        "weightKg": 75,
        "bmi": 23.15,
        "goal": "Improve general fitness and muscle tone.",
        "activityLevel": "MODERATELY_ACTIVE",
        "waterIntakeLiters": 2.5,
        "sleepHours": 7.5,
        "medicalConditions": "None",
        "allergies": "Peanuts",
        "medications": "None",
        "foodPreferences": "High protein, loves berries",
        "foodRestrictions": "Gluten-free",
        "notes": "Overall good health, needs sleep schedule refinement.",
        "createdAt": "2026-05-29T18:10:48.128Z",
        "updatedAt": "2026-05-29T18:10:48.128Z",
        "creator": {
          "id": "cmpr1vjnd0002zm1gsmwr7ss0",
          "firstName": "Demo",
          "lastName": "Owner",
          "fullName": "Demo Owner",
          "email": "owner@demo-clinic.com"
        }
      }
    }
  }
  ```

---

## 2. List Client Assessments
Retrieves a paginated list of assessments for a client, sorted by `assessmentDate` descending.

* **URL**: `/api/v1/clients/:clientId/assessments`
* **Method**: `GET`
* **Auth Required**: Yes (`Bearer Token`)
* **Min Role**: `ASSISTANT`
* **Request Params**:
  * `clientId` (string, required)
* **Query Parameters**:
  * `page` (integer, optional, default: 1)
  * `limit` (integer, optional, default: 10)
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Assessments retrieved successfully",
    "data": {
      "assessments": [
        {
          "id": "cmpr8mmrj000537gl83y17w5x",
          "clientId": "cmpr8mk9w000337glaa2n0ooa",
          "title": "Initial Intake Assessment",
          "assessmentDate": "2026-05-29",
          "heightCm": 180,
          "weightKg": 75,
          "bmi": 23.15,
          "goal": "Improve general fitness and muscle tone.",
          "activityLevel": "MODERATELY_ACTIVE",
          "waterIntakeLiters": 2.5,
          "sleepHours": 7.5,
          "medicalConditions": "None",
          "allergies": "Peanuts",
          "medications": "None",
          "foodPreferences": "High protein, loves berries",
          "foodRestrictions": "Gluten-free",
          "notes": "Overall good health, needs sleep schedule refinement.",
          "createdAt": "2026-05-29T18:10:48.128Z",
          "updatedAt": "2026-05-29T18:10:48.128Z",
          "creator": {
            "id": "cmpr1vjnd0002zm1gsmwr7ss0",
            "firstName": "Demo",
            "lastName": "Owner",
            "fullName": "Demo Owner",
            "email": "owner@demo-clinic.com"
          }
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

---

## 3. Get Assessment Details
Retrieves detailed information about a single assessment record.

* **URL**: `/api/v1/assessments/:id`
* **Method**: `GET`
* **Auth Required**: Yes (`Bearer Token`)
* **Min Role**: `ASSISTANT`
* **Request Params**:
  * `id` (string, required)
* **Success Response (200 OK)**:
  *(Same object shape as single assessment inside Create response)*

---

## 4. Update Client Assessment
Partially updates an assessment. Recalculates BMI dynamically if either height or weight parameters are modified.

* **URL**: `/api/v1/assessments/:id`
* **Method**: `PATCH`
* **Auth Required**: Yes (`Bearer Token`)
* **Min Role**: `ASSISTANT`
* **Request Params**:
  * `id` (string, required)
* **Request Body**:
  ```json
  {
    "weightKg": 80,
    "sleepHours": 8
  }
  ```
* **Success Response (200 OK)**:
  *(Returns the updated assessment object with recalculated BMI)*

---

## 5. Delete Assessment (Soft-Delete)
Soft-deletes an assessment by marking `deletedAt` with a timestamp. The assessment will no longer appear in retrieval or listing queries.

* **URL**: `/api/v1/assessments/:id`
* **Method**: `DELETE`
* **Auth Required**: Yes (`Bearer Token`)
* **Min Role**: `ASSISTANT`
* **Request Params**:
  * `id` (string, required)
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Assessment deleted successfully"
  }
  ```

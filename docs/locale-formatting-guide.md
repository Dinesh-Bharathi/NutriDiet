# Locale Formatting Guide - Nutri-Diet Frontend Strategy

This guide establishes the localization, formatting, and conversion standards based on the tenant bootstrap payload returned from `/auth/me`.

---

## 1. Date Formatting Strategy
Use JavaScript's native `Intl.DateTimeFormat` configured with the tenant's `locale` and `timezone`.

```javascript
/**
 * Formats a ISO date string or Date object to the tenant's regional preference.
 *
 * @param {Date|string} date
 * @param {string} locale - e.g., 'en-IN' or 'en-US'
 * @param {string} timezone - e.g., 'Asia/Kolkata' or 'America/New_York'
 */
export function formatDate(date, locale = 'en-US', timezone = 'UTC') {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(d);
}
```

### Formatting Examples:
- **India (`en-IN` / `Asia/Kolkata`)**: `05/06/2026` (or `5 Jun 2026`)
- **United States (`en-US` / `America/New_York`)**: `06/05/2026` (or `Jun 5, 2026`)

---

## 2. Currency Formatting Strategy
Format billing, pricing, and subscription options using the tenant's `currencyCode` and `locale`.

```javascript
/**
 * Formats numbers into currency values.
 *
 * @param {number} amount
 * @param {string} locale - e.g., 'en-IN'
 * @param {string} currencyCode - e.g., 'INR'
 */
export function formatCurrency(amount, locale = 'en-US', currencyCode = 'USD') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}
```

### Formatting Examples:
- **India (`en-IN`, `INR`)**: `₹500.00`
- **United States (`en-US`, `USD`)**: `$500.00`
- **Europe (`es-ES`, `EUR`)**: `500,00 €`

---

## 3. Measurement Display Strategy
Based on the `measurementSystem` configuration (`METRIC` or `IMPERIAL`), convert and format values prior to rendering.

### Weight (kg vs. lbs)
- **METRIC**: Display weights directly in kilograms (`kg`).
- **IMPERIAL**: Convert kilograms to pounds (`lbs`) using conversion factor `1 kg = 2.20462 lbs`.

```javascript
export function formatWeight(weightKg, system = 'METRIC') {
  if (system === 'IMPERIAL') {
    const lbs = Math.round(weightKg * 2.20462);
    return `${lbs} lbs`;
  }
  return `${weightKg} kg`;
}
```

### Height (cm vs. ft/in)
- **METRIC**: Display heights directly in centimeters (`cm`).
- **IMPERIAL**: Convert centimeters to feet and inches using `1 inch = 2.54 cm` and `12 inches = 1 foot`.

```javascript
export function formatHeight(heightCm, system = 'METRIC') {
  if (system === 'IMPERIAL') {
    const totalInches = heightCm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }
  return `${heightCm} cm`;
}
```

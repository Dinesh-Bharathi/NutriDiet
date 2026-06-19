// backend/verify_phase_7b.js
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { automationTemplateRegistry } from './src/modules/automation/automation-template-variables.js';
import { AUTOMATION_CONFIG } from './src/modules/automation/automation.config.js';

console.log('--- Phase 7B Verification Script ---\n');

// 1. Timezone Check
const clientTimezone = 'Asia/Kolkata';
const mealTime = '09:00';
const offset = -AUTOMATION_CONFIG.mealReminderOffsetMinutes; // -5

// Math helper for HH:mm offset
function offsetTime(timeStr, offsetMinutes) {
  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  const totalMinutes = hours * 60 + minutes + offsetMinutes;
  const wrappedMinutes = (totalMinutes + 24 * 60) % (24 * 60);
  const newHours = Math.floor(wrappedMinutes / 60);
  const newMinutes = wrappedMinutes % 60;
  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(newHours)}:${pad(newMinutes)}`;
}

const targetDateStr = '2026-06-20';
const reminderTimeStr = offsetTime(mealTime, offset); // '08:55'
const reminderUtc = zonedTimeToUtc(`${targetDateStr} ${reminderTimeStr}:00`, clientTimezone);

console.log(`[Timezone Math Test]`);
console.log(`Client Timezone: ${clientTimezone}`);
console.log(`Meal Scheduled Time: ${mealTime}`);
console.log(`Reminder Time Zoned: ${reminderTimeStr} (Offset: ${offset}m)`);
console.log(`Calculated UTC Date: ${reminderUtc.toISOString()}`);

const expectedUtcStr = '2026-06-20T03:25:00.000Z';
if (reminderUtc.toISOString() === expectedUtcStr) {
  console.log(`✅ SUCCESS: Persisted UTC is exactly 03:25 UTC!\n`);
} else {
  console.log(`❌ FAILURE: PERSISTED UTC is ${reminderUtc.toISOString()}, expected ${expectedUtcStr}\n`);
}

// 2. Placeholder Resolution Compiler Check
console.log(`[Message Compiler Test]`);
const mockContext = {
  client: { firstName: 'Dinesh', lastName: 'Bharathi' },
  tenant: { name: 'Aura Wellness Clinic' },
  dietPlan: { title: 'Keto Burn Cleanse' },
  meal: { name: 'Superfood Breakfast', mealTime: '09:00' },
};

const titleTemplate = '🍽️ {{meal_name}} Reminder';
const bodyTemplate = 'Hi {{client_name}},\nYour {{meal_name}} is scheduled in 5 minutes at {{meal_time}} in your local time.\n\nThanks,\n{{clinic_name}}';

const compiledTitle = automationTemplateRegistry.compile(titleTemplate, mockContext);
const compiledBody = automationTemplateRegistry.compile(bodyTemplate, mockContext);

console.log(`Compiled Title: "${compiledTitle}"`);
console.log(`Compiled Message Body:\n"${compiledBody}"\n`);

const expectedTitle = '🍽️ Superfood Breakfast Reminder';
if (compiledTitle === expectedTitle && compiledBody.includes('Dinesh Bharathi') && compiledBody.includes('Aura Wellness Clinic')) {
  console.log(`✅ SUCCESS: Placeholders resolved correctly!\n`);
} else {
  console.log(`❌ FAILURE: Placeholder interpolation failed.\n`);
}

// 3. Strict Variable Validation Checks
console.log(`[Validation Check]`);
import { validateTemplateText } from './src/modules/automation/automation-template-variables.js';

try {
  console.log('Testing valid template variables...');
  validateTemplateText('Hi {{client_name}}, stay consistent.');
  console.log('✅ Valid variables passed.');
} catch (e) {
  console.log('❌ Unexpected failure on valid variables:', e.message);
}

try {
  console.log('Testing invalid template variables...');
  validateTemplateText('Hi {{clientname}}, stay consistent.');
  console.log('❌ Failed: Invalid template variable {{clientname}} was NOT caught.');
} catch (e) {
  console.log(`✅ Expected failure caught: "${e.message}"\n`);
}

try {
  console.log('Testing variables wrapped in HTML tags...');
  validateTemplateText('Hi <strong>{{client_name}}</strong>, stay consistent.');
  validateTemplateText('Hi {{client_<span>name</span>}}, stay consistent.');
  console.log('✅ HTML variables passed.');
} catch (e) {
  console.log('❌ Failed: HTML variables validation failed:', e.message);
}

console.log('--- End Verification ---');

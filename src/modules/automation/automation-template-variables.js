// src/modules/automation/automation-template-variables.js

import logger from '../../utils/logger.js';

export const ALLOWED_VARIABLES = [
  '{{client_name}}',
  '{{meal_name}}',
  '{{meal_time}}',
  '{{diet_plan_name}}',
  '{{clinic_name}}',
  '{{dietitian_name}}',
  '{{meal_items}}',
  '{{meal_quantity}}',
  '{{meal_units}}',
  '{{meal_summary}}',
  '{{water_target_ml}}',
];

export const PLACEHOLDERS_REGISTRY = [
  { key: "{{client_name}}", label: "Client Name", category: "Client", description: "First and last name", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP", "WATER_REMINDER", "WATER_FOLLOWUP", "SLEEP_REMINDER", "SLEEP_FOLLOWUP"] },
  { key: "{{meal_name}}", label: "Meal Name", category: "Meal", description: "e.g., Breakfast", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP"] },
  { key: "{{meal_time}}", label: "Meal Time", category: "Meal", description: "Scheduled hour (e.g. 08:30 AM)", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP"] },
  { key: "{{meal_summary}}", label: "Meal Summary", category: "Meal", description: "List of items in the meal", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP"] },
  { key: "{{meal_items}}", label: "Meal Items (Bullets)", category: "Meal", description: "Detailed bullet-point food items", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP"] },
  { key: "{{meal_quantity}}", label: "Meal Quantities", category: "Meal", description: "Quantities of each item", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP"] },
  { key: "{{meal_units}}", label: "Meal Units", category: "Meal", description: "Unit measurements of items", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP"] },
  { key: "{{clinic_name}}", label: "Clinic Name", category: "Clinic", description: "Your workspace name", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP", "WATER_REMINDER", "WATER_FOLLOWUP", "SLEEP_REMINDER", "SLEEP_FOLLOWUP"] },
  { key: "{{dietitian_name}}", label: "Dietitian Name", category: "Clinic", description: "Assigned dietitian name", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP", "WATER_REMINDER", "WATER_FOLLOWUP", "SLEEP_REMINDER", "SLEEP_FOLLOWUP"] },
  { key: "{{diet_plan_name}}", label: "Diet Plan Name", category: "Automation", description: "Title of active diet plan", supportedTypes: ["MEAL_REMINDER", "MEAL_FOLLOWUP"] },
  { key: "{{water_target_ml}}", label: "Water Daily Target", category: "Water", description: "Daily water target in mL", supportedTypes: ["WATER_REMINDER", "WATER_FOLLOWUP"] }
];

/**
 * Validates template text (subject or body) to ensure all double-curly brace placeholders are registered.
 * Throws an error with details if any invalid placeholder is detected.
 *
 * @param {string} text
 * @throws {Error}
 */
export function validateTemplateText(text) {
  if (!text) return;
  
  // Strip HTML tags before checking placeholders to prevent formatting tags from interfering with validation
  const cleanText = text.replace(/<[^>]*>/g, '');
  
  // Regex to match any {{placeholder_name}} pattern
  const placeholderRegex = /\{\{[^{}]*\}\}/g;
  const matches = cleanText.match(placeholderRegex) || [];
  
  for (const match of matches) {
    if (!ALLOWED_VARIABLES.includes(match)) {
      throw new Error(`Invalid placeholder: "${match}". Only registered placeholders are allowed: ${ALLOWED_VARIABLES.join(', ')}`);
    }
  }
}

export class AutomationTemplateRegistry {
  constructor() {
    this.variables = new Map();
  }

  /**
   * Registers a new template variable with a key and resolver function.
   *
   * @param {string} key
   * @param {function(object): string} resolver
   */
  register(key, resolver) {
    logger.info(`[AUTOMATION] Registered template variable: ${key}`);
    this.variables.set(key, resolver);
  }

  /**
   * Resolves a key using the provided context.
   *
   * @param {string} key
   * @param {object} context
   * @returns {string} Resolved value
   */
  resolve(key, context) {
    const resolver = this.variables.get(key);
    if (!resolver) return '';
    try {
      return resolver(context) || '';
    } catch (err) {
      logger.error(`[AUTOMATION] Error resolving variable ${key}: ${err.message}`);
      return '';
    }
  }

  /**
   * Compiles template text by resolving and replacing all placeholders.
   *
   * @param {string} text - Raw template string
   * @param {object} context - Compilation context
   * @returns {string} Compiled output string
   */
  compile(text, context) {
    if (!text) return '';
    let result = text;
    for (const key of this.variables.keys()) {
      if (result.includes(key)) {
        const val = this.resolve(key, context);
        result = result.split(key).join(val);
      }
    }
    return result;
  }
}

// Instantiate default registry
export const automationTemplateRegistry = new AutomationTemplateRegistry();

function formatItem(it) {
  const q = it.quantity || '';
  const u = it.unit || '';
  const name = it.foodName || '';
  const isSuffix = ['g', 'ml', 'kcal', 'oz', 'mg'].includes(u.toLowerCase());
  if (isSuffix) {
    return `${q}${u} ${name}`.trim();
  }
  return `${q} ${u} ${name}`.replace(/\s+/g, ' ').trim();
}

// Register system default variables
const defaultVariables = [
  {
    key: '{{client_name}}',
    resolver: (ctx) => {
      const client = ctx.client;
      if (!client) return '';
      return `${client.firstName} ${client.lastName}`.trim();
    },
  },
  {
    key: '{{meal_name}}',
    resolver: (ctx) => ctx.meal?.name || '',
  },
  {
    key: '{{meal_time}}',
    resolver: (ctx) => ctx.meal?.mealTime || '',
  },
  {
    key: '{{diet_plan_name}}',
    resolver: (ctx) => ctx.dietPlan?.title || '',
  },
  {
    key: '{{clinic_name}}',
    resolver: (ctx) => ctx.tenant?.name || '',
  },
  {
    key: '{{dietitian_name}}',
    resolver: (ctx) => {
      const dietitian = ctx.dietitian || ctx.client?.dietitian;
      if (dietitian) {
        return `${dietitian.firstName} ${dietitian.lastName}`.trim();
      }
      return '';
    },
  },
  {
    key: '{{meal_items}}',
    resolver: (ctx) => {
      const items = ctx.meal?.items || [];
      return items.map(formatItem).join('\n');
    },
  },
  {
    key: '{{meal_quantity}}',
    resolver: (ctx) => {
      const items = ctx.meal?.items || [];
      return items.map(it => it.quantity || '').filter(Boolean).join(', ');
    },
  },
  {
    key: '{{meal_units}}',
    resolver: (ctx) => {
      const items = ctx.meal?.items || [];
      return items.map(it => it.unit || '').filter(Boolean).join(', ');
    },
  },
  {
    key: '{{meal_summary}}',
    resolver: (ctx) => {
      const items = ctx.meal?.items || [];
      return items.map(formatItem).join(', ');
    },
  },
  {
    key: '{{water_target_ml}}',
    resolver: (ctx) => {
      const tenantConfig = ctx.tenant?.reminderConfig || {};
      const target = tenantConfig.waterDailyTargetMl !== undefined ? tenantConfig.waterDailyTargetMl : 2000;
      return String(target);
    },
  },
];

for (const { key, resolver } of defaultVariables) {
  automationTemplateRegistry.register(key, resolver);
}

export default automationTemplateRegistry;

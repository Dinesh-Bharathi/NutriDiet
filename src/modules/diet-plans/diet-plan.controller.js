// src/modules/diet-plans/diet-plan.controller.js
// Diet plan HTTP adapter endpoints.
import { dietPlanService } from './diet-plan.service.js';
import { mapDietPlan, mapDietPlanList, mapMeal, mapMealItem } from './diet-plan.mapper.js';
import { calendarEngineService } from '../calendar-engine/calendar-engine.service.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const dietPlanController = {
  // ─── Diet Plan Endpoints ───────────────────────────────────────────────────
  async createDietPlan(req, res) {
    const tenantId = req.user.tenantId;
    const creatorId = req.user.userId;
    const { clientId } = req.params;

    const dietPlan = await dietPlanService.createDietPlan(
      tenantId,
      clientId,
      creatorId,
      req.body
    );

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Diet plan created successfully',
      { dietPlan: mapDietPlan(dietPlan) }
    );
  },

  async getClientDietPlans(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await dietPlanService.getClientDietPlans(
      tenantId,
      clientId,
      pagination
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Diet plans retrieved successfully',
      {
        dietPlans: mapDietPlanList(result.dietPlans),
        pagination: result.pagination,
      }
    );
  },

  async getDietPlanById(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    let dietPlan = await dietPlanService.getDietPlanById(tenantId, id);

    if (req.query.date) {
      const targetDate = new Date(req.query.date);
      const resolution = calendarEngineService.resolveCycleDay(dietPlan, targetDate);
      if (resolution.isCycleBased) {
        const resolvedMeals = resolution.cycleDay ? resolution.cycleDay.meals : [];
        dietPlan = {
          ...dietPlan,
          meals: resolvedMeals,
          resolvedCycleDay: resolution.cycleDay ? {
            id: resolution.cycleDay.id,
            dayNumber: resolution.cycleDay.dayNumber,
            dayLabel: resolution.cycleDay.dayLabel,
            description: resolution.cycleDay.description,
            plannedCalories: resolution.cycleDay.plannedCalories,
            plannedProtein: resolution.cycleDay.plannedProtein,
            plannedCarbs: resolution.cycleDay.plannedCarbs,
            plannedFat: resolution.cycleDay.plannedFat,
          } : null,
        };
      }
    }

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Diet plan retrieved successfully',
      { dietPlan: mapDietPlan(dietPlan) }
    );
  },

  async updateDietPlan(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const dietPlan = await dietPlanService.updateDietPlan(
      tenantId,
      id,
      req.body
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Diet plan updated successfully',
      { dietPlan: mapDietPlan(dietPlan) }
    );
  },

  async deleteDietPlan(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    await dietPlanService.deleteDietPlan(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, 'Diet plan deleted successfully');
  },

  // ─── Meal Endpoints ────────────────────────────────────────────────────────
  async createMeal(req, res) {
    const tenantId = req.user.tenantId;
    const { id: dietPlanId } = req.params;

    const meal = await dietPlanService.createMeal(
      tenantId,
      dietPlanId,
      req.body
    );

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Meal created successfully',
      { meal: mapMeal(meal) }
    );
  },

  async updateMeal(req, res) {
    const tenantId = req.user.tenantId;
    const { mealId } = req.params;

    const meal = await dietPlanService.updateMeal(
      tenantId,
      mealId,
      req.body
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Meal updated successfully',
      { meal: mapMeal(meal) }
    );
  },

  async deleteMeal(req, res) {
    const tenantId = req.user.tenantId;
    const { mealId } = req.params;

    await dietPlanService.deleteMeal(tenantId, mealId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Meal deleted successfully');
  },

  // ─── Meal Item Endpoints ───────────────────────────────────────────────────
  async createMealItem(req, res) {
    const tenantId = req.user.tenantId;
    const { mealId } = req.params;

    const item = await dietPlanService.createMealItem(
      tenantId,
      mealId,
      req.body
    );

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Meal item created successfully',
      { mealItem: mapMealItem(item) }
    );
  },

  async updateMealItem(req, res) {
    const tenantId = req.user.tenantId;
    const { itemId } = req.params;

    const item = await dietPlanService.updateMealItem(
      tenantId,
      itemId,
      req.body
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Meal item updated successfully',
      { mealItem: mapMealItem(item) }
    );
  },

  async deleteMealItem(req, res) {
    const tenantId = req.user.tenantId;
    const { itemId } = req.params;

    await dietPlanService.deleteMealItem(tenantId, itemId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Meal item deleted successfully');
  },

  async getDietPlanForDate(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const plan = await calendarEngineService.getPlanForDate(tenantId, clientId, date);
    if (!plan) {
      return sendSuccess(res, HTTP_STATUS.OK, 'No active plan found for this client on the specified date', null);
    }

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Diet plan for date retrieved successfully',
      { dietPlan: mapDietPlan(plan) }
    );
  },
};

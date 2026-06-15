import prisma from "../../lib/prisma.js";
import PdfError from "./pdf-error.js";
import { convertImageUrlToBase64 } from "./compiler/template-compiler.js";
import logger from "../../utils/logger.js";
import { calendarEngineService } from "../calendar-engine/calendar-engine.service.js";

const kgToLbs = (kg) => {
  if (kg === null || kg === undefined || kg === "") return null;
  const val = parseFloat(kg);
  if (isNaN(val)) return null;
  return Math.round(val * 2.20462);
};

const cmToFeetInches = (cm) => {
  if (cm === null || cm === undefined || cm === "") return null;
  const val = parseFloat(cm);
  if (isNaN(val)) return null;
  const totalInches = val * 0.393700787;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}'${inches}"`;
};

const formatWeight = (weightKg, system) => {
  if (weightKg === undefined || weightKg === null) return "N/A";
  if (system === "IMPERIAL") {
    const lbs = kgToLbs(weightKg);
    return lbs !== null ? `${lbs} lbs` : "N/A";
  }
  return `${weightKg} kg`;
};

const formatHeight = (heightCm, system) => {
  if (heightCm === undefined || heightCm === null) return "N/A";
  if (system === "IMPERIAL") {
    const formatted = cmToFeetInches(heightCm);
    return formatted !== null ? formatted : "N/A";
  }
  return `${heightCm} cm`;
};

export const dietPlanDocumentBuilder = {
  /**
   * Builds the DietPlanDocumentContext object from the database.
   *
   * @param {string} tenantId - Tenant identifier
   * @param {string} dietPlanId - Diet plan identifier
   * @param {object} options - Export configuration toggles
   * @returns {Promise<object>} The unified document context
   */
  async buildContext(tenantId, dietPlanId, options = {}) {
    // 1. Fetch Diet Plan with relations
    const dietPlan = await prisma.dietPlan.findFirst({
      where: {
        id: dietPlanId,
        tenantId,
        deletedAt: null,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        goalProfile: true,
        assessment: true,
        meals: {
          orderBy: { mealOrder: "asc" },
          include: {
            items: true,
          },
        },
        cycles: {
          orderBy: { startDay: "asc" },
          include: {
            days: {
              orderBy: { dayNumber: "asc" },
              include: {
                meals: {
                  orderBy: { mealOrder: "asc" },
                  include: {
                    items: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!dietPlan) {
      throw new PdfError(404, "DIET_PLAN_NOT_FOUND", "Diet Plan not found");
    }

    // 2. Fetch Client profile
    const client = await prisma.client.findUnique({
      where: { id: dietPlan.clientId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        dateOfBirth: true,
      },
    });

    if (!client) {
      throw new PdfError(404, "CLIENT_NOT_FOUND", "Client profile not found");
    }

    // 3. Fetch Tenant & branding configs
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
        pdfTemplateConfig: true,
        locale: true,
        timezone: true,
        practiceEmail: true,
        practicePhone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        measurementSystem: true,
      },
    });

    if (!tenant) {
      throw new PdfError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    const config = tenant.pdfTemplateConfig || {};
    const tenantLocale = tenant.locale || "en-US";
    const tenantTimezone = tenant.timezone || "UTC";

    // 4. Asset Loading & Base64 Conversion
    let logoBase64 = null;
    if (config.logoUrl) {
      try {
        logoBase64 = await convertImageUrlToBase64(config.logoUrl);
      } catch (err) {
        logger.error("Failed to load branding logo asset:", err);
      }
    }

    let watermarkBase64 = null;
    if (config.watermarkEnabled && config.watermarkUrl) {
      try {
        watermarkBase64 = await convertImageUrlToBase64(config.watermarkUrl);
      } catch (err) {
        logger.error("Failed to load watermark asset:", err);
      }
    }

    // 5. Calculate Client Metadata
    let clientAge = null;
    let formattedDob = null;
    if (client.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(client.dateOfBirth);
      clientAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        clientAge--;
      }
      formattedDob = new Intl.DateTimeFormat(tenantLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: tenantTimezone,
      }).format(birthDate);
    }

    // Format Goal Profile - active Clinical Profile goal resolution
    let activeGoalProfile = dietPlan.goalProfile;
    if (!activeGoalProfile) {
      activeGoalProfile = await prisma.clientGoalProfile.findFirst({
        where: {
          tenantId,
          clientId: dietPlan.clientId,
          status: "ACTIVE",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    let clientGoal = "N/A";
    if (activeGoalProfile) {
      const goalTypeStr = activeGoalProfile.goalType || "";
      clientGoal = goalTypeStr.replace(/_/g, " ").toLowerCase();
      clientGoal = clientGoal.charAt(0).toUpperCase() + clientGoal.slice(1);
    }

    // Construct clinic address dynamically
    const addressParts = [
      tenant.addressLine1,
      tenant.addressLine2,
      tenant.city,
      tenant.state,
      tenant.country,
      tenant.postalCode
    ].filter(Boolean);
    const clinicAddress = addressParts.length > 0 ? addressParts.join(", ") : (tenant.address || "");

    // Fetch fallback biometrics if the linked assessment doesn't have height/weight
    const clinicalProfile = await prisma.clientClinicalProfile.findFirst({
      where: { tenantId, clientId: dietPlan.clientId, deletedAt: null },
    });
    let latestAnthropometric = null;
    if (clinicalProfile) {
      latestAnthropometric = await prisma.clientAnthropometricRecord.findFirst({
        where: { tenantId, profileId: clinicalProfile.id, deletedAt: null },
        orderBy: { measuredAt: 'desc' },
      });
    }

    // Find latest Assessment for fallback
    const latestAssessment = await prisma.assessment.findFirst({
      where: { tenantId, clientId: dietPlan.clientId, deletedAt: null },
      orderBy: { assessmentDate: 'desc' },
    });

    const heightCm = dietPlan.assessment?.heightCm ?? latestAnthropometric?.heightCm ?? latestAssessment?.heightCm ?? null;
    const weightKg = dietPlan.assessment?.weightKg ?? latestAnthropometric?.weightKg ?? latestAssessment?.weightKg ?? null;

    // Localized document date and generated_at timestamps
    const now = new Date();
    const documentDate = new Intl.DateTimeFormat(tenantLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tenantTimezone,
    }).format(now);

    const generatedAt = new Intl.DateTimeFormat(tenantLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tenantTimezone,
    }).format(now);

    // Generate calendar preview (30 days) and date mappings
    const rawCalendarPreview = await calendarEngineService.getPlanCalendarPreview(tenantId, dietPlanId, 30);
    const calendarPreview = rawCalendarPreview.map((item) => {
      const d = new Date(item.date);
      const formattedDate = new Intl.DateTimeFormat(tenantLocale, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: tenantTimezone,
      }).format(d);

      return {
        date: formattedDate,
        dayLabel: item.dayLabel,
        description: item.description || "",
      };
    });

    const detailedCycleDatesMap = {};
    rawCalendarPreview.forEach((item) => {
      if (!item.dayLabel) return;
      const d = new Date(item.date);
      const formattedDate = new Intl.DateTimeFormat(tenantLocale, {
        month: "short",
        day: "numeric",
        timeZone: tenantTimezone,
      }).format(d);

      if (!detailedCycleDatesMap[item.dayLabel]) {
        detailedCycleDatesMap[item.dayLabel] = [];
      }
      detailedCycleDatesMap[item.dayLabel].push(formattedDate);
    });

    // 6. Build the compilation context
    const authorName = dietPlan.creator
      ? `${dietPlan.creator.firstName} ${dietPlan.creator.lastName}`
      : "Dietitian";

    const compileContext = {
      // Tenant Details
      clinic_name: tenant.name,
      clinic_email: tenant.practiceEmail || tenant.email || "",
      clinic_phone: tenant.practicePhone || tenant.phone || "",
      clinic_address: clinicAddress,

      // Patient/Client Details
      patient_name: `${client.firstName} ${client.lastName}`,
      patient_email: client.email || "N/A",
      patient_phone: client.phone || "N/A",
      patient_dob: formattedDob || "N/A",
      patient_gender: client.gender || "N/A",
      patient_age: clientAge ? String(clientAge) : "N/A",
      patient_height: formatHeight(heightCm, tenant.measurementSystem),
      patient_weight: formatWeight(weightKg, tenant.measurementSystem),
      patient_goal: clientGoal,

      // Document Meta
      document_date: documentDate,
      author_name: authorName,
      document_title: dietPlan.title || "Diet Plan",
      generated_at: generatedAt,

      // Calendar Preview schedule
      calendarPreview,

      // Branding Colors and Sizing
      primaryColor: config.primaryColor || "#1447e6",
      secondaryColor: config.secondaryColor || "#f5f5f5",
      footerPlacement: config.footerPlacement || "EVERY_PAGE",
      logoUrl: logoBase64,
      logoWidth: config.logoWidth ?? 120,
      logoHeight: config.logoHeight ?? 48,
      logoPreserveAspectRatio: config.logoPreserveAspectRatio ?? true,
      watermarkUrl: watermarkBase64,
      watermarkOpacity: config.watermarkOpacity ?? 8,
      watermarkEnabled: config.watermarkEnabled ?? false,

      // Mode settings
      exportMode: options.mode || "SUMMARY",
    };

    // 7. Resolve Signature block placeholder dynamically
    const includeSignature = options.includeSignature !== false;
    compileContext.signatureType = includeSignature ? "LINE" : "NONE";
    compileContext.signatureImageUrl = null;

    // 8. Conditionally include text sections based on configuration toggles
    const getRichText = (field, isIncluded) => {
      if (isIncluded === false) return "";
      return dietPlan[field] || "";
    };

    const mode = options.mode || "SUMMARY";
    const isSummary = mode === "SUMMARY";

    compileContext.plan = {
      title: dietPlan.title,
      description: dietPlan.description || "",
      targetCalories: dietPlan.dailyCalories,
      targetProtein: dietPlan.proteinGrams,
      targetCarbs: dietPlan.carbGrams,
      targetFat: dietPlan.fatGrams,
      actualCalories: dietPlan.totalCalories,
      actualProtein: dietPlan.totalProtein,
      actualCarbs: dietPlan.totalCarbs,
      actualFat: dietPlan.totalFat,

      // Apply Toggles to RichText HTML content
      instructions: getRichText(
        "instructions",
        options.includeInstructions,
      ),
      recommendations: getRichText(
        "recommendations",
        options.includeRecommendations,
      ),
      lifestyleAdvice: getRichText(
        "lifestyleAdvice",
        isSummary ? options.includeLifestyleAdvice : true,
      ),
      hydration: getRichText(
        "hydration",
        isSummary ? options.includeHydration : true,
      ),
      supplementNotes: getRichText(
        "supplementNotes",
        isSummary ? options.includeSupplements : true,
      ),
      mealPrepNotes: getRichText("mealPrepNotes", true),
    };

    // Macro details toggled visibility
    compileContext.showMacroSummary = isSummary
      ? true
      : options.includeMacroSummary !== false;

    // Cycles & Meals formatting
    const includeMeals = isSummary
      ? false
      : options.includeMealBreakdown !== false;
    const includeQuantities = isSummary
      ? false
      : options.includeFoodQuantities !== false;

    compileContext.cycles = dietPlan.cycles.map((cycle) => ({
      name: cycle.name,
      description: cycle.description,
      days: cycle.days
        .filter((day) => day.isActive)
        .map((day) => {
          let actualCalories = 0;
          let actualProtein = 0;
          let actualCarbs = 0;
          let actualFat = 0;

          day.meals.forEach((meal) => {
            meal.items.forEach((item) => {
              actualCalories += item.calories || 0;
              actualProtein += item.protein || 0;
              actualCarbs += item.carbs || 0;
              actualFat += item.fat || 0;
            });
          });

          const activeDates = detailedCycleDatesMap[day.dayLabel] || [];

          return {
            dayNumber: day.dayNumber,
            dayLabel: day.dayLabel,
            description: day.description,
            activeDates: activeDates.join(", "),
            plannedCalories: day.plannedCalories || 0,
            plannedProtein: day.plannedProtein || 0,
            plannedCarbs: day.plannedCarbs || 0,
            plannedFat: day.plannedFat || 0,
            actualCalories: Math.round(actualCalories),
            actualProtein: Math.round(actualProtein * 100) / 100,
            actualCarbs: Math.round(actualCarbs * 100) / 100,
            actualFat: Math.round(actualFat * 100) / 100,
            meals: includeMeals
              ? day.meals.map((meal) => ({
                  name: meal.name,
                  mealTime: meal.mealTime,
                  notes: meal.notes,
                  items: meal.items.map((item) => ({
                    foodName: item.foodName,
                    quantity: includeQuantities ? item.quantity : null,
                    unit: includeQuantities ? item.unit : null,
                    calories: item.calories || 0,
                    protein: item.protein || 0,
                    carbs: item.carbs || 0,
                    fat: item.fat || 0,
                    notes: item.notes,
                  })),
                }))
              : [],
          };
        }),
    }));

    // Static meals (non-cycle based) if not using cycles
    compileContext.meals =
      !compileContext.cycles.length && includeMeals
        ? dietPlan.meals.map((meal) => ({
            name: meal.name,
            mealTime: meal.mealTime,
            notes: meal.notes,
            items: meal.items.map((item) => ({
              foodName: item.foodName,
              quantity: includeQuantities ? item.quantity : null,
              unit: includeQuantities ? item.unit : null,
              calories: item.calories || 0,
              protein: item.protein || 0,
              carbs: item.carbs || 0,
              fat: item.fat || 0,
              notes: item.notes,
            })),
          }))
        : [];

    return compileContext;
  },
};

/**
 * Generates the HTML content for the DETAILED export mode.
 * Returns an array of HTML strings, each corresponding to an A4 page body.
 * Every day in the cycle is generated as its own page.
 *
 * @param {object} context - Compilation context containing patient, clinic, plan, and cycle data
 * @returns {string[]} Array of page HTML strings
 */
export function getDetailedPages(context) {
  const {
    plan,
    cycles,
    meals,
    primaryColor,
    secondaryColor,
    showMacroSummary,
  } = context;

  const hasContent = (html) => {
    if (!html) return false;
    const text = html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, "")
      .trim();
    return text.length > 0;
  };

  const formatVal = (val, suffix = "") =>
    val !== null && val !== undefined ? `${val}${suffix}` : "N/A";

  // Page 1: Title, description, Macros card, Instructions, and Recommendations
  let page1Html = `
    <div style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid ${primaryColor};">
      <h1 style="margin: 0 0 4px 0; font-size: 20px; color: ${primaryColor}; font-weight: 700; text-transform: uppercase;">
        ${plan.title || "Personalized Diet Plan"}
      </h1>
      <p style="margin: 0; font-size: 11px; color: #64748b; font-style: italic;">
        ${plan.description || "Tailored nutritional guidelines and meal programming."}
      </p>
    </div>
  `;

  // Macro Summary Card (Single-row layout)
  if (showMacroSummary) {
    page1Html += `
      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 13px; font-weight: 700; color: ${primaryColor}; margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; text-transform: uppercase;">
          Daily Macro Nutrient Targets
        </h2>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
          <!-- Calories -->
          <div style="flex: 1; text-align: center; border-right: 1px solid #e2e8f0; padding: 4px 0;">
            <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Calories</div>
            <div style="font-size: 14px; font-weight: 700; color: ${primaryColor}; margin: 2px 0;">${formatVal(plan.targetCalories, " kcal")}</div>
            <div style="font-size: 8px; color: #94a3b8;">Planned: ${formatVal(plan.actualCalories, " kcal")}</div>
          </div>
          <!-- Protein -->
          <div style="flex: 1; text-align: center; border-right: 1px solid #e2e8f0; padding: 4px 0;">
            <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Protein</div>
            <div style="font-size: 14px; font-weight: 700; color: #0284c7; margin: 2px 0;">${formatVal(plan.targetProtein, "g")}</div>
            <div style="font-size: 8px; color: #94a3b8;">Planned: ${formatVal(plan.actualProtein, "g")}</div>
          </div>
          <!-- Carbs -->
          <div style="flex: 1; text-align: center; border-right: 1px solid #e2e8f0; padding: 4px 0;">
            <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Carbohydrates</div>
            <div style="font-size: 14px; font-weight: 700; color: #ea580c; margin: 2px 0;">${formatVal(plan.targetCarbs, "g")}</div>
            <div style="font-size: 8px; color: #94a3b8;">Planned: ${formatVal(plan.actualCarbs, "g")}</div>
          </div>
          <!-- Fat -->
          <div style="flex: 1; text-align: center; padding: 4px 0;">
            <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Fat</div>
            <div style="font-size: 14px; font-weight: 700; color: #16a34a; margin: 2px 0;">${formatVal(plan.targetFat, "g")}</div>
            <div style="font-size: 8px; color: #94a3b8;">Planned: ${formatVal(plan.actualFat, "g")}</div>
          </div>
        </div>
      </div>
    `;
  }

  const estimateTextLength = (html) => {
    if (!html) return 0;
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length;
  };

  const sections = [
    { title: "GENERAL INSTRUCTIONS", content: plan.instructions },
    { title: "DIETARY RECOMMENDATIONS", content: plan.recommendations },
    { title: "LIFESTYLE &amp; HABIT ADVICE", content: plan.lifestyleAdvice },
    { title: "HYDRATION TARGET &amp; GUIDELINES", content: plan.hydration },
    { title: "SUPPLEMENT NOTES", content: plan.supplementNotes },
    { title: "FOOD PREP &amp; PLANNING GUIDANCE", content: plan.mealPrepNotes },
  ].filter((s) => hasContent(s.content));

  const pages = [];
  let currentPageHtml = page1Html;
  let currentTextLength = estimateTextLength(currentPageHtml);
  let isFirstPage = true;
  let pageHasSections = false;

  sections.forEach((sec) => {
    const secHtml = `
      <div class="guidance-section" style="margin-bottom: 20px; height: auto;">
        <h2 style="font-size: 12px; font-weight: 700; color: ${primaryColor}; margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; text-transform: uppercase; page-break-after: avoid; break-after: avoid;">
          ${sec.title}
        </h2>
        <div class="rich-text-content" style="font-size: 10px; line-height: 1.5; color: #334155;">
          ${sec.content}
        </div>
      </div>
    `;

    const secTextLength = estimateTextLength(secHtml);
    const pageTextLimit = isFirstPage ? (showMacroSummary ? 1500 : 3000) : 4000;

    if (currentTextLength > 0 && currentTextLength + secTextLength > pageTextLimit) {
      pages.push(currentPageHtml);
      currentPageHtml = secHtml;
      currentTextLength = secTextLength;
      isFirstPage = false;
      pageHasSections = true;
    } else {
      if (pageHasSections) {
        currentPageHtml += `<div style="height: 16px;"></div>` + secHtml;
      } else {
        currentPageHtml += secHtml;
      }
      currentTextLength += secTextLength;
      pageHasSections = true;
    }
  });

  if (currentPageHtml.trim()) {
    pages.push(currentPageHtml);
  }

  // Page 3+: Day-by-Day Meal Breakdown (each day gets its own page)
  if (cycles && cycles.length > 0) {
    cycles.forEach((cycle) => {
      cycle.days.forEach((day) => {
        let dayHtml = `
          <div style="margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid ${primaryColor}; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: ${primaryColor}; border-bottom: none; padding-bottom: 0; text-transform: uppercase;">
                ${cycle.name}: ${day.dayLabel}
              </h2>
              ${
                day.activeDates
                  ? `<p style="margin: 2px 0 0 0; font-size: 9px; color: #0284c7; font-weight: 600;">Active Dates: ${day.activeDates}</p>`
                  : `<p style="margin: 2px 0 0 0; font-size: 9px; color: #64748b; font-style: italic;">Day ${day.dayNumber} - Complete Meal Schedule</p>`
              }
            </div>
            <!-- Daily target macros -->
            <div style="text-align: right; font-size: 9px; color: #334155; font-weight: 500; background: ${secondaryColor}; padding: 6px 10px; border-radius: 4px;">
              Planned Day Macros: 
              <strong>${day.actualCalories} kcal</strong> | 
              P: <strong>${day.actualProtein}g</strong> | 
              C: <strong>${day.actualCarbs}g</strong> | 
              F: <strong>${day.actualFat}g</strong>
            </div>
          </div>
        `;

        if (day.description) {
          dayHtml += `<p style="font-size: 10px; color: #64748b; font-style: italic; margin: 0 0 12px 0;">${day.description}</p>`;
        }

        if (day.meals && day.meals.length > 0) {
          day.meals.forEach((meal) => {
            let mealTimeStr = meal.mealTime ? ` (${meal.mealTime})` : "";
            dayHtml += `
              <div style="margin-bottom: 16px; page-break-inside: avoid;">
                <h3 style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; text-transform: uppercase; background: #f8fafc; padding: 4px 6px; border-left: 3px solid ${primaryColor};">
                  ${meal.name.replace(/_/g, " ")}${mealTimeStr}
                </h3>
            `;

            if (meal.notes) {
              dayHtml += `<p style="font-size: 9px; color: #64748b; margin: 0 0 6px 0; font-style: italic;">Note: ${meal.notes}</p>`;
            }

            if (meal.items && meal.items.length > 0) {
              dayHtml += `
                <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 8px;">
                  <thead>
                    <tr style="background-color: ${primaryColor}; color: white; text-align: left;">
                      <th style="padding: 4px 6px; width: 45%;">Food / Ingredient</th>
                      <th style="padding: 4px 6px; text-align: center; width: 15%;">Quantity</th>
                      <th style="padding: 4px 6px; text-align: center; width: 10%;">Calories</th>
                      <th style="padding: 4px 6px; text-align: center; width: 10%;">Protein</th>
                      <th style="padding: 4px 6px; text-align: center; width: 10%;">Carbs</th>
                      <th style="padding: 4px 6px; text-align: center; width: 10%;">Fat</th>
                    </tr>
                  </thead>
                  <tbody>
              `;

              meal.items.forEach((item, index) => {
                const quantityStr = item.quantity
                  ? `${item.quantity} ${item.unit || ""}`
                  : "N/A";
                dayHtml += `
                  <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 4px 6px; font-weight: bold; color: #1e293b;">
                      ${item.foodName}
                      ${item.notes ? `<div style="font-size: 8px; color: #64748b; font-weight: normal; margin-top: 2px;">Note: ${item.notes}</div>` : ""}
                    </td>
                    <td style="padding: 4px 6px; text-align: center;">${quantityStr}</td>
                    <td style="padding: 4px 6px; text-align: center;">${formatVal(item.calories, " kcal")}</td>
                    <td style="padding: 4px 6px; text-align: center;">${formatVal(item.protein, "g")}</td>
                    <td style="padding: 4px 6px; text-align: center;">${formatVal(item.carbs, "g")}</td>
                    <td style="padding: 4px 6px; text-align: center;">${formatVal(item.fat, "g")}</td>
                  </tr>
                `;
              });

              dayHtml += `
                  </tbody>
                </table>
              `;
            } else {
              dayHtml += `<p style="font-size: 9px; color: #94a3b8; font-style: italic; margin: 4px 6px;">No food items planned for this meal.</p>`;
            }

            dayHtml += `</div>`;
          });
        } else {
          dayHtml += ``;
        }

        pages.push(dayHtml);
      });
    });
  } else if (meals && meals.length > 0) {
    // If no cycles exist but static meals exist, render static meals on Page 3
    let staticDayHtml = `
      <div style="margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid ${primaryColor};">
        <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: ${primaryColor}; border-bottom: none; padding-bottom: 0; text-transform: uppercase;">
          Plan Meal Schedule
        </h2>
      </div>
    `;

    meals.forEach((meal) => {
      let mealTimeStr = meal.mealTime ? ` (${meal.mealTime})` : "";
      staticDayHtml += `
        <div style="margin-bottom: 16px; page-break-inside: avoid;">
          <h3 style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; text-transform: uppercase; background: #f8fafc; padding: 4px 6px; border-left: 3px solid ${primaryColor};">
            ${meal.name.replace(/_/g, " ")}${mealTimeStr}
          </h3>
      `;

      if (meal.notes) {
        staticDayHtml += `<p style="font-size: 9px; color: #64748b; margin: 0 0 6px 0; font-style: italic;">Note: ${meal.notes}</p>`;
      }

      if (meal.items && meal.items.length > 0) {
        staticDayHtml += `
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 8px;">
            <thead>
              <tr style="background-color: ${primaryColor}; color: white; text-align: left;">
                <th style="padding: 4px 6px; width: 45%;">Food / Ingredient</th>
                <th style="padding: 4px 6px; text-align: center; width: 15%;">Quantity</th>
                <th style="padding: 4px 6px; text-align: center; width: 10%;">Calories</th>
                <th style="padding: 4px 6px; text-align: center; width: 10%;">Protein</th>
                <th style="padding: 4px 6px; text-align: center; width: 10%;">Carbs</th>
                <th style="padding: 4px 6px; text-align: center; width: 10%;">Fat</th>
              </tr>
            </thead>
            <tbody>
        `;

        meal.items.forEach((item, index) => {
          const quantityStr = item.quantity
            ? `${item.quantity} ${item.unit || ""}`
            : "N/A";
          staticDayHtml += `
            <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 4px 6px; font-weight: bold; color: #1e293b;">
                ${item.foodName}
                ${item.notes ? `<div style="font-size: 8px; color: #64748b; font-weight: normal; margin-top: 2px;">Note: ${item.notes}</div>` : ""}
              </td>
              <td style="padding: 4px 6px; text-align: center;">${quantityStr}</td>
              <td style="padding: 4px 6px; text-align: center;">${formatVal(item.calories, " kcal")}</td>
              <td style="padding: 4px 6px; text-align: center;">${formatVal(item.protein, "g")}</td>
              <td style="padding: 4px 6px; text-align: center;">${formatVal(item.carbs, "g")}</td>
              <td style="padding: 4px 6px; text-align: center;">${formatVal(item.fat, "g")}</td>
            </tr>
          `;
        });

        staticDayHtml += `
            </tbody>
          </table>
        `;
      }

      staticDayHtml += `</div>`;
    });

    pages.push(staticDayHtml);
  }

  return pages;
}

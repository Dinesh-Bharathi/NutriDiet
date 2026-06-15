/**
 * Generates the HTML content for the SUMMARY export mode.
 * Returns an array of HTML strings, each corresponding to an A4 page body.
 *
 * @param {object} context - Compilation context containing patient, clinic, plan, and cycle data
 * @returns {string[]} Array of page HTML strings
 */
export function getSummaryPages(context) {
  const { plan, primaryColor, secondaryColor, showMacroSummary, calendarPreview } = context;

  // Helper to check if rich text block has actual content
  const hasContent = (html) => {
    if (!html) return false;
    const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim();
    return text.length > 0;
  };

  // Helper to format macro values
  const formatVal = (val, suffix = "") => (val !== null && val !== undefined ? `${val}${suffix}` : "N/A");

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

  // 30-Day Calendar Preview table — kept as a separate page because it can be long
  if (calendarPreview && calendarPreview.length > 0) {
    let calendarHtml = `
      <div style="margin-bottom: 20px; height: auto;">
        <h2 style="font-size: 12px; font-weight: 700; color: ${primaryColor}; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; text-transform: uppercase;">
          Dietary Calendar Schedule (30-Day Outlook)
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
          <thead>
            <tr style="background-color: ${primaryColor}; color: white; text-align: left; font-size: 9px;">
              <th style="padding: 6px; border: 1px solid #cbd5e1; width: 25%;">Date</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1; width: 25%;">Cycle Day</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Description</th>
            </tr>
          </thead>
          <tbody>
    `;

    calendarPreview.forEach((item) => {
      calendarHtml += `
        <tr style="background: #ffffff;">
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${item.date}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${item.dayLabel}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${item.description || "—"}</td>
        </tr>
      `;
    });

    calendarHtml += `
          </tbody>
        </table>
      </div>
    `;
    pages.push(calendarHtml);
  }

  return pages;
}

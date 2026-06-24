import fs from "fs";
import path from "path";
import prisma from "./src/lib/prisma.js";
import { pdfService } from "./src/modules/pdf/pdf.service.js";
import { compileContent, compileHtmlDocument } from "./src/modules/pdf/compiler/template-compiler.js";
import { getDetailedPages } from "./src/modules/pdf/templates/detailed-template.js";
import { getSummaryPages } from "./src/modules/pdf/templates/summary-template.js";

async function run() {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { name: "NutriDiet" }
    });

    if (!tenant) {
      console.log("FitLife Nutrition tenant not found.");
      return;
    }

    const dietPlan = await prisma.dietPlan.findFirst({
      where: { tenantId: tenant.id, deletedAt: null },
      include: { creator: true }
    });

    if (!dietPlan) {
      console.log("No diet plan found for FitLife Nutrition.");
      return;
    }

    console.log(`Found diet plan: ${dietPlan.title} (${dietPlan.id}) for tenant: ${dietPlan.tenantId}`);

    const compileContext = await import("./src/modules/pdf/diet-plan-document.builder.js")
      .then(m => m.dietPlanDocumentBuilder.buildContext(tenant.id, dietPlan.id, { mode: "DETAILED", includeSignature: true }));

    const { DEFAULT_PDF_TEMPLATE_CONFIG } = await import("./src/modules/pdf/pdf-template.defaults.js");
    const config = tenant.pdfTemplateConfig || DEFAULT_PDF_TEMPLATE_CONFIG;
    const compiledHeader = compileContent(config.headerContent, compileContext);
    const compiledFooter = compileContent(config.footerContent, compileContext);

    const rawPages = getDetailedPages(compileContext);
    const compiledPages = rawPages.map((pageHtml) =>
      compileContent({ mode: "source", content: pageHtml }, compileContext)
    );

    const finalHtml = compileHtmlDocument({
      compiledHeader,
      compiledFooter,
      bodyPagesHtml: compiledPages,
      context: compileContext,
    });

    fs.writeFileSync("./test-diet-plan-fitlife.html", finalHtml);
    console.log("Saved HTML to: ./test-diet-plan-fitlife.html");

    const pdfBuffer = await pdfService.generateDietPlanPdf(tenant.id, dietPlan.id, {
      mode: "DETAILED",
      includeSignature: true,
    });
    fs.writeFileSync("./test-diet-plan-fitlife.pdf", pdfBuffer);
    console.log("Saved PDF to: ./test-diet-plan-fitlife.pdf");

  } catch (err) {
    console.error("Error generating PDF:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();

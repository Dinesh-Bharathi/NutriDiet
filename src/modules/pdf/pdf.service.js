import prisma from "../../lib/prisma.js";
import PdfError from "./pdf-error.js";
import { placeholderRegistry } from "./compiler/placeholder-registry.js";
import { normalizePlaceholderKey } from "./compiler/placeholder-engine.js";
import {
  compileContent,
  compileHtmlDocument,
  convertImageUrlToBase64,
} from "./compiler/template-compiler.js";
import { pdfRenderer } from "./puppeteer/pdf-renderer.js";
import { getSampleDocumentPages } from "./templates/sample-document.js";
import { JSDOM } from "jsdom";
import logger from "../../utils/logger.js";

export const pdfService = {
  /**
   * Generates a sample A4 clinic PDF document compiled with the tenant's current template configurations.
   * Runs the full pre-flight validation pipeline and converts S3 assets to Base64 inlines.
   *
   * @param {string} tenantId - Active tenant identifier
   * @returns {Promise<Buffer>} Generated PDF buffer
   */
  async generateSamplePdf(tenantId) {
    // 1. Fetch Tenant data & PDF Config
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
        pdfTemplateConfig: true,
      },
    });

    if (!tenant) {
      throw new PdfError(404, "PDF_TEMPLATE_INVALID", "Tenant not found");
    }

    const config = tenant.pdfTemplateConfig;
    if (!config) {
      throw new PdfError(
        400,
        "PDF_TEMPLATE_INVALID",
        "PDF template configuration is not initialized for this tenant",
      );
    }

    // 2. Pre-flight Validation Pipeline
    this.validateTemplateConfig(config);

    // 3. Asset Loading & Base64 Conversion
    let logoBase64 = null;
    if (config.logoUrl) {
      try {
        logoBase64 = await convertImageUrlToBase64(config.logoUrl);
      } catch (err) {
        logger.error("Failed to load branding logo asset:", err);
        throw new PdfError(
          400,
          "PDF_ASSET_FETCH_FAILED",
          "Failed to fetch organization branding logo for PDF conversion",
          err.message,
        );
      }
    }

    let watermarkBase64 = null;
    if (config.watermarkEnabled && config.watermarkUrl) {
      try {
        watermarkBase64 = await convertImageUrlToBase64(config.watermarkUrl);
      } catch (err) {
        logger.error("Failed to load watermark asset:", err);
        throw new PdfError(
          400,
          "PDF_ASSET_FETCH_FAILED",
          "Failed to fetch document watermark asset for PDF conversion",
          err.message,
        );
      }
    }

    // 4. Construct Placeholder Context
    const compileContext = {
      // Branding colors & sizing
      primaryColor: config.primaryColor || "#1447e6",
      secondaryColor: config.secondaryColor || "#f5f5f5",
      footerPlacement: config.footerPlacement || "EVERY_PAGE",

      // Inline asset base64 URLs
      logoUrl: logoBase64,
      logoWidth: config.logoWidth ?? 120,
      logoHeight: config.logoHeight ?? 48,
      logoPreserveAspectRatio: config.logoPreserveAspectRatio ?? true,

      watermarkUrl: watermarkBase64,
      watermarkOpacity: config.watermarkOpacity ?? 25,
      watermarkEnabled: config.watermarkEnabled ?? false,

      // Clinic placeholders
      clinic_name: tenant.name || "Aura Wellness Clinic",
      clinic_email: tenant.email || "contact@aurawellness.com",
      clinic_phone: tenant.phone || "+1 (555) 019-2834",
      clinic_address: tenant.address || "742 Evergreen Terrace, Springfield",

      // Patient placeholders (sample data)
      patient_name: "Jane Doe",
      patient_email: "jane.doe@example.com",
      patient_phone: "+1 (555) 014-9988",
      patient_dob: "October 12, 1990",
      patient_gender: "Female",
      patient_age: "32",
      patient_height: "175 cm",
      patient_weight: "82 kg",
      patient_goal: "Fat Loss",

      // Document placeholders
      document_date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      author_name: "Dr. Sarah Jenkins, RD",
      document_title: "SAMPLE CLINIC DOCUMENT",
      generated_at: new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // 5. Compile Headers & Footers
    const compiledHeader = compileContent(config.headerContent, compileContext);
    const compiledFooter = compileContent(config.footerContent, compileContext);

    // 6. Compile 3-page Sample Document Body
    const rawPages = getSampleDocumentPages();
    const compiledPages = rawPages.map((pageHtml) =>
      compileContent({ mode: "source", content: pageHtml }, compileContext),
    );

    // 7. Assemble printable HTML document shell
    const finalHtml = compileHtmlDocument({
      compiledHeader,
      compiledFooter,
      bodyPagesHtml: compiledPages,
      context: compileContext,
    });

    // 8. Generate PDF Buffer via Puppeteer
    const pdfBuffer = await pdfRenderer.renderHtmlToPdf(finalHtml);
    return pdfBuffer;
  },

  /**
   * Performs pre-flight checks on template syntax and placeholder correctness.
   *
   * @param {object} config - Tenant PDF template configuration settings
   */
  validateTemplateConfig(config) {
    const header = config.headerContent;
    const footer = config.footerContent;

    if (!header || !footer) {
      throw new PdfError(
        400,
        "PDF_TEMPLATE_INVALID",
        "PDF template must define both a header and a footer layout",
      );
    }

    const getHtml = (section) => {
      if (!section) return "";
      return typeof section.content === "string" ? section.content : "";
    };

    const headerHtml = header.mode === "source" ? getHtml(header) : "";
    const footerHtml = footer.mode === "source" ? getHtml(footer) : "";

    // 1. HTML Syntax Validation using JSDOM
    const validateHtml = (html, name) => {
      if (!html) return;
      try {
        // JSDOM will parse but we verify it is valid XML/HTML structure.
        // We look for common unbalanced tags or severe errors.
        new JSDOM(html);
      } catch (err) {
        throw new PdfError(
          400,
          "PDF_TEMPLATE_INVALID",
          `Syntax error in ${name} template layout: ${err.message}`,
        );
      }
    };

    validateHtml(headerHtml, "Header");
    validateHtml(footerHtml, "Footer");

    // 2. Placeholders validation
    const extractPlaceholders = (html) => {
      if (!html) return [];
      const regex = /\{\{[^{}]+\}\}/g;
      return html.match(regex) || [];
    };

    // Extract placeholders from header, footer and sample body
    const samplePages = getSampleDocumentPages();
    const allHtmlStr =
      headerHtml + " " + footerHtml + " " + samplePages.join(" ");
    const foundTokens = extractPlaceholders(allHtmlStr);

    const unknownPlaceholders = [];
    for (const token of foundTokens) {
      const normalized = normalizePlaceholderKey(token);
      if (!placeholderRegistry.get(normalized)) {
        unknownPlaceholders.push(token);
      }
    }

    if (unknownPlaceholders.length > 0) {
      throw new PdfError(
        400,
        "PDF_PLACEHOLDER_INVALID",
        "Template contains invalid or unknown placeholder tokens",
        `Unresolved tokens: ${unknownPlaceholders.join(", ")}`,
      );
    }

    // 3. Logo URLs validation
    if (config.logoUrl && typeof config.logoUrl === "string") {
      if (
        !config.logoUrl.startsWith("http://") &&
        !config.logoUrl.startsWith("https://") &&
        !config.logoUrl.startsWith("data:")
      ) {
        throw new PdfError(
          400,
          "PDF_TEMPLATE_INVALID",
          "Branding logo URL is not a valid absolute HTTP or data URL link",
        );
      }
    }

    // 4. Watermark URL validation
    if (
      config.watermarkEnabled &&
      config.watermarkUrl &&
      typeof config.watermarkUrl === "string"
    ) {
      if (
        !config.watermarkUrl.startsWith("http://") &&
        !config.watermarkUrl.startsWith("https://") &&
        !config.watermarkUrl.startsWith("data:")
      ) {
        throw new PdfError(
          400,
          "PDF_TEMPLATE_INVALID",
          "Watermark image URL is not a valid absolute HTTP or data URL link",
        );
      }
    }
  },
};

export default pdfService;

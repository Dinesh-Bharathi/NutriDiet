import { pdfService } from "./pdf.service.js";
import { browserManager } from "./puppeteer/browser-manager.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../config/constants.js";
import PdfError from "./pdf-error.js";

export const pdfController = {
  /**
   * POST /api/v1/pdf/sample
   * Generates and downloads the 3-page template validation PDF.
   * Ensures request contract matches { "documentType": "sample" }.
   */
  async generateSamplePdf(req, res) {
    const { documentType } = req.body;

    if (!documentType) {
      throw new PdfError(
        400,
        "PDF_TEMPLATE_INVALID",
        "Document type is required in the request payload",
        "Missing field: 'documentType'"
      );
    }

    if (documentType !== "sample") {
      throw new PdfError(
        400,
        "PDF_TEMPLATE_INVALID",
        `Unsupported document type requested: '${documentType}'`,
        "This endpoint currently supports: 'sample'"
      );
    }

    const tenantId = req.user.tenantId;
    const pdfBuffer = await pdfService.generateSamplePdf(tenantId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="sample-template-preview.pdf"'
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.send(pdfBuffer);
  },

  /**
   * POST /api/v1/pdf/diet-plans/:id
   * Generates and downloads the PDF version of a client diet plan.
   */
  async generateDietPlanPdf(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const options = req.body || {};

    const pdfBuffer = await pdfService.generateDietPlanPdf(tenantId, id, options);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="diet-plan-${id}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.send(pdfBuffer);
  },

  /**
   * GET /api/v1/pdf/health
   * Performs quick diagnostic check on browser running status.
   */
  async getHealth(req, res) {
    const isRunning = browserManager.isBrowserRunning();
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "PDF rendering engine status checked successfully",
      {
        status: "ok",
        browserRunning: isRunning,
      }
    );
  },
};

export default pdfController;

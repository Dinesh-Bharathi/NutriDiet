import { browserManager } from "./browser-manager.js";
import logger from "../../../utils/logger.js";
import PdfError from "../pdf-error.js";

export const pdfRenderer = {
  /**
   * Renders a fully compiled HTML document string into a PDF buffer.
   *
   * @param {string} htmlContent - Fully built HTML shell
   * @param {object} [options={}] - Optional layout parameters
   * @returns {Promise<Buffer>}
   */
  async renderHtmlToPdf(htmlContent, options = {}) {
    let page = null;
    try {
      const browser = await browserManager.getBrowser();
      page = await browser.newPage();

      // Ensure viewport is set to a reasonable desktop size for media queries
      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 1,
      });

      // Inject HTML content and wait for it to be fully parsed and external resources loaded
      await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
        timeout: options.timeout || 30000,
      });

      // Generate the PDF buffer with A4 size layout
      // margins are set to 0 because document padding is handled natively within HTML
      // CSS styles page containers to maintain 100% preview layout parity.
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "0mm",
          right: "0mm",
          bottom: "0mm",
          left: "0mm",
        },
        preferCSSPageSize: true,
      });

      // Convert Uint8Array to Node.js Buffer to prevent Express from serializing it as JSON
      return Buffer.from(pdfBuffer);
    } catch (err) {
      logger.error("Puppeteer PDF generation failed:", {
        error: err.message,
        stack: err.stack,
      });
      throw new PdfError(
        500,
        "PDF_RENDER_FAILED",
        "Failed to render HTML template to PDF document",
        err.message
      );
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (closeErr) {
          logger.error("Failed to close page in PDF renderer:", closeErr);
        }
      }
    }
  },
};

export default pdfRenderer;

import puppeteer from "puppeteer";
import logger from "../../../utils/logger.js";
import PdfError from "../pdf-error.js";

let browser = null;
let isInitializing = false;

export const browserManager = {
  /**
   * Lazily initializes and returns the singleton Puppeteer browser instance.
   * Employs concurrency locks to prevent race conditions during cold starts.
   *
   * @returns {Promise<import('puppeteer').Browser>}
   */
  async getBrowser() {
    if (browser) {
      return browser;
    }

    // Lock to prevent concurrent requests from launching duplicate instances
    if (isInitializing) {
      logger.info("Puppeteer browser launch in progress. Waiting for lock...");
      while (isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (browser) return browser;
    }

    isInitializing = true;
    try {
      logger.info("Initializing singleton Puppeteer browser instance (lazy)...");
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
      logger.info("Puppeteer browser launched successfully.");
      return browser;
    } catch (err) {
      logger.error("Failed to launch Puppeteer browser instance:", {
        error: err.message,
        stack: err.stack,
      });
      throw new PdfError(
        500,
        "PDF_BROWSER_UNAVAILABLE",
        "PDF rendering engine browser failed to initialize",
        err.message
      );
    } finally {
      isInitializing = false;
    }
  },

  /**
   * Helper to check if Puppeteer is currently running.
   * Used by the health endpoint without triggering a cold start.
   *
   * @returns {boolean}
   */
  isBrowserRunning() {
    return !!browser;
  },

  /**
   * Cleanly closes the active Puppeteer browser instance.
   * Triggered on application shutdown hooks.
   */
  async shutdown() {
    if (browser) {
      try {
        logger.info("Shutting down active Puppeteer browser instance...");
        await browser.close();
        browser = null;
        logger.info("Puppeteer browser instance shutdown completed.");
      } catch (err) {
        logger.error("Error encountered while shutting down browser instance:", {
          error: err.message,
        });
      }
    }
  },
};

export default browserManager;

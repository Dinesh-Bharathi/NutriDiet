import ApiError from "../../utils/ApiError.js";

/**
 * Custom error class for PDF-specific failures.
 * Structures error detail arrays with readable error codes for client parsing.
 */
export class PdfError extends ApiError {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} code - PDF structured error category
   * @param {string} message - Descriptive error message
   * @param {string|object} [details=null] - Fine-grained crash details or diagnostics
   */
  constructor(statusCode, code, message, details = null) {
    const errorDetail = { code };
    if (details) {
      errorDetail.details = details;
    }
    super(statusCode, message, [errorDetail]);
    this.name = "PdfError";
    this.code = code;
    this.details = details;
  }
}

export default PdfError;

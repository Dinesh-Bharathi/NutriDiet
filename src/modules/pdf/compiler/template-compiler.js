import axios from "axios";
import logger from "../../../utils/logger.js";
import { placeholderEngine } from "./placeholder-engine.js";

/**
 * Whitelist of safe CSS property names for inline styles (used during compilation).
 */
const ALLOWED_STYLE_PROPERTIES = new Set([
  "display",
  "flex",
  "flex-direction",
  "flex-wrap",
  "flex-flow",
  "justify-content",
  "align-items",
  "align-content",
  "align-self",
  "order",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "gap",
  "column-gap",
  "row-gap",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "text-align",
  "font-size",
  "font-weight",
  "font-family",
  "font-style",
  "color",
  "background-color",
  "background",
  "line-height",
  "letter-spacing",
  "text-decoration",
  "text-transform",
  "box-sizing",
  "overflow",
  "object-fit",
  "vertical-align",
  "page-break-inside",
  "break-inside",
  "page-break-after",
  "break-after",
  "page-break-before",
  "break-before",
]);

/**
 * Sanitizes an inline style string using the property whitelist.
 */
function sanitizeStyleString(styleStr) {
  if (!styleStr) return "";

  const declarations = styleStr.split(";");
  const cleanDeclarations = [];

  for (const decl of declarations) {
    if (!decl.trim()) continue;
    const colonIdx = decl.indexOf(":");
    if (colonIdx === -1) continue;

    const prop = decl.substring(0, colonIdx).trim().toLowerCase();
    const val = decl.substring(colonIdx + 1).trim();

    if (ALLOWED_STYLE_PROPERTIES.has(prop)) {
      const lowVal = val.toLowerCase();
      if (
        lowVal.includes("javascript:") ||
        lowVal.includes("expression(") ||
        lowVal.includes("behaviour(")
      ) {
        continue;
      }
      cleanDeclarations.push(`${prop}: ${val}`);
    }
  }

  return cleanDeclarations.join("; ");
}

/**
 * Merges style and class attributes from a TipTap node into an HTML attribute string.
 */
function compileAttrs(node) {
  if (!node || !node.attrs) return "";

  let style = node.attrs.style || "";
  const className = node.attrs.class || "";

  if (node.attrs.textAlign) {
    if (style && !style.endsWith(";")) {
      style += ";";
    }
    style += ` text-align: ${node.attrs.textAlign};`;
  }

  const cleanStyle = sanitizeStyleString(style);
  const styleAttr = cleanStyle ? ` style="${cleanStyle}"` : "";

  let classAttr = "";
  if (className) {
    const classNames = className.split(/\s+/);
    const cleanClassNames = classNames.filter((cls) =>
      /^[a-zA-Z0-9_-]+$/.test(cls)
    );
    if (cleanClassNames.length > 0) {
      classAttr = ` class="${cleanClassNames.join(" ")}"`;
    }
  }

  return `${styleAttr}${classAttr}`;
}

/**
 * Converts a TipTap JSON node structure recursively into HTML strings.
 * Replicates client-side TipTap conversion exactly.
 *
 * @param {object | object[]} node - TipTap JSON node
 * @returns {string} HTML representation
 */
export function tipTapJsonToHtml(node) {
  if (!node) return "";

  if (Array.isArray(node)) {
    return node.map(tipTapJsonToHtml).join("");
  }

  if (node.type === "text") {
    let text = node.text || "";

    text = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "bold") {
          text = `<strong>${text}</strong>`;
        } else if (mark.type === "italic") {
          text = `<em>${text}</em>`;
        } else if (mark.type === "underline") {
          text = `<u>${text}</u>`;
        } else if (mark.type === "textStyle" && mark.attributes?.color) {
          const colorVal = String(mark.attributes.color);
          const safeColorPattern = /^(#[0-9A-Fa-f]{3,8}|rgba?\(\d+,\s*\d+,\s*\d+(,\s*[0-9.]+)?\)|hsla?\(\d+,\s*[0-9.]+%?,\s*[0-9.]+%?(,\s*[0-9.]+)?\))$/;
          if (safeColorPattern.test(colorVal)) {
            text = `<span style="color: ${colorVal}">${text}</span>`;
          }
        } else if (mark.type === "span") {
          const style = mark.attributes?.style ? ` style="${sanitizeStyleString(mark.attributes.style)}"` : "";
          let className = "";
          if (mark.attributes?.class) {
            const cleanClasses = mark.attributes.class.split(/\s+/).filter(c => /^[a-zA-Z0-9_-]+$/.test(c));
            if (cleanClasses.length > 0) {
              className = ` class="${cleanClasses.join(" ")}"`;
            }
          }
          text = `<span${style}${className}>${text}</span>`;
        }
      }
    }
    return text;
  }

  const childrenHtml = tipTapJsonToHtml(node.content);
  const attrsStr = compileAttrs(node);

  switch (node.type) {
    case "doc":
      return childrenHtml;
    case "paragraph":
      if (!childrenHtml) return `<p${attrsStr}>&nbsp;</p>`;
      return `<p${attrsStr}>${childrenHtml}</p>`;
    case "heading": {
      const level = node.attrs?.level || 1;
      return `<h${level}${attrsStr}>${childrenHtml}</h${level}>`;
    }
    case "bulletList":
      return `<ul${attrsStr}>${childrenHtml}</ul>`;
    case "orderedList":
      return `<ol${attrsStr}>${childrenHtml}</ol>`;
    case "listItem":
      return `<li${attrsStr}>${childrenHtml}</li>`;
    case "blockquote":
      return `<blockquote${attrsStr}>${childrenHtml}</blockquote>`;
    case "div":
      return `<div${attrsStr}>${childrenHtml}</div>`;
    case "section":
      return `<section${attrsStr}>${childrenHtml}</section>`;
    case "image":
      return `<img src="${node.attrs?.src}" alt="${node.attrs?.alt || ""}" title="${node.attrs?.title || ""}"${attrsStr || ' style="max-width: 100%; height: auto; display: block; margin: 8px 0;"'} />`;
    default:
      return childrenHtml;
  }
}

/**
 * Downloads a image from URL (S3/R2 or relative local storage) and returns it as base64 data URL.
 * Falls back gracefully to original URL to avoid total rendering crash.
 *
 * @param {string} url - Target image URL
 * @returns {Promise<string|null>}
 */
export async function convertImageUrlToBase64(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    const base64 = Buffer.from(response.data, "binary").toString("base64");
    const contentType = response.headers["content-type"] || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    logger.warn("PDF compiler asset fetch failed. Puppeteer will fall back to direct URL:", {
      url,
      error: err.message,
    });
    return url;
  }
}

/**
 * Decodes basic HTML entities back to their raw characters.
 */
export function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Compiles a specific template section (Header/Footer) based on explicit mode configuration.
 *
 * @param {object} sectionState - The template section object { mode, content }
 * @param {Record<string, any>} context - Placeholder variables context
 * @returns {string} Compiled and sanitized HTML string
 */
export function compileContent(sectionState, context = {}) {
  if (!sectionState) return "";

  let rawHtml = "";

  if (sectionState.mode === "source") {
    rawHtml = typeof sectionState.content === "string" ? decodeHtmlEntities(sectionState.content) : "";
  } else {
    rawHtml = tipTapJsonToHtml(sectionState.content);
  }

  return placeholderEngine.compileHtml(rawHtml, context);
}

/**
 * Assembles pages, headers, footers, watermarks, styles and inlined assets
 * into a single unified printable HTML document shell.
 *
 * @param {object} config - Configuration options
 * @param {string} config.compiledHeader - Pre-compiled header HTML
 * @param {string} config.compiledFooter - Pre-compiled footer HTML
 * @param {string[]} config.bodyPagesHtml - Array of page body contents (one string per page)
 * @param {object} config.context - Compiler parameters (colors, watermarks)
 * @returns {string} Fully assembled HTML document
 */
export function compileHtmlDocument({
  compiledHeader,
  compiledFooter,
  bodyPagesHtml,
  context,
}) {
  const primaryColor = context.primaryColor || "#1447e6";
  const secondaryColor = context.secondaryColor || "#f5f5f5";
  const watermarkEnabled = context.watermarkEnabled ?? false;
  const watermarkUrl = context.watermarkUrl || "";
  const watermarkOpacity = context.watermarkOpacity ?? 25;
  const footerPlacement = context.footerPlacement || "EVERY_PAGE";
  const totalPages = bodyPagesHtml.length;

  // Render pages using CSS grid/flexbox A4 blocks
  const pagesHtml = bodyPagesHtml
    .map((bodyContent, idx) => {
      const pageNum = idx + 1;
      const isLastPage = pageNum === totalPages;
      const showFooter =
        footerPlacement === "EVERY_PAGE" ||
        (footerPlacement === "LAST_PAGE_ONLY" && isLastPage);

      // Interpolate page-specific placeholders
      const pageHeader = (compiledHeader || "")
        .split("{{page}}").join(String(pageNum))
        .split("{{total_pages}}").join(String(totalPages));

      const pageFooter = (compiledFooter || "")
        .split("{{page}}").join(String(pageNum))
        .split("{{total_pages}}").join(String(totalPages));

      const pageBody = (bodyContent || "")
        .split("{{page}}").join(String(pageNum))
        .split("{{total_pages}}").join(String(totalPages));

      return `
        <div class="page">
          <!-- Watermark Layer -->
          ${
            watermarkEnabled && watermarkUrl
              ? `
            <div class="watermark" style="opacity: ${watermarkOpacity / 100}">
              <img src="${watermarkUrl}" alt="Watermark" />
            </div>
            `
              : ""
          }

          <!-- Header Region -->
          <div class="header-region">
            <div class="pdf-preview-richtext">
              ${pageHeader || '<p style="color: #cbd5e1; font-style: italic;">[Header Content]</p>'}
            </div>
          </div>

          <!-- Body Region -->
          <div class="body-region pdf-preview-body-content">
            ${pageBody}
          </div>

          <!-- Footer Region -->
          ${
            showFooter
              ? `
            <div class="footer-region">
              <div class="footer-text pdf-preview-richtext" style="width: 100%;">
                ${pageFooter || '<p style="color: #cbd5e1; font-style: italic;">[Footer Content]</p>'}
              </div>
            </div>
            `
              : `
            <div class="footer-region">
              <div class="footer-text"></div>
            </div>
            `
          }
        </div>
      `;
    })
    .join("\n");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${context.document_title || "Sample Document"}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: #f1f5f9;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .page {
          background-color: #ffffff;
          width: 210mm;
          /* min-height allows content to push beyond one A4 sheet; Puppeteer
             will break to a new print page automatically. Fixed height was
             clipping all content beyond the first viewport. */
          min-height: 297mm;
          padding: 20mm;
          position: relative;
          overflow: visible;
          display: flex;
          flex-direction: column;
          margin: 10px auto;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          page-break-after: always;
          break-after: page;
        }

        @media print {
          body {
            background-color: transparent;
            margin: 0;
            padding: 0;
          }
          .page {
            margin: 0;
            border: none;
            box-shadow: none;
            width: 210mm;
            min-height: 297mm;
            page-break-after: always;
            break-after: page;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }

        /* Watermark styling */
        .watermark {
          pointer-events: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .watermark img {
          max-width: 70%;
          max-height: 70%;
          object-fit: contain;
        }

        /* Header / Footer / Body layout styling */
        .header-region {
          padding-bottom: 16px;
          z-index: 10;
        }
        
        .body-region {
          flex: 1;
          /* overflow: visible is critical — hidden would silently clip any
             guidance section content that extends past the header/footer space. */
          overflow: visible;
          margin-top: 16px;
          z-index: 10;
          font-size: 11px;
          line-height: 1.6;
          color: #1e293b;
        }

        .footer-region {
          padding-top: 16px;
          margin-top: 24px;
          display: flex;
          align-items: start;
          justify-content: space-between;
          font-size: 9px;
          color: #64748b;
          line-height: 1.5;
          z-index: 10;
        }

        .footer-text {
          flex: 1;
          min-width: 0;
          padding-right: 24px;
        }

        /* RichText & Preview Styles */
        .pdf-preview-richtext p {
          margin: 0 0 4px 0;
        }
        .pdf-preview-richtext p:last-child {
          margin: 0;
        }
        .pdf-preview-richtext strong {
          font-weight: 700;
        }
        .pdf-preview-richtext em {
          font-style: italic;
        }
        .pdf-preview-richtext u {
          text-decoration: underline;
        }

        .pdf-preview-body-content h2 {
          font-size: 14px;
          font-weight: 700;
          color: ${primaryColor};
          margin: 16px 0 8px 0;
          border-bottom: 1px solid ${secondaryColor};
          padding-bottom: 4px;
        }
        .pdf-preview-body-content h2:first-child {
          margin-top: 0;
        }
        .pdf-preview-body-content p {
          margin: 0 0 8px 0;
        }
        .pdf-preview-body-content strong {
          font-weight: 700;
        }
        .pdf-preview-body-content em {
          font-style: italic;
        }
        .pdf-preview-body-content u {
          text-decoration: underline;
        }
        .pdf-preview-body-content ul,
        .pdf-preview-body-content ol {
          margin: 0 0 12px 16px;
          padding: 0;
        }
        .pdf-preview-body-content ul {
          list-style-type: disc;
        }
        .pdf-preview-body-content ol {
          list-style-type: decimal;
        }
        .pdf-preview-body-content li {
          margin-bottom: 4px;
        }
        .pdf-preview-body-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
        }
        .pdf-preview-body-content th {
          background-color: ${primaryColor};
          color: white;
          font-weight: 600;
          text-align: left;
          padding: 6px 8px;
          font-size: 10px;
        }
        .pdf-preview-body-content td {
          border-bottom: 1px solid #e2e8f0;
          padding: 6px 8px;
          font-size: 10px;
        }
        .pdf-preview-body-content tr:nth-child(even) td {
          background-color: #ffffff;
        }

        /* Rich-text content rendering — ensures TipTap HTML output renders
           correctly in PDF: paragraphs, headings, lists, inline marks, links */
        .rich-text-content p {
          margin: 0 0 6px 0;
          line-height: 1.5;
        }
        .rich-text-content p:last-child {
          margin-bottom: 0;
        }
        .rich-text-content h1 {
          font-size: 14px;
          font-weight: 700;
          margin: 10px 0 6px 0;
        }
        .rich-text-content h2 {
          font-size: 12px;
          font-weight: 700;
          margin: 8px 0 4px 0;
        }
        .rich-text-content h3 {
          font-size: 11px;
          font-weight: 600;
          margin: 6px 0 4px 0;
        }
        .rich-text-content h4 {
          font-size: 10px;
          font-weight: 600;
          margin: 4px 0 2px 0;
        }
        .rich-text-content strong {
          font-weight: 700;
        }
        .rich-text-content em {
          font-style: italic;
        }
        .rich-text-content u {
          text-decoration: underline;
        }
        .rich-text-content ul {
          margin: 4px 0 6px 16px;
          padding: 0;
          list-style-type: disc;
        }
        .rich-text-content ol {
          margin: 4px 0 6px 16px;
          padding: 0;
          list-style-type: decimal;
        }
        .rich-text-content li {
          margin-bottom: 3px;
          line-height: 1.5;
        }
        .rich-text-content a {
          color: inherit;
          text-decoration: underline;
        }
        .rich-text-content blockquote {
          border-left: 3px solid #cbd5e1;
          margin: 6px 0;
          padding-left: 10px;
          color: #64748b;
          font-style: italic;
        }

        /* Prevent a guidance section from being split mid-element */
        .guidance-section {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;
}

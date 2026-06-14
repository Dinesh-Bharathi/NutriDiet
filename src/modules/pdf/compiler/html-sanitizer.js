import { JSDOM } from "jsdom";
import logger from "../../../utils/logger.js";

/**
 * Whitelist of safe CSS property names for inline styles.
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
]);

/**
 * Whitelist of safe HTML tag names.
 */
const ALLOWED_TAGS = new Set([
  "div",
  "section",
  "p",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "ul",
  "ol",
  "li",
  "span",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "strong",
  "em",
  "u",
]);

/**
 * Sanitizes an inline style string using the property whitelist.
 *
 * @param {string} styleStr - The raw inline style string
 * @returns {string} Sanitized style string
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
      // Block JS injection attempts in values
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
 * Sanitizes template HTML output. Removes dangerous tags, event handlers, and
 * invalid inline style properties/classes. Uses JSDOM for server-side parsing.
 *
 * @param {string} html - Raw compiled HTML
 * @returns {string} Sanitized, safe HTML
 */
export function sanitizeTemplateHtml(html) {
  if (!html) return "";

  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const blockedTags = [
      "script",
      "iframe",
      "object",
      "embed",
      "applet",
      "form",
      "meta",
      "link",
      "style",
      "svg",
    ];

    const allElements = doc.body.querySelectorAll("*");
    allElements.forEach((el) => {
      const tagName = el.tagName.toLowerCase();

      // 1. Remove dangerous or non-whitelisted tags
      if (blockedTags.includes(tagName) || !ALLOWED_TAGS.has(tagName)) {
        el.remove();
        return;
      }

      // 2. Validate/Sanitize attributes
      const attrs = Array.from(el.attributes);
      attrs.forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.toLowerCase();

        // Strip event listeners (onclick, onload, etc.)
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
        }
        // Strip javascript: URLs
        else if (
          (name === "href" || name === "src") &&
          value.includes("javascript:")
        ) {
          el.removeAttribute(attr.name);
        }
        // Validate inline style strings
        else if (name === "style") {
          const cleanStyle = sanitizeStyleString(attr.value);
          if (cleanStyle) {
            el.setAttribute(attr.name, cleanStyle);
          } else {
            el.removeAttribute(attr.name);
          }
        }
        // Validate CSS classes
        else if (name === "class") {
          const classNames = attr.value.split(/\s+/);
          const cleanClassNames = classNames.filter((cls) =>
            /^[a-zA-Z0-9_-]+$/.test(cls)
          );
          if (cleanClassNames.length > 0) {
            el.setAttribute(attr.name, cleanClassNames.join(" "));
          } else {
            el.removeAttribute(attr.name);
          }
        }
      });
    });

    return doc.body.innerHTML;
  } catch (err) {
    logger.error("HTML Sanitization failed on backend:", { error: err.message });
    return "";
  }
}

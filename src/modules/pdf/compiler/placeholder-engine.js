import { placeholderRegistry } from "./placeholder-registry.js";
import { sanitizeTemplateHtml } from "./html-sanitizer.js";

/**
 * Normalizes placeholder keys by stripping attributes (like width, height, opacity)
 * and keeping only the core tag name.
 * e.g., {{clinic_logo width=180}} -> {{clinic_logo}}
 *
 * @param {string} key - Raw placeholder token
 * @returns {string} Normalized placeholder tag
 */
export function normalizePlaceholderKey(key) {
  if (!key) return "";
  const match = key.match(/^\{\{\s*([a-zA-Z0-9_]+)/);
  if (match) {
    return `{{${match[1]}}}`;
  }
  return key;
}

/**
 * Structured Placeholder Renderer
 * Resolves placeholder keys into structured HTML definitions.
 */
export const placeholderRenderer = {
  /**
   * Resolves a placeholder key into a structured layout element.
   *
   * @param {string} key - The placeholder key
   * @param {Record<string, any>} context - Context parameters (URLs, variables, overrides)
   * @returns {object|null} Structured element definition
   */
  resolve(key, context) {
    if (key === "{{clinic_logo}}") {
      const src = context.logoUrl || null;
      return {
        type: "image",
        props: {
          src,
          alt: "Clinic Logo",
          width: context.logoWidth ?? 120,
          height: context.logoHeight ?? 48,
          preserveAspectRatio: context.logoPreserveAspectRatio ?? true,
        },
      };
    }

    if (key === "{{watermark}}") {
      const src = context.watermarkUrl || null;
      return {
        type: "watermark",
        props: {
          src,
          opacity: context.watermarkOpacity ?? 25,
          enabled: context.watermarkEnabled ?? false,
        },
      };
    }

    if (key === "{{signature_block}}") {
      const type = context.signatureType || "LINE";
      const authorName = context.author_name || "Practitioner";
      const signatureImageUrl = context.signatureImageUrl || null;
      return {
        type: "signature",
        props: {
          type,
          authorName,
          signatureImageUrl,
        },
      };
    }

    // Fallback to registry text properties
    const placeholder = placeholderRegistry.get(key);
    if (placeholder) {
      const plainKey = key.replace(/[{}]/g, "").trim();
      const value = context[key] ?? context[plainKey] ?? "";
      return {
        type: "text",
        props: {
          value,
        },
      };
    }

    return null;
  },

  /**
   * Converts a structured element definition into HTML strings.
   *
   * @param {object} structure - Structured element definition
   * @returns {string} Safe HTML representation
   */
  toHtml(structure) {
    if (!structure) return "";

    if (structure.type === "image") {
      const { src, alt, width, height, preserveAspectRatio } = structure.props;
      if (!src) return "";

      const styleAttrs = [
        `max-width: 100%`,
        `object-fit: contain`,
        `display: inline-block`,
        `vertical-align: middle`,
        `width: ${width}px`,
        preserveAspectRatio ? `height: auto` : `height: ${height}px`,
      ].join("; ");

      return `<img src="${src}" alt="${alt}" style="${styleAttrs}" width="${width}" />`;
    }

    if (structure.type === "watermark") {
      return ""; // Watermarks are positioned absolutely in background layers
    }

    if (structure.type === "signature") {
      const { type, signatureImageUrl } = structure.props;
      if (type === "NONE") return "";

      if (type === "IMAGE" && signatureImageUrl) {
        return `
<div class="signature-block" style="margin-top: 8px; page-break-inside: avoid;">
  <img src="${signatureImageUrl}" style="max-height: 60px; max-width: 250px; display: block;" />
</div>`;
      }

      // Default: LINE
      return `
<div class="signature-block" style="margin-top: 8px; page-break-inside: avoid;">
  <div style="border-bottom: 1px solid #000; width: 200px; height: 24px;"></div>
</div>`;
    }

    if (structure.type === "text") {
      return structure.props.value;
    }

    return "";
  },
};

export const placeholderEngine = {
  /**
   * Replaces placeholders in a raw HTML string.
   * Uses structured renderer for placeholders.
   *
   * @param {string} html - Raw HTML string template
   * @param {Record<string, any>} [context] - Context parameters
   * @returns {string} Fully interpolated and sanitized HTML string
   */
  compileHtml(html, context = {}) {
    if (!html) return "";

    let result = html;

    // 1. Resolve {{watermark ...}} placeholders with inline opacity values
    const watermarkRegex = /\{\{\s*watermark\s*(.*?)\}\}/g;
    result = result.replace(watermarkRegex, (match, attrString) => {
      context.watermarkEnabled = true;
      const opacityMatch = attrString.match(/opacity=(\d+)/);
      if (opacityMatch) {
        context.watermarkOpacity = parseInt(opacityMatch[1], 10);
      }
      return ""; // Watermark is rendered separately in background layer
    });

    // 2. Resolve {{clinic_logo ...}} placeholders with inline width and/or height parameters
    const logoRegex = /\{\{\s*clinic_logo\s*(.*?)\}\}/g;
    result = result.replace(logoRegex, (match, attrString) => {
      const widthMatch = attrString.match(/width=(\d+)/);
      const heightMatch = attrString.match(/height=(\d+)/);

      const width = widthMatch ? parseInt(widthMatch[1], 10) : (context.logoWidth ?? 120);
      const height = heightMatch ? parseInt(heightMatch[1], 10) : (context.logoHeight ?? 48);

      const logoContext = {
        ...context,
        logoWidth: width,
        logoHeight: height,
        logoPreserveAspectRatio: heightMatch ? false : (context.logoPreserveAspectRatio ?? true),
      };

      const structure = placeholderRenderer.resolve("{{clinic_logo}}", logoContext);
      return placeholderRenderer.toHtml(structure);
    });

    // 3. Resolve other standard placeholders
    const placeholders = placeholderRegistry.getAll();
    for (const placeholder of placeholders) {
      const key = placeholder.key;
      if (
        key !== "{{clinic_logo}}" &&
        key !== "{{watermark}}" &&
        key !== "{{page}}" &&
        key !== "{{total_pages}}" &&
        result.includes(key)
      ) {
        const structure = placeholderRenderer.resolve(key, context);
        const replacementHtml = placeholderRenderer.toHtml(structure);
        result = result.split(key).join(replacementHtml);
      }
    }

    // Highlight any remaining unresolved {{...}} tokens as unknown placeholders
    result = result.replace(
      /\{\{[^{}]+\}\}/g,
      (match) => {
        const normalized = normalizePlaceholderKey(match);
        if (normalized === "{{page}}" || normalized === "{{total_pages}}") {
          return match;
        }
        return `<span style="display:inline-block;background:#fef3c7;color:#b45309;border:1px solid #fcd34d;border-radius:3px;padding:0 4px;font-size:9px;font-family:monospace;font-weight:600;" title="Unknown placeholder: ${match}">${match}</span>`;
      }
    );

    // 4. Server-side Whitelist Sanitization
    result = sanitizeTemplateHtml(result);

    return result;
  },
};

export default placeholderEngine;

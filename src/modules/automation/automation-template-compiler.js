// src/modules/automation/automation-template-compiler.js

import { automationTemplateRegistry } from './automation-template-variables.js';

/**
 * Converts rich text HTML into WhatsApp markdown formatting.
 *
 * @param {string} html
 * @returns {string} WhatsApp-compatible markdown plain text
 */
export function convertHtmlToWhatsAppMarkdown(html) {
  if (!html) return '';
  let text = html;

  // Replace block tags with newlines
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<p>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<div>/gi, '');

  // Bold: <strong> / <b> -> *text*
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '*$1*');
  text = text.replace(/<b>(.*?)<\/b>/gi, '*$1*');

  // Italic: <em> / <i> -> _text_
  text = text.replace(/<em>(.*?)<\/em>/gi, '_$1_');
  text = text.replace(/<i>(.*?)<\/i>/gi, '_$1_');

  // Underline: <u> -> _text_ (WhatsApp doesn't have underline, so we emphasize with italic)
  text = text.replace(/<u>(.*?)<\/u>/gi, '_$1_');

  // Strikethrough: <del> / <s> -> ~text~
  text = text.replace(/<del>(.*?)<\/del>/gi, '~$1~');
  text = text.replace(/<s>(.*?)<\/s>/gi, '~$1~');

  // Bullet lists: <ul><li>item</li></ul> -> • item
  text = text.replace(/<ul>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return content.replace(/<li>(.*?)<\/li>/gi, '• $1\n');
  });

  // Ordered lists: <ol><li>item</li></ol> -> 1. item
  text = text.replace(/<ol>([\s\S]*?)<\/ol>/gi, (match, content) => {
    let index = 1;
    return content.replace(/<li>(.*?)<\/li>/gi, (m, c) => `${index++}. ${c}\n`);
  });

  // Strip outer list tags
  text = text.replace(/<\/?li>/gi, '');

  // Links: <a href="url">text</a> -> text (url)
  text = text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (match, url, linkText) => {
    if (linkText.trim() === url.trim()) {
      return url;
    }
    return `${linkText} (${url})`;
  });

  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode standard HTML entities
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");

  // Clean trailing spaces and return
  return text.trim();
}

export const automationTemplateCompiler = {
  /**
   * Compiles template text (title/message) using the variable registry and provided context.
   * Converts HTML rich text structures into WhatsApp markdown syntax when detected.
   *
   * @param {string} text
   * @param {object} context
   * @returns {string}
   */
  compile(text, context) {
    if (!text) return '';
    const compiled = automationTemplateRegistry.compile(text, context);
    
    // If the compiled output contains HTML tags, convert it to WhatsApp Markdown
    if (/<[a-z][\s\S]*>/i.test(compiled)) {
      return convertHtmlToWhatsAppMarkdown(compiled);
    }
    return compiled;
  }
};

export default automationTemplateCompiler;

// backend/tests/pdf-template-regression.js

import assert from 'assert';
import { pdfTemplateSchema } from '../src/modules/settings/pdf-template.validation.js';
import { decodeHtmlEntities, recursiveDecodeHtmlEntities } from '../src/modules/settings/settings.controller.js';
import { placeholderEngine } from '../src/modules/pdf/compiler/placeholder-engine.js';

console.log('Starting PDF Template Regression Tests...');

// 1. Zod Schema Validation & Persistence
console.log('Testing: Zod Schema Validation & Persistence...');
const payload1 = {
  logoAssetId: 'logo-asset-123',
  logoUrl: 'https://example.com/logo.png',
  logoWidth: 220,
  logoHeight: 90,
  logoPreserveAspectRatio: false,
  primaryColor: '#1447e6',
  secondaryColor: '#f5f5f5',
  footerPlacement: 'EVERY_PAGE',
};

const result1 = pdfTemplateSchema.parse(payload1);
assert.strictEqual(result1.logoWidth, 220);
assert.strictEqual(result1.logoHeight, 90);
assert.strictEqual(result1.logoPreserveAspectRatio, false);

const payload2 = {
  watermarkAssetId: 'watermark-asset-456',
  watermarkUrl: 'https://example.com/watermark.png',
  watermarkOpacity: 50,
  watermarkEnabled: true,
  primaryColor: '#1447e6',
  secondaryColor: '#f5f5f5',
  footerPlacement: 'LAST_PAGE_ONLY',
};

const result2 = pdfTemplateSchema.parse(payload2);
assert.strictEqual(result2.watermarkAssetId, 'watermark-asset-456');
assert.strictEqual(result2.watermarkUrl, 'https://example.com/watermark.png');
assert.strictEqual(result2.watermarkOpacity, 50);
assert.strictEqual(result2.watermarkEnabled, true);
console.log('✓ Zod Schema Validation & Persistence passed.');

// 2. XSS-Clean targeted decoding in settings controller
console.log('Testing: XSS-Clean targeted decoding...');
const escapedUrl = 'https://s3.amazonaws.com/bucket/file.png?AWSAccessKeyId=KEY&amp;Signature=SIG&amp;Expires=123';
const decodedUrl = decodeHtmlEntities(escapedUrl);
assert.strictEqual(decodedUrl, 'https://s3.amazonaws.com/bucket/file.png?AWSAccessKeyId=KEY&Signature=SIG&Expires=123');

const escapedTemplate = {
  mode: 'source',
  content: '&lt;div class=&quot;header&quot;&gt;Hello &amp; Welcome&lt;/div&gt;',
};
const decodedTemplate = recursiveDecodeHtmlEntities(escapedTemplate);
assert.strictEqual(decodedTemplate.content, '<div class="header">Hello & Welcome</div>');
console.log('✓ XSS-Clean targeted decoding passed.');

// 3. Compiler Logo Sizing & Watermark Interpolation
console.log('Testing: Compiler Logo Sizing & Watermark Interpolation...');
const template1 = '<div>{{clinic_logo width=220 height=90}}</div>';
const context1 = {
  logoUrl: 'https://example.com/logo.png',
  logoWidth: 120,
  logoHeight: 48,
  logoPreserveAspectRatio: true,
};

const compiledHtml1 = placeholderEngine.compileHtml(template1, context1);
assert.ok(compiledHtml1.includes('width="220"'));
assert.ok(compiledHtml1.includes('width: 220px'));
assert.ok(compiledHtml1.includes('height: 90px'));
assert.ok(!compiledHtml1.includes('height: auto'));

// Expanded parameters test (only width)
const template2 = '<div>{{clinic_logo width=220}}</div>';
const compiledHtml2 = placeholderEngine.compileHtml(template2, context1);
assert.ok(compiledHtml2.includes('width="220"'));
assert.ok(compiledHtml2.includes('width: 220px'));
assert.ok(compiledHtml2.includes('height: auto'));

// Expanded parameters test (only height)
const template3 = '<div>{{clinic_logo height=90}}</div>';
const compiledHtml3 = placeholderEngine.compileHtml(template3, context1);
assert.ok(compiledHtml3.includes('height: 90px'));
assert.ok(!compiledHtml3.includes('height: auto'));

// Watermark testing
const template4 = '<p>{{watermark opacity=50}}</p>';
const context4 = {
  watermarkUrl: 'https://example.com/watermark.png',
  watermarkEnabled: false,
  watermarkOpacity: 25,
};

const compiledHtml4 = placeholderEngine.compileHtml(template4, context4);
assert.strictEqual(compiledHtml4, '<p></p>');
assert.strictEqual(context4.watermarkEnabled, true);
assert.strictEqual(context4.watermarkOpacity, 50);

// Watermark expanded opacity parameters
const opacityValues = [25, 50, 75, 100];
for (const opacity of opacityValues) {
  const context = {
    watermarkUrl: 'https://example.com/watermark.png',
    watermarkEnabled: false,
    watermarkOpacity: 0,
  };
  placeholderEngine.compileHtml(`<p>{{watermark opacity=${opacity}}}</p>`, context);
  assert.strictEqual(context.watermarkEnabled, true);
  assert.strictEqual(context.watermarkOpacity, opacity);
}

console.log('✓ Compiler Logo Sizing & Watermark Interpolation passed.');
console.log('All PDF Template Regression Tests Passed Successfully!');

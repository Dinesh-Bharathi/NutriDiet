// src/modules/pdf/pdf-template.defaults.js

export const DEFAULT_PDF_TEMPLATE_CONFIG = {
  logoAssetId: null,
  logoUrl: null,
  logoWidth: 120,
  logoHeight: 48,
  logoPreserveAspectRatio: true,
  watermarkAssetId: null,
  watermarkUrl: null,
  watermarkOpacity: 25,
  watermarkEnabled: false,
  primaryColor: "#1447e6",
  secondaryColor: "#f5f5f5",
  headerContent: {
    mode: "visual",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            {
              type: "text",
              marks: [{ type: "bold" }],
              text: "{{clinic_name}}",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            {
              type: "text",
              text: "{{clinic_address}}",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            {
              type: "text",
              text: "{{clinic_phone}}  ·  {{clinic_email}}",
            },
          ],
        },
      ],
    },
  },
  footerContent: {
    mode: "visual",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            {
              type: "text",
              text: "{{author_name}}",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            {
              type: "text",
              text: "{{signature_block}}",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            {
              type: "text",
              text: "{{generated_at}}",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [
            {
              type: "text",
              text: "Page {{page}} of {{total_pages}}",
            },
          ],
        },
      ],
    },
  },
  footerPlacement: "EVERY_PAGE",
};

export default DEFAULT_PDF_TEMPLATE_CONFIG;

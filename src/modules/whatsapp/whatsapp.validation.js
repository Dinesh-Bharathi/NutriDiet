import { z } from 'zod';

const cleanString = z
  .string()
  .trim()
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional();

export const whatsappConnectionUpsertSchema = z.object({
  wabaId: cleanString,
  phoneNumberId: cleanString,
  businessAccountId: cleanString,
  displayPhoneNumber: cleanString,
  verifiedName: cleanString,
  accessToken: cleanString,
});

export const whatsappMessageSendSchema = z.object({
  type: z.enum(['TEXT', 'TEMPLATE', 'DOCUMENT', 'IMAGE', 'AUDIO', 'VIDEO', 'LOCATION']),
  body: z.string().trim().optional().nullable(),
  attachmentId: z.string().trim().optional().nullable(),
  attachmentIds: z.array(z.string().trim()).optional().nullable(),
  mediaUrl: z.string().trim().optional().nullable(),
  mediaFileName: z.string().trim().optional().nullable(),
  caption: z.string().trim().optional().nullable(),
  locationLatitude: z.number().optional().nullable(),
  locationLongitude: z.number().optional().nullable(),
  locationName: z.string().trim().optional().nullable(),
  locationAddress: z.string().trim().optional().nullable(),
  replyToMessageId: z.string().trim().optional().nullable(),
  
  // templates
  templateName: z.string().trim().optional().nullable(),
  templateLanguage: z.string().trim().optional().nullable(),
  components: z.any().optional().nullable(),
}).refine((data) => {
  if (data.type === 'TEXT' && !data.body) {
    return false;
  }
  if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(data.type)) {
    return !!(data.attachmentId || (data.attachmentIds && data.attachmentIds.length > 0) || data.mediaUrl);
  }
  if (data.type === 'LOCATION') {
    return data.locationLatitude !== undefined && data.locationLatitude !== null &&
           data.locationLongitude !== undefined && data.locationLongitude !== null;
  }
  if (data.type === 'TEMPLATE' && !data.templateName) {
    return false;
  }
  return true;
}, {
  message: "Invalid payload: missing type-specific required fields (body for TEXT, attachmentId/mediaUrl for media, latitude/longitude for LOCATION, templateName for TEMPLATE).",
});


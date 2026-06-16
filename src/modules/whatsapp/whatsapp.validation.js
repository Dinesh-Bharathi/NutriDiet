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

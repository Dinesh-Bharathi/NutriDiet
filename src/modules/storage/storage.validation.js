// src/modules/storage/storage.validation.js
import { z } from "zod";
import { FILE_ENTITY_TYPE, FILE_VISIBILITY } from "./storage.constants.js";

export const uploadAssetSchema = z.object({
  body: z.object({
    entityType: z.enum(Object.values(FILE_ENTITY_TYPE), {
      required_error: "entityType is required",
    }),
    entityId: z.string({
      required_error: "entityId is required",
    }),
    visibility: z.enum(Object.values(FILE_VISIBILITY)).default(FILE_VISIBILITY.PRIVATE),
  }),
});

export const getAssetsSchema = z.object({
  query: z.object({
    entityType: z.enum(Object.values(FILE_ENTITY_TYPE)).optional(),
    entityId: z.string().optional(),
    resourceType: z.string().optional(),
  }),
});

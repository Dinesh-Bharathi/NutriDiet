import { z } from "zod";
import { Role, UserStatus } from "@prisma/client";

export const userValidation = {
  getUsers: z.object({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      role: z.preprocess(
        (val) => (typeof val === 'string' ? val.split(',') : val),
        z.array(z.nativeEnum(Role))
      ).optional(),
      status: z.nativeEnum(UserStatus).optional(),
      search: z.string().max(100).optional(),
    })
  }),
};

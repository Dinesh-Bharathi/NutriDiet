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
      status: z.preprocess(
        (val) => (typeof val === 'string' ? val.split(',') : val),
        z.array(z.nativeEnum(UserStatus))
      ).optional(),
      search: z.string().max(100).optional(),
    })
  }),

  createUser: z.object({
    body: z.object({
      email: z.string().email("Invalid email address").toLowerCase().trim(),
      firstName: z.string().min(1, "First name is required").max(100).trim(),
      lastName: z.string().min(1, "Last name is required").max(100).trim(),
      role: z.nativeEnum(Role),
      password: z.string().min(8, "Password must be at least 8 characters long").max(100),
    })
  }),

  updateRole: z.object({
    body: z.object({
      role: z.nativeEnum(Role),
    })
  }),

  updateStatus: z.object({
    body: z.object({
      status: z.nativeEnum(UserStatus),
    })
  }),

  changePassword: z.object({
    body: z.object({
      password: z.string().min(8, "Password must be at least 8 characters long").max(100),
    })
  }),

  updateUser: z.object({
    body: z.object({
      firstName: z.string().min(1, "First name is required").max(100).trim().optional(),
      lastName: z.string().min(1, "Last name is required").max(100).trim().optional(),
      email: z.string().email("Invalid email address").toLowerCase().trim().optional(),
      avatarUrl: z.string().nullable().optional(),
      status: z.nativeEnum(UserStatus).optional(),
      role: z.any().refine(() => false, { message: "Role changes are not allowed on this endpoint. Use the change-role endpoint instead." }).optional(),
      password: z.any().refine(() => false, { message: "Password updates are not allowed on this endpoint." }).optional(),
      passwordHash: z.any().refine(() => false, { message: "Password updates are not allowed on this endpoint." }).optional(),
      tenantId: z.any().refine(() => false, { message: "Tenant modifications are not allowed." }).optional(),
    }).strict()
  }),
};

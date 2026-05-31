// prisma/seed/seed-users.js
import prisma from '../../src/lib/prisma.js';
import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

export async function seedUsers(tenants) {
  console.log('Seeding users...');
  const { tenant1, tenant2 } = tenants;

  const passwordHash = await argon2.hash('Password@123', ARGON2_OPTIONS);

  // Tenant 1 Users
  const t1Owner = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      email: 'owner@nutridiet.demo',
      passwordHash,
      firstName: 'T1',
      lastName: 'Owner',
      role: 'OWNER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const t1Admin = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      email: 'admin@nutridiet.demo',
      passwordHash,
      firstName: 'T1',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const t1Dietitian = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      email: 'dietitian@nutridiet.demo',
      passwordHash,
      firstName: 'T1',
      lastName: 'Dietitian',
      role: 'DIETITIAN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const t1Assistant = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      email: 'assistant@nutridiet.demo',
      passwordHash,
      firstName: 'T1',
      lastName: 'Assistant',
      role: 'ASSISTANT',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Tenant 2 Users
  const t2Owner = await prisma.user.create({
    data: {
      tenantId: tenant2.id,
      email: 'owner@fitlife.demo',
      passwordHash,
      firstName: 'T2',
      lastName: 'Owner',
      role: 'OWNER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const t2Admin = await prisma.user.create({
    data: {
      tenantId: tenant2.id,
      email: 'admin@fitlife.demo',
      passwordHash,
      firstName: 'T2',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const t2Dietitian = await prisma.user.create({
    data: {
      tenantId: tenant2.id,
      email: 'dietitian@fitlife.demo',
      passwordHash,
      firstName: 'T2',
      lastName: 'Dietitian',
      role: 'DIETITIAN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const t2Assistant = await prisma.user.create({
    data: {
      tenantId: tenant2.id,
      email: 'assistant@fitlife.demo',
      passwordHash,
      firstName: 'T2',
      lastName: 'Assistant',
      role: 'ASSISTANT',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  console.log('Users seeded successfully.');
  return {
    t1: { owner: t1Owner, admin: t1Admin, dietitian: t1Dietitian, assistant: t1Assistant },
    t2: { owner: t2Owner, admin: t2Admin, dietitian: t2Dietitian, assistant: t2Assistant },
  };
}

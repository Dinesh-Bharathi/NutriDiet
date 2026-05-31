// prisma/seed/seed-tenants.js
import prisma from '../../src/lib/prisma.js';

export async function seedTenants() {
  console.log('Seeding tenants...');

  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Nutri Diet Demo',
      slug: 'nutri-diet-fe',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      currencyCode: 'INR',
      measurementSystem: 'METRIC',
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'FitLife Nutrition',
      slug: 'fitlife',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      countryCode: 'AU',
      timezone: 'Australia/Sydney',
      locale: 'en-AU',
      currencyCode: 'AUD',
      measurementSystem: 'METRIC',
    },
  });

  console.log('Tenants seeded successfully.');
  return { tenant1, tenant2 };
}

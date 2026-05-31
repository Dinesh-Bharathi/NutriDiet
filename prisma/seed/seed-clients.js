// prisma/seed/seed-clients.js
import prisma from '../../src/lib/prisma.js';

export async function seedClients(tenants, users) {
  console.log('Seeding clients...');
  const { tenant1, tenant2 } = tenants;

  const t1DietitianId = users.t1.dietitian.id;
  const t2DietitianId = users.t2.dietitian.id;

  const clientsList = [
    {
      firstName: 'Aarav',
      lastName: 'Sharma',
      email: 'aarav.sharma@example.com',
      phone: '+919876543210',
      gender: 'MALE',
      dateOfBirth: new Date('1992-05-15'),
      notes: 'Wants to improve endurance and reduce body fat percentage.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
    {
      firstName: 'Ananya',
      lastName: 'Patel',
      email: 'ananya.patel@example.com',
      phone: '+919876543211',
      gender: 'FEMALE',
      dateOfBirth: new Date('1988-11-23'),
      notes: 'Managing type-2 diabetes; requires low carb dietary monitoring.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
    {
      firstName: 'Kabir',
      lastName: 'Singh',
      email: 'kabir.singh@example.com',
      phone: '+919876543212',
      gender: 'MALE',
      dateOfBirth: new Date('1995-02-10'),
      notes: 'Highly active runner training for half marathon. Needs carb loading guidance.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
    {
      firstName: 'Diya',
      lastName: 'Mehta',
      email: 'diya.mehta@example.com',
      phone: '+919876543213',
      gender: 'FEMALE',
      dateOfBirth: new Date('2001-08-30'),
      notes: 'Seeking healthy fat loss and lean muscle preservation.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
    {
      firstName: 'Rohan',
      lastName: 'Verma',
      email: 'rohan.verma@example.com',
      phone: '+919876543214',
      gender: 'MALE',
      dateOfBirth: new Date('1984-04-05'),
      notes: 'Struggling with consistency. Needs easy high protein meal swaps.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
  ];

  const t1Clients = [];
  for (const c of clientsList) {
    const client = await prisma.client.create({
      data: {
        tenantId: tenant1.id,
        dietitianId: t1DietitianId,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        gender: c.gender,
        dateOfBirth: c.dateOfBirth,
        notes: c.notes,
        status: c.status,
        onboardingStatus: c.onboardingStatus,
      },
    });
    t1Clients.push(client);
  }

  // Tenant 2 Clients (Australia)
  const t2ClientsList = [
    {
      firstName: 'Lachlan',
      lastName: 'Smith',
      email: 'lachlan.smith@example.au',
      phone: '+61412345678',
      gender: 'MALE',
      dateOfBirth: new Date('1990-07-14'),
      notes: 'Focus on sports nutrition for local rugby team training.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
    {
      firstName: 'Charlotte',
      lastName: 'Brown',
      email: 'charlotte.brown@example.au',
      phone: '+61412345679',
      gender: 'FEMALE',
      dateOfBirth: new Date('1993-01-25'),
      notes: 'Vegetarian seeking fat loss and balanced protein intake.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
    {
      firstName: 'Oliver',
      lastName: 'Jones',
      email: 'oliver.jones@example.au',
      phone: '+61412345680',
      gender: 'MALE',
      dateOfBirth: new Date('1987-10-09'),
      notes: 'Wants to gain muscle mass. Needs caloric surplus guidelines.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
    {
      firstName: 'Amelia',
      lastName: 'Wilson',
      email: 'amelia.wilson@example.au',
      phone: '+61412345681',
      gender: 'FEMALE',
      dateOfBirth: new Date('1996-04-18'),
      notes: 'Needs gluten free suggestions due to mild sensitivity.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
    {
      firstName: 'William',
      lastName: 'Taylor',
      email: 'william.taylor@example.au',
      phone: '+61412345682',
      gender: 'MALE',
      dateOfBirth: new Date('1979-09-02'),
      notes: 'Sedentary office job; aiming to build a healthier baseline.',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
  ];

  const t2Clients = [];
  for (const c of t2ClientsList) {
    const client = await prisma.client.create({
      data: {
        tenantId: tenant2.id,
        dietitianId: t2DietitianId,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        gender: c.gender,
        dateOfBirth: c.dateOfBirth,
        notes: c.notes,
        status: c.status,
        onboardingStatus: c.onboardingStatus,
      },
    });
    t2Clients.push(client);
  }

  console.log('Clients seeded successfully.');
  return { t1Clients, t2Clients };
}

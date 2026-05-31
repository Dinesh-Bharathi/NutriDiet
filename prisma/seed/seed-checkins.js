// prisma/seed/seed-checkins.js
import prisma from '../../src/lib/prisma.js';

export async function seedCheckIns(tenants, users, clients, dietPlans) {
  console.log('Seeding client weekly check-ins...');
  const { tenant1, tenant2 } = tenants;
  const { t1Clients, t2Clients } = clients;

  const t1DietitianId = users.t1.dietitian.id;
  const t2DietitianId = users.t2.dietitian.id;

  const checkIns = [];

  // Generate 6 check-ins for each client (weeks -6 to -1)
  const weeks = [6, 5, 4, 3, 2, 1];

  for (const tenant of [tenant1, tenant2]) {
    const tenantId = tenant.id;
    const dietitianId = tenantId === tenant1.id ? t1DietitianId : t2DietitianId;
    const clientList = tenantId === tenant1.id ? t1Clients : t2Clients;

    for (let cIdx = 0; cIdx < clientList.length; cIdx++) {
      const client = clientList[cIdx];

      // Find client's diet plan
      const plan = await prisma.dietPlan.findFirst({
        where: { clientId: client.id, tenantId }
      });

      // Find client's initial weight from assessment
      const assessment = await prisma.assessment.findFirst({
        where: { clientId: client.id, tenantId }
      });
      const initialWeight = assessment?.weightKg || 80;

      // Determine profile type:
      // Index 4: Low Adherence / Weight Stall
      // Others: Successful progression
      const isStallProfile = cIdx === 4;

      for (let wIdx = 0; wIdx < weeks.length; wIdx++) {
        const weekNum = weeks[wIdx];
        const daysAgo = weekNum * 7;
        const checkInDate = new Date();
        checkInDate.setDate(checkInDate.getDate() - daysAgo);

        // Calculate progress metrics
        let weight = initialWeight;
        let waist = 90;
        let adherence = 8; // out of 10
        let stress = 4;
        let sleep = 7.5;
        let water = 2.5;

        if (isStallProfile) {
          // Weight stall & low adherence simulation
          if (weekNum === 6) {
            weight = initialWeight - 0.5;
            waist = 94;
            adherence = 8;
          } else if (weekNum === 5) {
            weight = initialWeight - 0.8;
            waist = 93.5;
            adherence = 7;
          } else if (weekNum === 4) {
            weight = initialWeight - 0.9; // stalled
            waist = 93.5;
            adherence = 4; // adherence drop
            stress = 8;
            sleep = 5.5;
            water = 1.2;
          } else if (weekNum === 3) {
            weight = initialWeight - 0.8; // slight gain
            waist = 93.8;
            adherence = 3; // low adherence
            stress = 9;
            sleep = 5;
            water = 1.0;
          } else if (weekNum === 2) {
            weight = initialWeight - 0.9;
            waist = 93.6;
            adherence = 5;
            stress = 7;
            sleep = 6.5;
          } else {
            weight = initialWeight - 0.9; // still stalled
            waist = 93.7;
            adherence = 4;
            stress = 8;
            sleep = 6.0;
          }
        } else {
          // Successful progress
          // Linear decline in weight (approx 0.5kg per week)
          weight = initialWeight - (6 - weekNum) * 0.6 - 0.2;
          waist = 90 - (6 - weekNum) * 0.8;
          adherence = weekNum === 1 ? 9 : 8;
          stress = wIdx % 2 === 0 ? 3 : 5;
          sleep = 7.0 + (wIdx % 3) * 0.5;
          water = 2.2 + (wIdx % 2) * 0.4;
        }

        // Most recent week (week 1) gets a mix of SUBMITTED and REVIEWED status
        const isMostRecent = weekNum === 1;
        let status = 'REVIEWED';
        let submittedAt = new Date(checkInDate);
        let reviewedAt = new Date(checkInDate);
        reviewedAt.setHours(reviewedAt.getHours() + 4);

        if (isMostRecent) {
          // Clients 3 and 4 have pending/submitted status (awaiting review!)
          if (cIdx >= 3) {
            status = 'SUBMITTED';
            reviewedAt = null;
          }
        }

        const checkIn = await prisma.clientCheckIn.create({
          data: {
            tenantId,
            clientId: client.id,
            dietPlanId: plan?.id || null,
            checkInDate,
            submittedAt,
            reviewedAt: status === 'REVIEWED' ? reviewedAt : null,
            reviewedBy: status === 'REVIEWED' ? dietitianId : null,
            status,
            requiresFollowUp: isStallProfile && weekNum <= 2,
            weightKg: Number(weight.toFixed(1)),
            waistCm: Number(waist.toFixed(1)),
            waterIntakeLiters: water,
            sleepHours: sleep,
            exerciseDays: isStallProfile ? 2 : 5,
            energyLevel: isStallProfile ? 5 : 8,
            stressLevel: stress,
            moodLevel: isStallProfile ? 6 : 8,
            planAdherence: adherence,
            clientNotes: isStallProfile 
              ? 'Feeling very stressed with work. Found it hard to prepare meals on Day B cycles.' 
              : 'Feeling good, routine is becoming easier to follow. Enjoying Salmon on Day A.',
            practitionerNotes: status === 'REVIEWED' 
              ? (isStallProfile 
                  ? 'Client experiencing work stress and meal prep fatigue. Let\'s schedule a call to simplify Day B meals.' 
                  : 'Excellent progression. Macros are working well. Maintain current calorie budget.')
              : null,
          },
        });
        checkIns.push(checkIn);
      }
    }
  }

  console.log('Client check-ins seeded successfully.');
  return checkIns;
}

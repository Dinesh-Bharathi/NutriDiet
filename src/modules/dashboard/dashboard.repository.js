import prisma from '../../lib/prisma.js';

export const dashboardRepository = {
  async getKpis(tenantId) {
    const [
      totalClients,
      activeClients,
      pendingReviews,
      activeDietPlans,
      pendingCheckIns,
      activeRiskFlags,
    ] = await Promise.all([
      prisma.client.count({ where: { tenantId, deletedAt: null } }),
      prisma.client.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
      prisma.clientCheckIn.count({
        where: { tenantId, status: 'SUBMITTED', deletedAt: null },
      }),
      prisma.dietPlan.count({
        where: { tenantId, status: 'ACTIVE', deletedAt: null },
      }),
      prisma.clientCheckIn.count({
        where: { tenantId, status: 'SUBMITTED', deletedAt: null },
      }),
      prisma.clientRiskFlag.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          severity: { in: ['HIGH', 'CRITICAL'] },
          deletedAt: null,
        },
      }),
    ]);

    return {
      totalClients,
      activeClients,
      pendingReviews,
      activeDietPlans,
      checkInsWaiting: pendingCheckIns,
      riskFlagsRequiringAttention: activeRiskFlags,
    };
  },

  async getClientGrowth(tenantId, days) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const clients = await prisma.client.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }

    clients.forEach((c) => {
      const key = c.createdAt.toISOString().slice(0, 10);
      if (buckets[key] !== undefined) buckets[key]++;
    });

    return Object.entries(buckets).map(([date, count]) => ({
      date,
      count,
    }));
  },

  async getAssessmentActivity(tenantId, days) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const assessments = await prisma.assessment.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }

    assessments.forEach((a) => {
      const key = a.createdAt.toISOString().slice(0, 10);
      if (buckets[key] !== undefined) buckets[key]++;
    });

    return Object.entries(buckets).map(([date, count]) => ({
      date,
      count,
    }));
  },

  async getDietPlanActivity(tenantId) {
    const [created, active, completed] = await Promise.all([
      prisma.dietPlan.count({ where: { tenantId, deletedAt: null } }),
      prisma.dietPlan.count({ where: { tenantId, status: 'ACTIVE', deletedAt: null } }),
      prisma.dietPlan.count({ where: { tenantId, status: 'ARCHIVED', deletedAt: null } }),
    ]);

    return [
      { name: 'Created', value: created },
      { name: 'Active', value: active },
      { name: 'Completed', value: completed },
    ];
  },

  async getCheckInActivity(tenantId, days) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const checkIns = await prisma.clientCheckIn.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: since } },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, submitted: 0, pending: 0, reviewed: 0 };
    }

    checkIns.forEach((c) => {
      const key = c.createdAt.toISOString().slice(0, 10);
      if (!buckets[key]) return;
      if (c.status === 'SUBMITTED') buckets[key].submitted++;
      else if (c.status === 'PENDING') buckets[key].pending++;
      else if (c.status === 'REVIEWED') buckets[key].reviewed++;
    });

    return Object.values(buckets);
  },

  async getGoalDistribution(tenantId) {
    const goals = await prisma.clientGoalProfile.groupBy({
      by: ['goalType'],
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      _count: { goalType: true },
    });

    const labelMap = {
      WEIGHT_LOSS: 'Weight Loss',
      WEIGHT_GAIN: 'Weight Gain',
      MAINTENANCE: 'Maintenance',
      MUSCLE_GAIN: 'Muscle Gain',
      PERFORMANCE: 'Performance',
      MEDICAL_NUTRITION: 'Medical Nutrition',
      GENERAL_WELLNESS: 'General Wellness',
      CUSTOM: 'Custom',
    };

    return goals.map((g) => ({
      name: labelMap[g.goalType] || g.goalType,
      value: g._count.goalType,
    }));
  },

  async getActionCenterItems(tenantId, userId) {
    const [pendingReviews, overdueCheckIns, highRiskClients, missingAssessments, upcomingFollowUps] =
      await Promise.all([
        // Pending Reviews — SUBMITTED check-ins with client info
        prisma.clientCheckIn.findMany({
          where: { tenantId, status: 'SUBMITTED', deletedAt: null },
          select: {
            id: true,
            checkInDate: true,
            submittedAt: true,
            client: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 10,
        }),

        // Overdue Check-ins — check-ins more than 7 days old still PENDING
        prisma.clientCheckIn.findMany({
          where: {
            tenantId,
            status: 'PENDING',
            checkInDate: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            deletedAt: null,
          },
          select: {
            id: true,
            checkInDate: true,
            client: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { checkInDate: 'asc' },
          take: 10,
        }),

        // High Risk Clients — clients with ACTIVE HIGH/CRITICAL risk flags
        prisma.clientRiskFlag.findMany({
          where: {
            tenantId,
            status: 'ACTIVE',
            severity: { in: ['HIGH', 'CRITICAL'] },
            deletedAt: null,
          },
          select: {
            id: true,
            severity: true,
            flagType: true,
            reason: true,
            client: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { generatedAt: 'desc' },
          take: 10,
        }),

        // Missing Assessments — clients without any assessment
        prisma.client.findMany({
          where: {
            tenantId,
            deletedAt: null,
            assessments: { none: { deletedAt: null } },
          },
          select: { id: true, firstName: true, lastName: true },
          take: 10,
        }),

        // Upcoming Follow-Ups — check-ins with requiresFollowUp flag
        prisma.clientCheckIn.findMany({
          where: {
            tenantId,
            requiresFollowUp: true,
            status: { not: 'REVIEWED' },
            deletedAt: null,
          },
          select: {
            id: true,
            checkInDate: true,
            client: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { checkInDate: 'asc' },
          take: 10,
        }),
      ]);

    return {
      pendingReviews: pendingReviews.map((item) => ({
        id: item.id,
        clientId: item.client.id,
        clientName: `${item.client.firstName} ${item.client.lastName}`,
        checkInDate: item.checkInDate,
        submittedAt: item.submittedAt,
      })),
      overdueCheckIns: overdueCheckIns.map((item) => ({
        id: item.id,
        clientId: item.client.id,
        clientName: `${item.client.firstName} ${item.client.lastName}`,
        checkInDate: item.checkInDate,
      })),
      highRiskClients: highRiskClients.map((item) => ({
        id: item.id,
        clientId: item.client.id,
        clientName: `${item.client.firstName} ${item.client.lastName}`,
        severity: item.severity,
        flagType: item.flagType,
        reason: item.reason,
      })),
      missingAssessments: missingAssessments.map((c) => ({
        clientId: c.id,
        clientName: `${c.firstName} ${c.lastName}`,
      })),
      upcomingFollowUps: upcomingFollowUps.map((item) => ({
        id: item.id,
        clientId: item.client.id,
        clientName: `${item.client.firstName} ${item.client.lastName}`,
        checkInDate: item.checkInDate,
      })),
    };
  },
};

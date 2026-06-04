import { clientService } from './client.service.js';
import { clinicalProfileRepository } from '../assessments/clinical-profile.repository.js';
import { checkInRepository } from '../check-ins/check-in.repository.js';
import { progressService } from '../progress/progress.service.js';
import prisma from '../../lib/prisma.js';

export const clientOverviewController = {
  async getOverview(req, res) {
    const { tenantId } = req.user;
    const { clientId } = req.params;

    // 1. Fetch Client
    const client = await clientService.getClientById(tenantId, clientId);

    // 2. Fetch Latest Anthropometrics
    const profile = await clinicalProfileRepository.findProfileByClient(tenantId, clientId);
    const latestAnthro = profile
      ? await clinicalProfileRepository.getLatestAnthropometricRecord(tenantId, profile.id)
      : null;

    // 3. Fetch Active Goal
    const activeGoal = profile
      ? await prisma.clientGoalProfile.findFirst({
          where: { tenantId, clientId, profileId: profile.id, status: 'ACTIVE', deletedAt: null },
          orderBy: { createdAt: 'desc' }
        })
      : null;

    // 4. Fetch Latest Check-In
    const latestCheckIn = await prisma.clientCheckIn.findFirst({
      where: { tenantId, clientId, deletedAt: null },
      orderBy: { checkInDate: 'desc' },
      select: { id: true, checkInDate: true, status: true, weightKg: true, waistCm: true }
    });

    // 5. Fetch Progress Summary (deltas)
    const progressSummary = await progressService.getClientProgressSummary(tenantId, clientId);

    // 6. Calculate Readiness & Completion (Mock logic based on section statuses)
    let completionPercentage = 0;
    if (profile) {
      const sections = await clinicalProfileRepository.getSectionStatuses(tenantId, profile.id);
      const completedCount = sections.filter(s => s.status === 'COMPLETED').length;
      completionPercentage = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;
    }

    // 7. Fetch Activity Timeline
    const checkInsTimeline = await prisma.clientCheckIn.findMany({
      where: { tenantId, clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, createdAt: true, status: true }
    });

    const timeline = [
      ...checkInsTimeline.map(ci => ({
        type: 'CHECK_IN',
        date: ci.createdAt,
        description: `Check-in ${ci.status.toLowerCase()}`
      }))
    ].sort((a, b) => b.date - a.date).slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        client: {
          id: client.id,
          fullName: client.fullName,
          avatar: client.avatarAssetId
            ? {
                id: client.avatarAssetId,
                visibility: "PROTECTED",
                hasAvatar: true,
              }
            : null,
          status: client.status,
          onboardingStatus: client.onboardingStatus,
          dateOfBirth: client.dateOfBirth,
          gender: client.gender,
        },
        currentMetrics: latestAnthro ? {
          weightKg: latestAnthro.weightKg,
          bmi: latestAnthro.bmi,
          waistCm: latestAnthro.waistCm,
          measuredAt: latestAnthro.measuredAt,
        } : null,
        activeGoal: activeGoal ? {
          goalType: activeGoal.goalType,
          targetWeightKg: activeGoal.targetWeightKg,
        } : null,
        latestCheckIn: latestCheckIn ? {
          id: latestCheckIn.id,
          date: latestCheckIn.checkInDate,
          status: latestCheckIn.status
        } : null,
        assignedPractitioner: client.dietitian ? {
          id: client.dietitian.id,
          name: client.dietitian.fullName,
        } : null,
        progressSummary: {
          weightChange: progressSummary?.weightChange ?? null,
          waistChange: progressSummary?.waistChange ?? null,
        },
        readiness: {
          score: completionPercentage,
          status: completionPercentage === 100 ? 'READY' : 'INCOMPLETE'
        },
        completion: {
          percentage: completionPercentage
        },
        activityTimeline: timeline,
      }
    });
  }
};

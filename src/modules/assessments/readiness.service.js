// src/modules/assessments/readiness.service.js
import { clinicalProfileRepository } from './clinical-profile.repository.js';

export const readinessService = {
  /**
   * Calculates the readiness score dynamically.
   */
  async calculateReadinessScore(tenantId, profile) {
    if (!profile) return 0;
    
    // Fetch related records
    const [
      anthropometrics,
      goals,
      ,
      labResults,
      riskFlags,
    ] = await Promise.all([
      clinicalProfileRepository.getAnthropometricRecords(tenantId, profile.id),
      clinicalProfileRepository.getGoalProfiles(tenantId, profile.id),
      clinicalProfileRepository.getLifestyleProfile(tenantId, profile.id),
      clinicalProfileRepository.getLabResults(tenantId, profile.id),
      clinicalProfileRepository.getRiskFlags(tenantId, profile.id),
    ]);

    // Profile Completeness
    const sectionStatuses = profile.sectionStatuses || [];
    const completedSections = sectionStatuses.filter(s => s.status === 'COMPLETED').length;
    const completion = Math.round((completedSections / 4) * 100);

    // Active Goal
    const activeGoal = goals.find(g => g.status === 'ACTIVE');

    // Risks
    const activeRisks = riskFlags.filter(r => ['ACTIVE', 'ACKNOWLEDGED'].includes(r.status));
    const criticalRisks = activeRisks.filter(r => ['HIGH', 'CRITICAL'].includes(r.severity));

    // Abnormal Labs
    const abnormalLabs = labResults.filter(l => l.isAbnormal);

    // Stale penalty
    let stalePenalty = 10;
    const latestAnthro = anthropometrics[0] || null;
    if (latestAnthro?.measuredAt) {
      const daysOld = Math.floor((new Date().getTime() - new Date(latestAnthro.measuredAt).getTime()) / 86400000);
      stalePenalty = Math.max(0, daysOld - 30) > 0 ? 8 : 0;
    }

    const readiness = 55 
      + (completion * 0.25) 
      + (activeGoal ? 8 : -6) 
      - (activeRisks.length * 5) 
      - (criticalRisks.length * 8) 
      - (abnormalLabs.length * 3) 
      - stalePenalty;

    return Math.max(0, Math.min(100, Math.round(readiness)));
  }
};

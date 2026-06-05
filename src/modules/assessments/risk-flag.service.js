// src/modules/assessments/risk-flag.service.js
import ApiError from '../../utils/ApiError.js';
import prisma from '../../lib/prisma.js';

export const riskFlagService = {
  /**
   * Generates a new system risk flag or updates an existing one if unresolved.
   */
  async generateSystemRisk(tenantId, clientId, profileId, data) {
    const { type: flagType, severity, reason, sourceDomain, sourceRecordId } = data;
    
    // Check if an active/acknowledged flag of the same type and source exists
    const existing = await prisma.clientRiskFlag.findFirst({
      where: {
        tenantId,
        clientId,
        profileId,
        flagType,
        sourceDomain,
        sourceRecordId,
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
        deletedAt: null,
      }
    });

    if (existing) {
      // If severity increased or reason changed, update it
      if (existing.severity !== severity || existing.reason !== reason) {
        return prisma.clientRiskFlag.update({
          where: { id: existing.id },
          data: { severity, reason, updatedAt: new Date() }
        });
      }
      return existing;
    }

    return prisma.clientRiskFlag.create({
      data: {
        tenantId,
        clientId,
        profileId,
        flagType,
        severity,
        reason,
        sourceDomain,
        sourceRecordId,
        status: 'ACTIVE',
      }
    });
  },

  async acknowledgeRisk(tenantId, id, userId) {
    const existing = await prisma.clientRiskFlag.findFirst({
      where: { id, tenantId, deletedAt: null }
    });
    
    if (!existing) throw ApiError.notFound('Risk Flag');
    
    return prisma.clientRiskFlag.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        resolvedBy: userId,
        resolvedAt: new Date(),
      }
    });
  },

  async resolveRisk(tenantId, id, userId, resolutionNote) {
    const existing = await prisma.clientRiskFlag.findFirst({
      where: { id, tenantId, deletedAt: null }
    });
    
    if (!existing) throw ApiError.notFound('Risk Flag');
    
    return prisma.clientRiskFlag.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNote,
      }
    });
  }
};

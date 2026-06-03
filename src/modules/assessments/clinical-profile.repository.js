import prisma from '../../lib/prisma.js';
import { ASSESSMENT_SECTIONS, SECTION_STATUS } from './clinical-profile.constants.js';

const profileInclude = {
  createdBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
};

export const clinicalProfileRepository = {
  async findClient(tenantId, clientId) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
  },

  async findLatestAssessment(tenantId, clientId) {
    return prisma.assessment.findFirst({
      where: { tenantId, clientId, deletedAt: null },
      orderBy: { assessmentDate: 'desc' },
    });
  },

  async findAssessmentById(tenantId, assessmentId, clientId = undefined) {
    if (!assessmentId) return null;
    const where = { id: assessmentId, tenantId, deletedAt: null };
    if (clientId) where.clientId = clientId;

    return prisma.assessment.findFirst({
      where,
    });
  },

  async findProfileByClient(tenantId, clientId) {
    return prisma.clientClinicalProfile.findFirst({
      where: { tenantId, clientId, deletedAt: null },
      include: profileInclude,
    });
  },

  async createProfile(tenantId, clientId, createdById, data = {}) {
    return prisma.clientClinicalProfile.create({
      data: {
        tenantId,
        clientId,
        createdById,
        latestAssessmentId: data.latestAssessmentId ?? null,
        summaryNotes: data.summaryNotes ?? null,
        sectionStatuses: {
          create: Object.values(ASSESSMENT_SECTIONS).map((section) => ({
            tenantId,
            clientId,
            assessmentId: data.latestAssessmentId ?? null,
            section,
            status: SECTION_STATUS.DRAFT,
          })),
        },
      },
      include: profileInclude,
    });
  },

  async updateProfile(tenantId, profileId, data) {
    const result = await prisma.clientClinicalProfile.updateMany({
      where: { id: profileId, tenantId, deletedAt: null },
      data,
    });

    if (result.count === 0) return null;

    return prisma.clientClinicalProfile.findFirst({
      where: { id: profileId, tenantId, deletedAt: null },
      include: profileInclude,
    });
  },

  async upsertSectionStatus(tenantId, profile, section, status, completedById, assessmentId) {
    return prisma.assessmentSectionStatus.upsert({
      where: {
        tenantId_profileId_section: {
          tenantId,
          profileId: profile.id,
          section,
        },
      },
      create: {
        tenantId,
        clientId: profile.clientId,
        profileId: profile.id,
        assessmentId: assessmentId ?? profile.latestAssessmentId,
        section,
        status,
        completedById: status === SECTION_STATUS.COMPLETED ? completedById : null,
        completedAt: status === SECTION_STATUS.COMPLETED ? new Date() : null,
      },
      update: {
        assessmentId: assessmentId ?? profile.latestAssessmentId,
        status,
        completedById: status === SECTION_STATUS.COMPLETED ? completedById : null,
        completedAt: status === SECTION_STATUS.COMPLETED ? new Date() : null,
      },
    });
  },

  async getSectionStatuses(tenantId, profileId) {
    return prisma.assessmentSectionStatus.findMany({
      where: { tenantId, profileId, deletedAt: null },
      orderBy: { section: 'asc' },
    });
  },

  async createAnthropometricRecord(tenantId, profile, data) {
    return prisma.clientAnthropometricRecord.create({
      data: {
        ...data,
        tenantId,
        clientId: profile.clientId,
        profileId: profile.id,
      },
    });
  },

  async getAnthropometricRecords(tenantId, profileId) {
    return prisma.clientAnthropometricRecord.findMany({
      where: { tenantId, profileId, deletedAt: null },
      orderBy: { measuredAt: 'desc' },
    });
  },

  async getLatestAnthropometricRecord(tenantId, profileId) {
    return prisma.clientAnthropometricRecord.findFirst({
      where: { tenantId, profileId, deletedAt: null },
      orderBy: { measuredAt: 'desc' },
    });
  },

  async replaceMedicalHistory(tenantId, profile, data) {
    return prisma.$transaction(async (tx) => {
      const where = { tenantId, profileId: profile.id, deletedAt: null };
      const deletedAt = new Date();

      await Promise.all([
        tx.clientCondition.updateMany({ where, data: { deletedAt } }),
        tx.clientAllergy.updateMany({ where, data: { deletedAt } }),
        tx.clientMedication.updateMany({ where, data: { deletedAt } }),
        tx.clientSupplement.updateMany({ where, data: { deletedAt } }),
        tx.clientDigestiveIssue.updateMany({ where, data: { deletedAt } }),
      ]);

      const common = {
        tenantId,
        clientId: profile.clientId,
        profileId: profile.id,
        assessmentId: data.assessmentId ?? profile.latestAssessmentId,
      };

      const writes = [];

      if ((data.conditions ?? []).length > 0) {
        writes.push(tx.clientCondition.createMany({
          data: data.conditions.map((item) => ({
            ...common,
            name: item.name,
            status: item.status ?? null,
            diagnosedAt: item.diagnosedAt ?? null,
            notes: item.notes ?? null,
          })),
        }));
      }

      if ((data.allergies ?? []).length > 0) {
        writes.push(tx.clientAllergy.createMany({
          data: data.allergies.map((item) => ({
            ...common,
            allergen: item.name,
            reaction: item.reaction ?? null,
            severity: item.severity ?? null,
            notes: item.notes ?? null,
          })),
        }));
      }

      if ((data.medications ?? []).length > 0) {
        writes.push(tx.clientMedication.createMany({
          data: data.medications.map((item) => ({
            ...common,
            name: item.name,
            dosage: item.dosage ?? null,
            frequency: item.frequency ?? null,
            startedAt: item.startedAt ?? null,
            notes: item.notes ?? null,
          })),
        }));
      }

      if ((data.supplements ?? []).length > 0) {
        writes.push(tx.clientSupplement.createMany({
          data: data.supplements.map((item) => ({
            ...common,
            name: item.name,
            dosage: item.dosage ?? null,
            frequency: item.frequency ?? null,
            startedAt: item.startedAt ?? null,
            notes: item.notes ?? null,
          })),
        }));
      }

      if ((data.digestiveIssues ?? []).length > 0) {
        writes.push(tx.clientDigestiveIssue.createMany({
          data: data.digestiveIssues.map((item) => ({
            ...common,
            name: item.name,
            severity: item.severity ?? null,
            triggers: item.triggers ?? null,
            notes: item.notes ?? null,
          })),
        }));
      }

      await Promise.all(writes);
    });
  },

  async getMedicalHistory(tenantId, profileId) {
    const where = { tenantId, profileId, deletedAt: null };
    const [conditions, allergies, medications, supplements, digestiveIssues] = await Promise.all([
      prisma.clientCondition.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.clientAllergy.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.clientMedication.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.clientSupplement.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.clientDigestiveIssue.findMany({ where, orderBy: { createdAt: 'desc' } }),
    ]);

    return { conditions, allergies, medications, supplements, digestiveIssues };
  },

  async upsertLifestyleProfile(tenantId, profile, data) {
    return prisma.clientLifestyleProfile.upsert({
      where: { profileId: profile.id },
      create: {
        ...data,
        tenantId,
        clientId: profile.clientId,
        profileId: profile.id,
      },
      update: data,
    });
  },

  async getLifestyleProfile(tenantId, profileId) {
    return prisma.clientLifestyleProfile.findFirst({
      where: { tenantId, profileId, deletedAt: null },
    });
  },

  async createGoalProfile(tenantId, profile, data, nextVersion) {
    return prisma.clientGoalProfile.create({
      data: {
        ...data,
        tenantId,
        clientId: profile.clientId,
        profileId: profile.id,
        versionNumber: nextVersion,
      },
    });
  },

  async supersedeActiveGoals(tenantId, profileId) {
    return prisma.clientGoalProfile.updateMany({
      where: { tenantId, profileId, status: 'ACTIVE', deletedAt: null },
      data: { status: 'SUPERSEDED', endedAt: new Date() },
    });
  },

  async getGoalProfiles(tenantId, profileId) {
    return prisma.clientGoalProfile.findMany({
      where: { tenantId, profileId, deletedAt: null },
      orderBy: [{ versionNumber: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async countGoalProfiles(tenantId, profileId) {
    return prisma.clientGoalProfile.count({
      where: { tenantId, profileId, deletedAt: null },
    });
  },

  async getLabMarkerDefinitions(tenantId) {
    return prisma.labMarkerDefinition.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [{ tenantId }, { isSystem: true }],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  },

  async createLabMarkerDefinition(tenantId, data) {
    return prisma.labMarkerDefinition.create({
      data: {
        ...data,
        tenantId,
        isSystem: false,
      },
    });
  },

  async createLabResult(tenantId, profile, data) {
    return prisma.clientLabResult.create({
      data: {
        ...data,
        tenantId,
        clientId: profile.clientId,
        profileId: profile.id,
      },
    });
  },

  async getLabResults(tenantId, profileId) {
    return prisma.clientLabResult.findMany({
      where: { tenantId, profileId, deletedAt: null },
      orderBy: [{ resultDate: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async getRiskFlags(tenantId, profileId) {
    return prisma.clientRiskFlag.findMany({
      where: { tenantId, profileId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { generatedAt: 'desc' }],
    });
  },

  async updateRiskFlagStatus(tenantId, riskFlagId, status) {
    const now = new Date();
    const data = { status };
    if (status === 'ACKNOWLEDGED') data.acknowledgedAt = now;
    if (status === 'RESOLVED' || status === 'DISMISSED') data.resolvedAt = now;

    const result = await prisma.clientRiskFlag.updateMany({
      where: { id: riskFlagId, tenantId, deletedAt: null },
      data,
    });

    return result.count;
  },

  async createSnapshot(tenantId, profile, generatedById, snapshot, sourceUpdatedAt) {
    const latest = await prisma.assessmentSnapshot.findFirst({
      where: { tenantId, clientId: profile.clientId },
      orderBy: { version: 'desc' },
    });

    return prisma.assessmentSnapshot.create({
      data: {
        tenantId,
        clientId: profile.clientId,
        profileId: profile.id,
        assessmentId: profile.latestAssessmentId,
        version: latest ? latest.version + 1 : 1,
        snapshot,
        sourceUpdatedAt,
        generatedById,
      },
    });
  },

  async findSnapshotsByClient(tenantId, clientId) {
    return prisma.assessmentSnapshot.findMany({
      where: { tenantId, clientId },
      orderBy: [{ version: 'desc' }],
      include: {
        generatedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  },

  async findSnapshotById(tenantId, clientId, snapshotId) {
    return prisma.assessmentSnapshot.findFirst({
      where: { tenantId, clientId, id: snapshotId },
      include: {
        generatedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  },

  async getLatestSnapshot(tenantId, profileId) {
    return prisma.assessmentSnapshot.findFirst({
      where: { tenantId, profileId },
      orderBy: { version: 'desc' },
    });
  },



  async getSnapshotParts(tenantId, profile) {
    const [
      sectionStatuses,
      latestAnthropometrics,
      medicalHistory,
      lifestyle,
      goals,
      labResults,
      riskFlags,
      latestSnapshot,
    ] = await Promise.all([
      this.getSectionStatuses(tenantId, profile.id),
      this.getLatestAnthropometricRecord(tenantId, profile.id),
      this.getMedicalHistory(tenantId, profile.id),
      this.getLifestyleProfile(tenantId, profile.id),
      this.getGoalProfiles(tenantId, profile.id),
      this.getLabResults(tenantId, profile.id),
      this.getRiskFlags(tenantId, profile.id),
      this.getLatestSnapshot(tenantId, profile.id),
    ]);

    return {
      sectionStatuses,
      latestAnthropometrics,
      medicalHistory,
      lifestyle,
      goals,
      labResults,
      riskFlags,
      latestSnapshot,
    };
  },
};

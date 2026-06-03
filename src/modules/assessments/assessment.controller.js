// src/modules/assessments/assessment.controller.js
// Client assessment HTTP adapter endpoints.
import { assessmentService } from "./assessment.service.js";
import { mapAssessment, mapAssessmentsList } from "./assessment.mapper.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../config/constants.js";

export const assessmentController = {
  /**
   * POST /api/v1/clients/:clientId/assessments
   * Creates a new assessment for a client.
   */
  async createAssessment(req, res) {
    const tenantId = req.user.tenantId;
    const creatorId = req.user.userId;
    const { clientId } = req.params;
    console.log("============================");
    console.log("tenantId 1", tenantId);
    console.log("============================");

    const assessment = await assessmentService.createAssessment(
      tenantId,
      clientId,
      creatorId,
      req.body,
    );

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      "Assessment created successfully",
      { assessment: mapAssessment(assessment) },
    );
  },

  /**
   * GET /api/v1/clients/:clientId/assessments
   * Lists all assessments for a client (paginated).
   */
  async getClientAssessments(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await assessmentService.getClientAssessments(
      tenantId,
      clientId,
      pagination,
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "Assessments retrieved successfully",
      {
        assessments: mapAssessmentsList(result.assessments),
        pagination: result.pagination,
      },
    );
  },

  /**
   * GET /api/v1/assessments/:id
   * Retrieves details of a specific assessment.
   */
  async getAssessmentById(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const assessment = await assessmentService.getAssessmentById(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "Assessment retrieved successfully",
      { assessment: mapAssessment(assessment) },
    );
  },

  /**
   * PATCH /api/v1/assessments/:id
   * Updates an existing assessment.
   */
  async updateAssessment(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const assessment = await assessmentService.updateAssessment(
      tenantId,
      id,
      req.body,
    );

    return sendSuccess(res, HTTP_STATUS.OK, "Assessment updated successfully", {
      assessment: mapAssessment(assessment),
    });
  },

  /**
   * DELETE /api/v1/assessments/:id
   * Soft-deletes a client assessment.
   */
  async deleteAssessment(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    await assessmentService.deleteAssessment(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, "Assessment deleted successfully");
  },
};

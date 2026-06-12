import { userService } from "./user.service.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../config/constants.js";

export const userController = {
  /**
   * Fetch a paginated and filtered directory of users in the active tenant.
   */
  async getDirectory(req, res) {
    const tenantId = req.user.tenantId;
    const result = await userService.getDirectory(tenantId, req.query);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "Users retrieved successfully",
      result,
    );
  },

  /**
   * Create a new staff user.
   */
  async createUser(req, res) {
    const tenantId = req.user.tenantId;
    const result = await userService.createUser(tenantId, req.body, req);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      "User created successfully",
      result,
    );
  },

  /**
   * Update a user's role.
   */
  async updateRole(req, res) {
    const tenantId = req.user.tenantId;
    const targetUserId = req.params.id;
    const { role } = req.body;

    const result = await userService.updateRole(tenantId, targetUserId, role, req);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "User role updated successfully",
      result,
    );
  },

  /**
   * Update a user's status.
   */
  async updateStatus(req, res) {
    const tenantId = req.user.tenantId;
    const targetUserId = req.params.id;
    const { status } = req.body;

    const result = await userService.updateStatus(tenantId, targetUserId, status, req);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "User status updated successfully",
      result,
    );
  },

  /**
   * Change a user's password.
   */
  async changePassword(req, res) {
    const tenantId = req.user.tenantId;
    const targetUserId = req.params.id;
    const { password } = req.body;

    const result = await userService.changePassword(tenantId, targetUserId, password, req);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "User password reset successfully",
      result,
    );
  },

  /**
   * Fetch a single user by ID.
   */
  async getUser(req, res) {
    const tenantId = req.user.tenantId;
    const targetUserId = req.params.id;

    const result = await userService.getUser(tenantId, targetUserId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "User retrieved successfully",
      result,
    );
  },

  /**
   * Update a user's general details.
   */
  async updateUser(req, res) {
    const tenantId = req.user.tenantId;
    const targetUserId = req.params.id;

    const result = await userService.updateUser(tenantId, targetUserId, req.body, req);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "User updated successfully",
      result,
    );
  },
};

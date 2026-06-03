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
};

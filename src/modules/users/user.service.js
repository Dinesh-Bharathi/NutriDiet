import { userRepository } from './user.repository.js';
import { UserMapper } from './user.mapper.js';

export const userService = {
  /**
   * Fetch a paginated and filtered list of users for a given tenant.
   * @param {string} tenantId 
   * @param {Object} queryOptions 
   */
  async getDirectory(tenantId, queryOptions) {
    const { users, total } = await userRepository.findUsersByTenant(tenantId, queryOptions);
    
    return {
      users: users.map(UserMapper.toDTO),
      pagination: {
        total,
        page: queryOptions.page,
        limit: queryOptions.limit,
        totalPages: Math.ceil(total / queryOptions.limit)
      }
    };
  }
};

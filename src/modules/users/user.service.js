import { userRepository } from './user.repository.js';
import { UserMapper } from './user.mapper.js';
import { ROLES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import { auditLogger } from '../../utils/audit-logger.js';
import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

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
  },

  /**
   * Create a new staff user.
   * Scopes to tenant and checks for duplicate emails and role boundaries.
   */
  async createUser(tenantId, dto, req) {
    const { email, firstName, lastName, role, password } = dto;
    const actorRole = req.user.role;

    // 1. Privilege Escalation Prevention:
    // Only OWNER can create OWNER or ADMIN roles.
    if (actorRole === ROLES.ADMIN && (role === ROLES.OWNER || role === ROLES.ADMIN)) {
      throw ApiError.forbidden("Privilege escalation: Admins cannot create Owner or Admin accounts.");
    }

    // 2. Email uniqueness check within tenant
    const existingUser = await userRepository.findByEmail(tenantId, email);
    if (existingUser) {
      throw ApiError.conflict("A user with this email address already exists in the organization.");
    }

    // 3. Hash password using Argon2id
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

    // 4. Create user record
    const user = await userRepository.create({
      email,
      firstName,
      lastName,
      role,
      passwordHash,
      status: 'ACTIVE', // Default status to active for direct creation
    }, tenantId);

    // 5. Audit Logging
    auditLogger.logSecurityEvent(req, {
      event: 'USER_CREATED',
      targetUserId: user.id,
      metadata: { role }
    });

    return UserMapper.toDTO(user);
  },

  /**
   * Update a user's role.
   * Enforces the role transitions matrix, prevents self-role updates, and guards last Owner.
   */
  async updateRole(tenantId, targetUserId, newRole, req) {
    const actorRole = req.user.role;
    const actorId = req.user.userId;

    // 1. Guard: Cannot modify self (OWNER may change their own role; last-owner check below prevents bad outcomes)
    if (actorId === targetUserId && actorRole !== ROLES.OWNER) {
      throw ApiError.forbidden("You cannot modify your own role.");
    }

    const targetUser = await userRepository.findById(targetUserId, tenantId);
    if (!targetUser) {
      throw ApiError.notFound("User not found.");
    }

    // 2. Enforce Allowed Transitions Matrix
    // Owner checks:
    if (targetUser.role === ROLES.OWNER && actorRole !== ROLES.OWNER) {
      throw ApiError.forbidden("Only Owners can modify Owner accounts.");
    }

    // Admin checks:
    if (targetUser.role === ROLES.ADMIN && actorRole !== ROLES.OWNER) {
      throw ApiError.forbidden("Only Owners can modify Admin accounts.");
    }

    // Admin cannot escalate anyone to ADMIN or OWNER
    if (actorRole === ROLES.ADMIN && (newRole === ROLES.OWNER || newRole === ROLES.ADMIN)) {
      throw ApiError.forbidden("Admins cannot escalate users to Admin or Owner roles.");
    }

    // 3. Last Owner Safeguard:
    // If target is OWNER and we are demoting them, make sure we have other Owners
    if (targetUser.role === ROLES.OWNER && newRole !== ROLES.OWNER) {
      const ownerCount = await userRepository.countOwners(tenantId);
      if (ownerCount <= 1) {
        throw ApiError.badRequest("Cannot demote the last Owner of the organization.");
      }
    }

    // 4. Perform Update
    const updatedUser = await userRepository.updateRole(targetUserId, newRole, tenantId);

    // 5. Audit Logging
    auditLogger.logSecurityEvent(req, {
      event: 'USER_ROLE_CHANGED',
      targetUserId,
      metadata: {
        oldRole: targetUser.role,
        newRole
      }
    });

    return UserMapper.toDTO(updatedUser);
  },

  /**
   * Update a user's status (ACTIVE, INACTIVE, BANNED, PENDING).
   * Enforces security boundaries, prevents self-suspension, guards last Owner, and invalidates sessions.
   */
  async updateStatus(tenantId, targetUserId, newStatus, req) {
    const actorRole = req.user.role;
    const actorId = req.user.userId;

    // 1. Guard: Cannot modify self
    if (actorId === targetUserId) {
      throw ApiError.forbidden("You cannot modify your own status.");
    }

    const targetUser = await userRepository.findById(targetUserId, tenantId);
    if (!targetUser) {
      throw ApiError.notFound("User not found.");
    }

    // 2. Privilege Escalation Prevention
    if (targetUser.role === ROLES.OWNER && actorRole !== ROLES.OWNER) {
      throw ApiError.forbidden("Only Owners can modify Owner accounts.");
    }

    if (targetUser.role === ROLES.ADMIN && actorRole !== ROLES.OWNER) {
      throw ApiError.forbidden("Only Owners can modify Admin accounts.");
    }

    // 3. Last Owner Safeguard:
    // Cannot suspend the last Owner
    if (targetUser.role === ROLES.OWNER && newStatus !== 'ACTIVE') {
      const ownerCount = await userRepository.countOwners(tenantId);
      if (ownerCount <= 1) {
        throw ApiError.badRequest("Cannot suspend or deactivate the last Owner of the organization.");
      }
    }

    // 4. Perform Update
    const updatedUser = await userRepository.updateStatus(targetUserId, newStatus, tenantId);

    // 5. Session Revocation:
    // If user is suspended (INACTIVE / BANNED), nuke all active refresh tokens immediately
    if (newStatus === 'INACTIVE' || newStatus === 'BANNED') {
      await userRepository.revokeSessions(targetUserId);
    }

    // 6. Audit Logging
    auditLogger.logSecurityEvent(req, {
      event: 'USER_STATUS_CHANGED',
      targetUserId,
      metadata: {
        oldStatus: targetUser.status,
        newStatus
      }
    });

    return UserMapper.toDTO(updatedUser);
  },

  /**
   * Reset a user's password directly.
   * Enforces security boundaries, prevents self-mutation, hashes password, and invalidates active sessions.
   */
  async changePassword(tenantId, targetUserId, newPassword, req) {
    const actorRole = req.user.role;
    const actorId = req.user.userId;

    // 1. Guard: Cannot change self password via admin settings
    if (actorId === targetUserId) {
      throw ApiError.forbidden("You cannot change your own password via the administrator settings. Please use the profile settings.");
    }

    const targetUser = await userRepository.findById(targetUserId, tenantId);
    if (!targetUser) {
      throw ApiError.notFound("User not found.");
    }

    // 2. Privilege Escalation Prevention
    if (targetUser.role === ROLES.OWNER && actorRole !== ROLES.OWNER) {
      throw ApiError.forbidden("Only Owners can modify Owner accounts.");
    }

    if (targetUser.role === ROLES.ADMIN && actorRole !== ROLES.OWNER) {
      throw ApiError.forbidden("Only Owners can modify Admin accounts.");
    }

    // 3. Hash password with Argon2id
    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    // 4. Perform Update
    const updatedUser = await userRepository.updatePassword(targetUserId, passwordHash, tenantId);

    // 5. Session Revocation
    // Force user to log in again with new password
    await userRepository.revokeSessions(targetUserId);

    // 6. Audit Logging
    auditLogger.logSecurityEvent(req, {
      event: 'USER_PASSWORD_RESET',
      targetUserId
    });

    return UserMapper.toDTO(updatedUser);
  },

  /**
   * Fetch a single user by ID scoped to tenant.
   * @param {string} tenantId
   * @param {string} id
   */
  async getUser(tenantId, id) {
    const user = await userRepository.findById(id, tenantId);
    if (!user) {
      throw ApiError.notFound("User not found.");
    }
    return UserMapper.toDTO(user);
  },

  /**
   * Update general details or status of a user scoped to tenant.
   * @param {string} tenantId
   * @param {string} targetUserId
   * @param {Object} dto
   * @param {Object} req
   */
  async updateUser(tenantId, targetUserId, dto, req) {
    const actorRole = req.user.role;
    const actorId = req.user.userId;

    const targetUser = await userRepository.findById(targetUserId, tenantId);
    if (!targetUser) {
      throw ApiError.notFound("User not found.");
    }

    // Privilege Boundaries:
    if (actorRole === ROLES.ADMIN) {
      if (targetUser.role === ROLES.OWNER) {
        throw ApiError.forbidden("Admins cannot modify Owner accounts.");
      }
      if (targetUser.role === ROLES.ADMIN && actorId !== targetUserId) {
        throw ApiError.forbidden("Admins cannot modify other Admin accounts.");
      }
    }

    const updates = {};

    // 1. Name Updates
    if (dto.firstName !== undefined) updates.firstName = dto.firstName;
    if (dto.lastName !== undefined) updates.lastName = dto.lastName;

    // 2. Email updates with uniqueness checks
    if (dto.email && dto.email !== targetUser.email) {
      const existingUser = await userRepository.findByEmail(tenantId, dto.email);
      if (existingUser) {
        throw ApiError.conflict("A user with this email address already exists in the organization.");
      }
      updates.email = dto.email;
    }

    // 3. Avatar URL Updates
    if (dto.avatarUrl !== undefined) updates.avatarUrl = dto.avatarUrl;

    // 4. Status updates with security guards (matches updateStatus logic)
    if (dto.status && dto.status !== targetUser.status) {
      if (actorId === targetUserId) {
        throw ApiError.forbidden("You cannot modify your own status.");
      }

      // Privilege boundaries
      if (targetUser.role === ROLES.OWNER && actorRole !== ROLES.OWNER) {
        throw ApiError.forbidden("Only Owners can modify Owner accounts.");
      }
      if (targetUser.role === ROLES.ADMIN && actorRole !== ROLES.OWNER) {
        throw ApiError.forbidden("Only Owners can modify Admin accounts.");
      }

      // Last Owner safeguard
      if (targetUser.role === ROLES.OWNER && dto.status !== "ACTIVE") {
        const ownerCount = await userRepository.countOwners(tenantId);
        if (ownerCount <= 1) {
          throw ApiError.badRequest("Cannot suspend or deactivate the last Owner of the organization.");
        }
      }

      updates.status = dto.status;
    }

    if (Object.keys(updates).length === 0) {
      return UserMapper.toDTO(targetUser);
    }

    // Perform Update
    const updatedUser = await userRepository.update(targetUserId, updates, tenantId);

    // Session Revocation if user is deactivated or banned
    if (updates.status === "INACTIVE" || updates.status === "BANNED") {
      await userRepository.revokeSessions(targetUserId);
    }

    // Audit Logging
    auditLogger.logSecurityEvent(req, {
      event: "USER_UPDATED",
      targetUserId,
      metadata: {
        updatedFields: Object.keys(updates),
      },
    });

    return UserMapper.toDTO(updatedUser);
  },
};

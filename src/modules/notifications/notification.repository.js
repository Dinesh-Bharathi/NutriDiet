// src/modules/notifications/notification.repository.js
// Database access for Notification operations — strictly tenant and user isolated.
import prisma from '../../lib/prisma.js';

export const notificationRepository = {
  /**
   * Creates a new notification.
   *
   * @param {string} tenantId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(tenantId, data) {
    return prisma.notification.create({
      data: {
        ...data,
        tenantId,
      },
    });
  },

  /**
   * Finds a single notification scoped to tenant and user.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(tenantId, userId, id) {
    return prisma.notification.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
    });
  },

  /**
   * Retrieves a filtered and paginated list of notifications.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {object} filters - { isArchived, isRead, type }
   * @param {object} pagination - { page, limit }
   * @returns {Promise<[Array<object>, number]>}
   */
  async findManyAndCount(tenantId, userId, filters, pagination) {
    const { isArchived, isRead, type } = filters;
    const { page, limit } = pagination;

    const where = {
      tenantId,
      userId,
    };

    if (isArchived !== undefined) {
      where.isArchived = isArchived;
    }

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (type) {
      where.type = type;
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return [notifications, total];
  },

  /**
   * Counts unread and not archived notifications for a specific user.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async countUnread(tenantId, userId) {
    return prisma.notification.count({
      where: {
        tenantId,
        userId,
        isRead: false,
        isArchived: false,
      },
    });
  },

  /**
   * Updates an existing notification.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(tenantId, id, data) {
    return prisma.notification.update({
      where: { id, tenantId },
      data,
    });
  },

  /**
   * Marks all unread notifications for a user as read.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @returns {Promise<object>} Update status
   */
  async markAllRead(tenantId, userId) {
    return prisma.notification.updateMany({
      where: {
        tenantId,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  },

  /**
   * Deletes a notification.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async delete(tenantId, id) {
    return prisma.notification.delete({
      where: { id, tenantId },
    });
  },
};

// src/modules/clients/client.mapper.js
// Client response serialization.

/**
 * Maps a single database client record to an API client resource.
 *
 * @param {object} client
 * @returns {object|null}
 */
export function mapClient(client) {
  if (!client) return null;

  const dto = {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    fullName: `${client.firstName} ${client.lastName}`,
    email: client.email || null,
    phone: client.phone || null,
    gender: client.gender || null,
    dateOfBirth: client.dateOfBirth
      ? client.dateOfBirth.toISOString().split('T')[0]
      : null,
    avatar: client.avatarAssetId
      ? {
          id: client.avatarAssetId,
          visibility: "PROTECTED",
          hasAvatar: true,
        }
      : null,
    notes: client.notes || null,
    status: client.status,
    onboardingStatus: client.onboardingStatus,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    dietitian: client.dietitian
      ? {
          id: client.dietitian.id,
          firstName: client.dietitian.firstName,
          lastName: client.dietitian.lastName,
          fullName: `${client.dietitian.firstName} ${client.dietitian.lastName}`,
          email: client.dietitian.email,
        }
      : null,
  };

  const conv = client.whatsAppConversations?.[0];
  if (conv) {
    dto.latestConversationId = conv.id;
    dto.latestMessageAt = conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null;
    dto.lastMessageText = conv.lastMessageText || null;
    dto.unreadCount = conv.unreadCount || 0;
    dto.isMuted = conv.isMuted || false;
    dto.isArchived = conv.isArchived || false;
    
    // Add additional conversation fields for virtual mapping
    dto.optInStatus = conv.optInStatus || false;
    dto.optInCapturedAt = conv.optInCapturedAt ? conv.optInCapturedAt.toISOString() : null;
    dto.lastInboundAt = conv.lastInboundAt ? conv.lastInboundAt.toISOString() : null;
    dto.lastOutboundAt = conv.lastOutboundAt ? conv.lastOutboundAt.toISOString() : null;
    dto.conversationStartedAt = conv.conversationStartedAt ? conv.conversationStartedAt.toISOString() : null;
    dto.lastClientMessageAt = conv.lastClientMessageAt ? conv.lastClientMessageAt.toISOString() : null;
    dto.lastPractitionerMessageAt = conv.lastPractitionerMessageAt ? conv.lastPractitionerMessageAt.toISOString() : null;
    dto.messagesCount = conv._count?.messages ?? 0;
  }

  if (client.clientPresence) {
    dto.clientPresence = client.clientPresence;
  }

  return dto;
}

/**
 * Maps an array of database client records to API client resources.
 *
 * @param {Array<object>} clients
 * @returns {Array<object>}
 */
export function mapClientsList(clients) {
  return clients.map(mapClient);
}

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

  return {
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

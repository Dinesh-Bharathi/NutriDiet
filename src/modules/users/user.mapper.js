export const UserMapper = {
  toDTO(user) {
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
      email: user.email,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl || null,
      lastLoginAt: user.lastLoginAt || null,
      passwordChangedAt: user.passwordChangedAt || null,
      createdAt: user.createdAt,
    };
  }
};

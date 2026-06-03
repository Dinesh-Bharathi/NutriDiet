export const UserMapper = {
  toDTO(user) {
    if (!user) return null;
    return {
      id: user.id,
      displayName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
      email: user.email,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl || null,
    };
  }
};

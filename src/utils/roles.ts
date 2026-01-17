export type NormalizedRole = 'student' | 'professor' | 'admin';
export type StoredRole = NormalizedRole | 'user';

export function normalizeRole(role: unknown): NormalizedRole {
  if (role === 'admin' || role === 'professor' || role === 'student') return role;
  return 'student';
}

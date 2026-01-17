import { Request, Response, NextFunction } from 'express';
import { normalizeRole } from '../utils/roles';

// allowedRoles is an array like ['professor','admin']
export default function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const role = normalizeRole(user.role);
    if (allowedRoles.includes(role)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

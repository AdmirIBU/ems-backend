import { Request, Response, NextFunction } from 'express';
import { normalizeRole } from '../utils/roles';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ ...user.toObject?.(), role: normalizeRole(user.role) });
  } catch (err) {
    next(err);
  }
};

import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

function validateNewPassword(pw: string): string | null {
  // Policy: min 8, at least 1 letter, 1 number, 1 special char
  if (typeof pw !== 'string' || pw.length < 8) return 'New password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw)) return 'New password must contain at least one letter.';
  if (!/[0-9]/.test(pw)) return 'New password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'New password must contain at least one special character.';
  return null;
}

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    const policyErr = validateNewPassword(newPassword);
    if (policyErr) return res.status(400).json({ error: policyErr });

    const user = await User.findById(userId).exec();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const ok = await user.matchPassword(currentPassword);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

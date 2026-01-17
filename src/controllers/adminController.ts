import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { normalizeRole } from '../utils/roles';

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).exec();
    res.json(
      users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: normalizeRole(u.role),
        createdAt: (u as any).createdAt,
        updatedAt: (u as any).updatedAt,
      }))
    );
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role } = req.body as {
      name: string;
      email: string;
      password: string;
      role: 'student' | 'professor';
    };

    const existing = await User.findOne({ email }).exec();
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const user = new User({ name, email, password, role });
    await user.save();

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      createdAt: (user as any).createdAt,
    });
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body as { role: 'student' | 'professor' | 'admin' };

    const user = await User.findById(req.params.id).exec();
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.role = role;
    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      updatedAt: (user as any).updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

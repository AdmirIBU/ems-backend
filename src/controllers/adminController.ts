import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { normalizeRole } from '../utils/roles';

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hasPaginationParams = req.query.page !== undefined || req.query.limit !== undefined;

    const mapUser = (u: any) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: normalizeRole(u.role),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    });

    if (!hasPaginationParams) {
      const users = await User.find().select('-password').sort({ createdAt: -1 }).exec();
      res.json(users.map(mapUser));
      return;
    }

    const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

    const page = Math.max(1, Number(pageRaw ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitRaw ?? 10) || 10));

    const [total, users] = await Promise.all([
      User.countDocuments().exec(),
      User.find()
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      items: users.map(mapUser),
      total,
      page,
      limit,
      totalPages,
    });
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

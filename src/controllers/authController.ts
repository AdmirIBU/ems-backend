import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import jwt from 'jsonwebtoken';
import { normalizeRole } from '../utils/roles';

const generateToken = (id: string) => jwt.sign({ id }, process.env.JWT_SECRET || '', { expiresIn: '7d' });

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    let user = await User.findOne({ email }).exec();
    if (user) return res.status(400).json({ error: 'User already exists' });

    // Register creates students by default
    user = new User({ name, email, password, role: 'student' });
    await user.save();

    res
      .status(201)
      .json({ token: generateToken(user._id.toString()), user: { id: user._id, email: user.email, name: user.name, role: normalizeRole(user.role) } });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await User.findOne({ email }).exec();
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    res.json({ token: generateToken(user._id.toString()), user: { id: user._id, email: user.email, name: user.name, role: normalizeRole(user.role) } });
  } catch (err) {
    next(err);
  }
};

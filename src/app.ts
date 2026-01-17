import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

import errorHandler from './middleware/errorHandler';

import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import coursesRoutes from './routes/courses';
import examRoutes from './routes/exams';
import adminRoutes from './routes/admin';
import gradesRoutes from './routes/grades';
import studentsRoutes from './routes/students';

export function createApp() {
  const app = express();

  // middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // serve uploaded files (syllabi)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/courses', coursesRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/grades', gradesRoutes);
  app.use('/api/students', studentsRoutes);

  // health check
  app.get('/health', (req: Request, res: Response) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

  app.use(errorHandler);
  return app;
}

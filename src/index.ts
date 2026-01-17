import 'dotenv/config';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db';
import logger from './utils/logger';
import errorHandler from './middleware/errorHandler';

import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import coursesRoutes from './routes/courses';
import examRoutes from './routes/exams';
import adminRoutes from './routes/admin';
import gradesRoutes from './routes/grades';
import studentsRoutes from './routes/students';

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ems';

const app = express();

// connect to DB
connectDB(MONGO_URI);

// middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
// serve uploaded files (syllabi)
app.use('/uploads', express.static(require('path').join(process.cwd(), 'uploads')));

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

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

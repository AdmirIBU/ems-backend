import { Router } from 'express';
import auth from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import { getMyGrades } from '../controllers/gradesController';

const router = Router();

router.get('/', auth, requireRole(['student', 'admin']), getMyGrades);

export default router;

import { Router } from 'express';
import auth from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import { listStudents, lookupStudentByEmail, getStudentReview } from '../controllers/studentReviewController';

const router = Router();

router.get('/', auth, requireRole(['admin', 'professor']), listStudents);
router.get('/lookup', auth, requireRole(['admin', 'professor']), lookupStudentByEmail);
router.get('/:id/review', auth, requireRole(['admin', 'professor']), getStudentReview);

export default router;

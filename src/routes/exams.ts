import { Router } from 'express';
import { body } from 'express-validator';
import auth from '../middleware/auth';
import validate from '../middleware/validateRequest';
import {
  createExam,
  getExams,
  getExam,
  updateExam,
  deleteExam
} from '../controllers/examController';

const router = Router();

router.get('/', getExams);
router.get('/:id', getExam);
router.post('/', auth, [body('title').notEmpty(), body('date').isISO8601()], validate, createExam);
router.put('/:id', auth, updateExam);
router.delete('/:id', auth, deleteExam);

export default router;

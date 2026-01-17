import { Router } from 'express';
import { body } from 'express-validator';
import auth from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import validate from '../middleware/validateRequest';
import attemptUpload from '../middleware/attemptUpload';
import {
  createExam,
  getExams,
  getAvailableExams,
  getMyActiveAttempt,
  getExam,
  publishExam,
  startAttempt,
  getAttempt,
  submitAttempt,
  autosaveAttempt,
  uploadAttemptAnswerImage,
  setExamQuestions,
  updateExam,
  deleteExam
} from '../controllers/examController';
import { getExamResults, getAttemptReview, gradeAttempt, requestAttemptReview, respondToReviewRequest } from '../controllers/resultsController';

const router = Router();

router.get('/', getExams);
router.get('/available', auth, getAvailableExams);
router.get('/active-attempt', auth, requireRole(['student', 'admin']), getMyActiveAttempt);
router.get('/:id', getExam);

router.post(
  '/',
  auth,
  requireRole(['professor', 'admin']),
  [
    body('title').notEmpty(),
    body('date').isISO8601(),
    body('examType').notEmpty(),
    body('numQuestions').isInt({ min: 1 }).toInt(),
    body('courseId').optional().isString(),
    body('questionIds').optional().isArray(),
  ],
  validate,
  createExam
);

router.patch(
  '/:id/questions',
  auth,
  requireRole(['professor', 'admin']),
  [body('questionIds').isArray()],
  validate,
  setExamQuestions
);

router.patch('/:id/publish', auth, requireRole(['professor', 'admin']), publishExam);

// Professor results + review
router.get('/:id/results', auth, requireRole(['professor', 'admin']), getExamResults);
router.get('/attempts/:attemptId/review', auth, requireRole(['professor', 'admin']), getAttemptReview);
router.patch('/attempts/:attemptId/grade', auth, requireRole(['professor', 'admin']), gradeAttempt);
router.patch('/attempts/:attemptId/review-response', auth, requireRole(['professor', 'admin']), respondToReviewRequest);

// Student take-exam flow
router.post('/:id/attempts', auth, requireRole(['student', 'admin']), startAttempt);
router.get('/attempts/:attemptId', auth, requireRole(['student', 'admin']), getAttempt);
router.post('/attempts/:attemptId/request-review', auth, requireRole(['student', 'admin']), requestAttemptReview);
router.patch('/attempts/:attemptId/autosave', auth, requireRole(['student', 'admin']), autosaveAttempt);
router.post(
  '/attempts/:attemptId/questions/:questionId/image',
  auth,
  requireRole(['student', 'admin']),
  attemptUpload.single('image'),
  uploadAttemptAnswerImage
);
router.post('/attempts/:attemptId/submit', auth, requireRole(['student', 'admin']), submitAttempt);

router.put('/:id', auth, requireRole(['professor', 'admin']), updateExam);
router.delete('/:id', auth, requireRole(['professor', 'admin']), deleteExam);

export default router;

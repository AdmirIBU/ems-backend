import { Router } from 'express';
import { body } from 'express-validator';
import auth from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import validate from '../middleware/validateRequest';
import upload from '../middleware/upload';
import courseMaterialsUpload from '../middleware/courseMaterialsUpload';
import {
  getCourses,
  getCourse,
  getMyCourses,
  getMyTeachingCourses,
  getMyCoursesStatus,
  enrollCourse,
  approveEnrollment,
  rejectEnrollment,
  createCourse,
  updateCourse,
  createQuestion,
  getQuestionsForCourse,
  listCourseMaterials,
  uploadCourseMaterial,
  deleteCourseMaterial,
  downloadCourseMaterial,
  setCourseProfessors,
  shareCourseWithProfessors,
} from '../controllers/coursesController';

const router = Router();

router.get('/', getCourses);
router.get('/my', auth, getMyCourses); // protected
router.get('/my-teaching', auth, requireRole(['professor']), getMyTeachingCourses);
router.get('/my-status', auth, getMyCoursesStatus); // protected

// Admin: assign professors to a course
router.put('/:id/professors', auth, requireRole(['admin']), setCourseProfessors);

// Professor: share course with other professors (adds to course.professors)
router.post('/:id/professors/share', auth, requireRole(['professor']), shareCourseWithProfessors);

// Course materials (lectures/labs/videos)
router.get('/:id/materials', auth, requireRole(['student', 'professor', 'admin']), listCourseMaterials);
router.post(
  '/:id/materials',
  auth,
  requireRole(['professor', 'admin']),
  courseMaterialsUpload.single('file'),
  uploadCourseMaterial
);
router.delete('/:id/materials/:materialId', auth, requireRole(['professor', 'admin']), deleteCourseMaterial);
router.get(
  '/:id/materials/:materialId/download',
  auth,
  requireRole(['student', 'professor', 'admin']),
  downloadCourseMaterial
);

router.get('/:id', getCourse);
// Student enrollment request
router.post('/:id/enroll', auth, requireRole(['student', 'admin']), enrollCourse);
router.get('/:id/questions', getQuestionsForCourse);

// Professor manage enrollments
router.post('/:id/enrollments/:studentId/approve', auth, requireRole(['professor', 'admin']), approveEnrollment);
router.post('/:id/enrollments/:studentId/reject', auth, requireRole(['professor', 'admin']), rejectEnrollment);

router.post(
  '/:id/questions',
  auth,
  requireRole(['professor', 'admin']),
  [
    body('type').isIn(['essay', 'multiple-choice', 'tf', 'image-upload']),
    body('content').notEmpty(),
    body('points').optional().isInt({ min: 1 }).toInt(),
    body('options').optional().isArray(),
    body('correctAnswer').optional(),
  ],
  validate,
  createQuestion
);
router.post(
  '/',
  auth,
  requireRole(['professor','admin']),
  upload.single('syllabus'),
  [body('title').notEmpty(), body('courseCode').notEmpty(), body('ects').isInt({ min: 0 }).toInt()],
  validate,
  createCourse
); // create course (auth required)

router.put(
  '/:id',
  auth,
  requireRole(['professor', 'admin']),
  upload.single('syllabus'),
  [
    body('title').optional().notEmpty(),
    body('courseCode').optional().notEmpty(),
    body('ects').optional().isInt({ min: 0 }).toInt(),
  ],
  validate,
  updateCourse
);

export default router; 

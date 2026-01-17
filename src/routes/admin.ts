import { Router } from 'express';
import { body, param } from 'express-validator';
import auth from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import validate from '../middleware/validateRequest';
import { createUser, listUsers, updateUserRole } from '../controllers/adminController';

const router = Router();

// Admin user management
router.get('/users', auth, requireRole(['admin']), listUsers);

router.post(
  '/users',
  auth,
  requireRole(['admin']),
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['student', 'professor']),
  ],
  validate,
  createUser
);

router.patch(
  '/users/:id/role',
  auth,
  requireRole(['admin']),
  [param('id').isString().notEmpty(), body('role').isIn(['student', 'professor', 'admin'])],
  validate,
  updateUserRole
);

export default router;

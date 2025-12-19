import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validateRequest';
import { register, login } from '../controllers/authController';

const router = Router();

router.post(
  '/register',
  [body('name').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6 })],
  validate,
  register
);

router.post('/login', [body('email').isEmail(), body('password').exists()], validate, login);

export default router;

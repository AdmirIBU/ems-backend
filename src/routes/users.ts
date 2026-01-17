import { Router } from 'express';
import auth from '../middleware/auth';
import { getMe } from '../controllers/usersController';
import { body } from 'express-validator';
import validate from '../middleware/validateRequest';
import { changePassword } from '../controllers/passwordController';

const router = Router();

router.get('/me', auth, getMe);

router.post(
	'/change-password',
	auth,
	[body('currentPassword').isString().notEmpty(), body('newPassword').isString().isLength({ min: 8 })],
	validate,
	changePassword
);

export default router;

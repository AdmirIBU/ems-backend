import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validateRequest';
import { login } from '../controllers/authController';

const router = Router();

router.post('/login', [body('email').isEmail(), body('password').exists()], validate, login);

export default router;

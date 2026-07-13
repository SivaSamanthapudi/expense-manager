import { Router } from 'express';
import { body } from 'express-validator';
import {
  signup,
  login,
  logout,
  me,
  refresh,
  relink,
} from '../controllers/auth.controller';
import { verifyAccessToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';

const router = Router();

router.post(
  '/signup',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be 2–50 characters'),
    body('email')
      .optional({ checkFalsy: true })
      .isEmail()
      .normalizeEmail()
      .withMessage('Enter a valid email'),
    body('mobile')
      .optional({ checkFalsy: true })
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Enter a valid 10-digit mobile number'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body().custom((_, { req }) => {
      if (!req.body.email && !req.body.mobile) {
        throw new Error('Either email or mobile number is required');
      }
      return true;
    }),
  ],
  handleValidationErrors,
  signup
);

router.post(
  '/login',
  [
    body('identifier')
      .notEmpty()
      .withMessage('Email or mobile number is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  handleValidationErrors,
  login
);

router.post('/logout', logout);
router.get('/me', verifyAccessToken, me);
router.post('/refresh', refresh);
router.post('/relink', verifyAccessToken, relink);

export default router;

import { Router } from 'express';
import { body } from 'express-validator';
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  getGroupExpenses,
  recordPayment,
  getPayments,
} from '../controllers/group.controller';
import { verifyAccessToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';

const router = Router();

router.use(verifyAccessToken);

router.get('/', getGroups);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Group name required'),
    body('category')
      .optional()
      .isIn(['trip', 'home', 'food', 'other'])
      .withMessage('Invalid category'),
  ],
  handleValidationErrors,
  createGroup
);

router.patch('/:id', updateGroup);
router.delete('/:id', deleteGroup);

router.post(
  '/:groupId/members',
  [
    body('name').trim().notEmpty().withMessage('Member name required'),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Enter a valid email'),
  ],
  handleValidationErrors,
  addMember
);

router.delete('/:groupId/members/:memberId', removeMember);
router.get('/:groupId/expenses', getGroupExpenses);
router.patch('/:groupId/payments', recordPayment);
router.get('/:groupId/payments', getPayments);

export default router;

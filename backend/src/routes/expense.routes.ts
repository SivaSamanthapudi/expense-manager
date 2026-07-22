import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body } from 'express-validator';
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseHistory,
} from '../controllers/expense.controller';
import { verifyAccessToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { receiptUpload } from '../middleware/upload';

const router = Router();

router.use(verifyAccessToken);

router.get('/', getExpenses as RequestHandler);

const wrapUpload = (req: Request, res: Response, next: NextFunction) => {
  receiptUpload(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
};

router.post(
  '/',
  wrapUpload,
  [
    body('groupId').notEmpty().withMessage('groupId required'),
    body('title').trim().notEmpty().withMessage('Title required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('paidBy').notEmpty().withMessage('paidBy required'),
    body('paidByName').notEmpty().withMessage('paidByName required'),
    body('date').isISO8601().withMessage('Valid date required'),
    body('category')
      .optional()
      .isIn(['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'other'])
      .withMessage('Invalid category'),
  ],
  handleValidationErrors,
  createExpense as RequestHandler
);

router.get('/:id/history', getExpenseHistory as RequestHandler);
router.patch('/:id', wrapUpload, updateExpense as RequestHandler);
router.delete('/:id', deleteExpense as RequestHandler);

export default router;

import { Router } from 'express';
import { Response } from 'express';
import { query } from 'express-validator';
import { User } from '../models/User';
import { verifyAccessToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { AuthRequest } from '../middleware/auth';

const router = Router();
router.use(verifyAccessToken);

/**
 * GET /api/users/search?q=<term>
 * Returns up to 10 registered users whose name or email starts with the query term.
 * Excludes the calling user from results.
 */
router.get(
  '/search',
  [
    query('q')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Search term is required'),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string).trim();
      const regex = new RegExp(
        '^' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );

      const users = await User.find({
        _id: { $ne: req.userId },
        $or: [{ name: regex }, { email: regex }],
      })
        .select('name email mobile avatar')
        .limit(10)
        .lean();

      res.json(
        users.map((u) => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email ?? '',
          mobile: u.mobile ?? '',
          avatar: u.avatar,
        }))
      );
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * GET /api/users/lookup?email=...  OR  ?mobile=...
 * Exact-match lookup — used to check if a contact is already registered.
 * Returns { id, name, email, mobile, avatar } or 404.
 */
router.get(
  '/lookup',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { email, mobile } = req.query as {
        email?: string;
        mobile?: string;
      };
      if (!email && !mobile) {
        res.status(400).json({ error: 'email or mobile required' });
        return;
      }
      const query = email
        ? { email: email.trim().toLowerCase() }
        : { mobile: (mobile as string).trim() };

      const user = await User.findOne(query)
        .select('name email mobile avatar')
        .lean();
      if (!user) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({
        id: user._id.toString(),
        name: user.name,
        email: user.email ?? '',
        mobile: user.mobile ?? '',
        avatar: user.avatar,
      });
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;

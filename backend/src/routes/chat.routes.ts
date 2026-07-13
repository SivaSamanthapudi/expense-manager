import { Router } from 'express';
import { verifyAccessToken } from '../middleware/auth';
import { getConversation, markRead } from '../controllers/chat.controller';

const router = Router();

router.get('/conversation/:otherUserId', verifyAccessToken, getConversation);
router.patch('/conversation/:otherUserId/read', verifyAccessToken, markRead);

export default router;

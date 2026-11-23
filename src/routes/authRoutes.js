import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { registerBody, loginBody } from '../validators/schemas.js';

const router = Router();

// 登入/註冊限流：同一 IP 15 分鐘內最多 20 次，降低暴力破解密碼的風險
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: '嘗試次數過多，請稍後再試' },
});

router.post('/register', authLimiter, validate({ body: registerBody }), auth.register);
router.post('/login', authLimiter, validate({ body: loginBody }), auth.login);
router.get('/me', requireAuth, auth.me);

export default router;

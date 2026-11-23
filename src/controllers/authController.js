import { User } from '../models/User.js';
import { signToken } from '../middlewares/auth.js';
import { conflict, unauthorized } from '../utils/AppError.js';

// POST /api/auth/register
export async function register(req, res) {
  const { name, email, password } = req.valid.body;

  if (await User.exists({ email })) throw conflict('此 email 已被註冊');

  // role 明確寫死為 'user'：就算未來有人改了 validator，這裡仍是第二道保險
  const user = await User.create({ name, email, password, role: 'user' });

  res.status(201).json({ success: true, data: { token: signToken(user), user } });
}

// POST /api/auth/login
export async function login(req, res) {
  const { email, password } = req.valid.body;

  const user = await User.findOne({ email }).select('+password');
  // 帳號不存在與密碼錯誤回傳「同一個」訊息，避免攻擊者藉此探測哪些 email 有註冊
  if (!user || !(await user.comparePassword(password))) {
    throw unauthorized('email 或密碼錯誤');
  }

  res.json({ success: true, data: { token: signToken(user), user } });
}

// GET /api/auth/me —— 前端重新整理後用 token 換回使用者資料，確認登入狀態仍有效
export function me(req, res) {
  res.json({ success: true, data: { user: req.user } });
}

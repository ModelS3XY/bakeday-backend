import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { unauthorized, forbidden } from '../utils/AppError.js';

export function signToken(user) {
  // Token 裡只放 user id（sub = subject），不放 role。
  // 理由：role 若寫進 token，管理員被降權後舊 token 仍有效到過期為止；
  // 每次從 DB 讀 role，權限永遠以資料庫為準。
  return jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

// 驗證「你是誰」：檢查 Authorization: Bearer <token>，成功後把 user 掛到 req.user
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw unauthorized('登入已過期或 Token 無效，請重新登入');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('使用者不存在，請重新登入');

  req.user = user;
  next();
}

// 驗證「你能做什麼」：必須放在 requireAuth 之後
export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') throw forbidden('此操作僅限管理員');
  next();
}

import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `找不到路由：${req.method} ${req.originalUrl}` });
}

// Express 5 會自動把 async handler 丟出的錯誤（rejected promise）送到這裡，
// 所以 controller 不需要每支都包 try/catch。
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // 1. 我們自己丟的、可預期的錯誤
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { errors: err.details }),
    });
  }

  // 2. Mongoose schema 驗證失敗（最後一道防線）
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ success: false, message: '資料驗證失敗', errors });
  }

  // 3. 不合法的 ObjectId，例如 /api/products/abc
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, message: `無效的 ${err.path}` });
  }

  // 4. 唯一索引衝突（E11000）
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || '欄位';
    return res.status(409).json({ success: false, message: `${field} 已存在` });
  }

  // 5. JSON body 格式錯誤
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'JSON 格式錯誤' });
  }

  // 6. 其餘未預期錯誤：記 log，但不把內部細節洩漏給使用者
  console.error(err);
  res.status(500).json({
    success: false,
    message: '伺服器發生錯誤',
    ...(env.nodeEnv !== 'production' && { stack: err.stack }),
  });
}

import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

// 先連上資料庫，成功後才開始接受請求
try {
  await connectDB();
  app.listen(env.port, () => console.log(`API 伺服器啟動：http://localhost:${env.port}`));
} catch (err) {
  console.error('啟動失敗：', err.message);
  process.exit(1);
}

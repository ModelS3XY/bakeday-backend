import dotenv from 'dotenv';

// 本機開發讀 .env；部署平台（Render 等）會直接注入環境變數，沒有 .env 也沒關係
dotenv.config({ quiet: true });

// 啟動時集中檢查必要環境變數：缺了就直接讓程式起不來，
// 比跑到一半才在某支 API 爆錯好除錯得多（fail fast）。
const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`缺少必要環境變數：${missing.join(', ')}`);
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

import { z } from 'zod';

// ---------- Auth ----------
// 注意：schema 裡「沒有」role。zod 的 object 預設會剔除未定義的欄位，
// 所以使用者就算送 { role: 'admin' } 也會在驗證層被丟掉，根本到不了 DB。
export const registerBody = z.object({
  name: z.string().trim().min(1, { error: '請輸入名稱' }).max(50),
  email: z.email({ error: 'email 格式不正確' }).trim().toLowerCase(),
  password: z.string().min(8, { error: '密碼至少 8 碼' }).max(72, { error: '密碼最多 72 碼' }),
});

export const loginBody = z.object({
  email: z.email({ error: 'email 格式不正確' }).trim().toLowerCase(),
  password: z.string().min(1, { error: '請輸入密碼' }),
});

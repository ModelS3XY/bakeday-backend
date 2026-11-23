import { badRequest } from '../utils/AppError.js';

// 用 zod schema 驗證請求的 body / query / params。
// 通過後把「轉型、清洗過」的值放到 req.valid，controller 只讀 req.valid，
// 不直接碰使用者原始輸入 —— 例如註冊時多塞的 role 欄位會在這裡被丟掉。
// （Express 5 的 req.query 是唯讀 getter，所以不能直接覆寫它。）
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || key,
        message: i.message,
      }));
      throw badRequest('輸入資料格式錯誤', details);
    }
    req.valid[key] = result.data;
  }
  next();
};

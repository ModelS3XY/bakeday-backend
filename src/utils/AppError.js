// 「可預期」的錯誤（找不到資源、沒權限、參數錯誤…）都丟這個，
// 由 errorHandler 統一轉成 HTTP 回應。controller 只管 throw，不用自己組 res.status()。
export class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new AppError(400, msg, details);
export const unauthorized = (msg = '請先登入') => new AppError(401, msg);
export const forbidden = (msg = '權限不足') => new AppError(403, msg);
export const notFound = (msg = '找不到資源') => new AppError(404, msg);
export const conflict = (msg) => new AppError(409, msg);

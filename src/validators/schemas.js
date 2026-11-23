import { z } from 'zod';
import mongoose from 'mongoose';
import { MAX_QTY_PER_ITEM } from '../models/Cart.js';

const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { error: '無效的 ID 格式' });

export const idParam = z.object({ id: objectId });
export const productIdParam = z.object({ productId: objectId });

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

// ---------- Products ----------
export const listProductsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().trim().optional(), // 分類 slug
  q: z.string().trim().max(50).optional(), // 關鍵字
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
});

const productFields = {
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000),
  price: z.number().int().min(0),
  stock: z.number().int().min(0),
  category: objectId,
  imageUrl: z.url().or(z.literal('')),
  isActive: z.boolean(),
};

export const createProductBody = z.object({
  ...productFields,
  description: productFields.description.default(''),
  stock: productFields.stock.default(0),
  imageUrl: productFields.imageUrl.default(''),
  isActive: productFields.isActive.default(true),
});

// 編輯：所有欄位都可選，但至少要有一個
export const updateProductBody = z
  .object(productFields)
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { error: '至少需提供一個要更新的欄位' });

// ---------- Cart ----------
const qty = z
  .number({ error: '數量必須是數字' })
  .int({ error: '數量必須是整數' })
  .min(1, { error: '數量至少為 1' })
  .max(MAX_QTY_PER_ITEM, { error: `單一商品數量最多 ${MAX_QTY_PER_ITEM}` });

export const addCartItemBody = z.object({ productId: objectId, qty: qty.default(1) });
export const updateCartItemBody = z.object({ qty });

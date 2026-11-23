import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { badRequest, notFound } from '../utils/AppError.js';

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
};

// 使用者輸入的關鍵字要先跳脫，否則輸入 "(" 或 ".*" 會變成正規表達式語法
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/products?page=1&limit=12&category=pastry&q=可頌&sort=newest
export async function listProducts(req, res) {
  const { page, limit, category, q, sort } = req.valid.query;
  const filter = { isActive: true };

  if (category) {
    const cat = await Category.findOne({ slug: category });
    // 分類不存在 → 回傳空列表（而不是 404），前端統一顯示「查無結果」即可
    if (!cat) return res.json(emptyPage(page, limit));
    filter.category = cat._id;
  }

  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { description: re }];
  }

  // 「這一頁的資料」和「總筆數」互不相依，用 Promise.all 平行查詢
  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'name slug'),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

function emptyPage(page, limit) {
  return { success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
}

// GET /api/products/:id
export async function getProduct(req, res) {
  const product = await Product.findOne({ _id: req.valid.params.id, isActive: true }).populate(
    'category',
    'name slug',
  );
  if (!product) throw notFound('商品不存在');
  res.json({ success: true, data: product });
}

async function assertCategoryExists(categoryId) {
  if (categoryId && !(await Category.exists({ _id: categoryId }))) {
    throw badRequest('分類不存在');
  }
}

// POST /api/admin/products
export async function createProduct(req, res) {
  await assertCategoryExists(req.valid.body.category);
  const product = await Product.create(req.valid.body);
  await product.populate('category', 'name slug');
  res.status(201).json({ success: true, data: product });
}

// PATCH /api/admin/products/:id
export async function updateProduct(req, res) {
  await assertCategoryExists(req.valid.body.category);
  const product = await Product.findByIdAndUpdate(req.valid.params.id, req.valid.body, {
    new: true,
    runValidators: true, // findByIdAndUpdate 預設不跑 schema 驗證，要手動打開
  }).populate('category', 'name slug');
  if (!product) throw notFound('商品不存在');
  res.json({ success: true, data: product });
}

// DELETE /api/admin/products/:id
export async function deleteProduct(req, res) {
  const product = await Product.findByIdAndDelete(req.valid.params.id);
  if (!product) throw notFound('商品不存在');
  res.json({ success: true, message: '商品已刪除' });
}

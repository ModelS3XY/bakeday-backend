import { Category } from '../models/Category.js';

// GET /api/categories
export async function listCategories(_req, res) {
  const categories = await Category.find().sort({ sort: 1, name: 1 });
  res.json({ success: true, data: categories });
}

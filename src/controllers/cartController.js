import { Cart, MAX_QTY_PER_ITEM } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { badRequest, notFound } from '../utils/AppError.js';

// 每個使用者第一次用購物車時才建立（upsert），之後都拿同一台
function getOrCreateCart(userId) {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, new: true },
  );
}

// 組出給前端的購物車格式，並順手清掉「已下架/已刪除」的品項
async function buildCartResponse(cart) {
  await cart.populate('items.product', 'name price stock imageUrl isActive');

  const before = cart.items.length;
  cart.items = cart.items.filter((i) => i.product && i.product.isActive);
  if (cart.items.length !== before) await cart.save();

  const items = cart.items.map((i) => ({
    product: {
      _id: i.product._id,
      name: i.product.name,
      price: i.product.price,
      stock: i.product.stock,
      imageUrl: i.product.imageUrl,
    },
    qty: i.qty,
    subtotal: i.product.price * i.qty,
  }));

  return {
    items,
    totalQty: items.reduce((sum, i) => sum + i.qty, 0),
    totalPrice: items.reduce((sum, i) => sum + i.subtotal, 0),
  };
}

async function findSellableProduct(productId) {
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw notFound('商品不存在或已下架');
  return product;
}

function assertQtyAllowed(qty, product) {
  if (qty > MAX_QTY_PER_ITEM) throw badRequest(`單一商品數量最多 ${MAX_QTY_PER_ITEM}`);
  if (qty > product.stock) throw badRequest(`庫存不足，目前剩餘 ${product.stock} 件`);
}

// 價格、商品名稱等一律從後端 DB 讀，前端只能傳 productId 與 qty。
// 這樣使用者無法竄改價格。

// GET /api/cart
export async function getCart(req, res) {
  const cart = await getOrCreateCart(req.user._id);
  res.json({ success: true, data: await buildCartResponse(cart) });
}

// POST /api/cart/items  { productId, qty }
// 重複加入同一商品 → 數量累加，而不是新增一筆重複品項
export async function addItem(req, res) {
  const { productId, qty } = req.valid.body;
  const product = await findSellableProduct(productId);
  const cart = await getOrCreateCart(req.user._id);

  const existing = cart.items.find((i) => i.product.equals(product._id));
  const nextQty = (existing?.qty ?? 0) + qty;
  assertQtyAllowed(nextQty, product);

  if (existing) existing.qty = nextQty;
  else cart.items.push({ product: product._id, qty });
  await cart.save();

  res.status(existing ? 200 : 201).json({
    success: true,
    message: existing ? '已更新購物車數量' : '已加入購物車',
    data: await buildCartResponse(cart),
  });
}

// PATCH /api/cart/items/:productId  { qty }  —— 直接設定為指定數量
export async function updateItem(req, res) {
  const { productId } = req.valid.params;
  const { qty } = req.valid.body;
  const cart = await getOrCreateCart(req.user._id);

  const item = cart.items.find((i) => i.product.equals(productId));
  if (!item) throw notFound('購物車中沒有此商品');

  const product = await findSellableProduct(productId);
  assertQtyAllowed(qty, product);

  item.qty = qty;
  await cart.save();
  res.json({ success: true, message: '已更新數量', data: await buildCartResponse(cart) });
}

// DELETE /api/cart/items/:productId
export async function removeItem(req, res) {
  const { productId } = req.valid.params;
  const cart = await getOrCreateCart(req.user._id);

  const before = cart.items.length;
  cart.items = cart.items.filter((i) => !i.product.equals(productId));
  if (cart.items.length === before) throw notFound('購物車中沒有此商品');

  await cart.save();
  res.json({ success: true, message: '已移除商品', data: await buildCartResponse(cart) });
}

// DELETE /api/cart
export async function clearCart(req, res) {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  res.json({ success: true, message: '已清空購物車', data: await buildCartResponse(cart) });
}

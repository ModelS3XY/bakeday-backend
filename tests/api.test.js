// 整合測試：啟動記憶體版 MongoDB + 真的 HTTP server，從外部打 API。
// 執行：npm test（不需要 .env，也不會碰到正式資料庫）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo, server, base, mongoose, User, Category, Product;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = 'test-secret';
  process.env.NODE_ENV = 'test';

  // 環境變數設好之後才 import，否則 env.js 會因缺變數而結束程式
  ({ default: mongoose } = await import('mongoose'));
  const { default: app } = await import('../src/app.js');
  const { connectDB } = await import('../src/config/db.js');
  ({ User } = await import('../src/models/User.js'));
  ({ Category } = await import('../src/models/Category.js'));
  ({ Product } = await import('../src/models/Product.js'));

  await connectDB(process.env.MONGODB_URI);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await mongoose?.disconnect();
  await mongo?.stop();
});

async function api(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

let userToken, adminToken, catToast, p1, pLowStock;

test('註冊時傳 role=admin 會被忽略，仍是一般會員', async () => {
  const r = await api('POST', '/api/auth/register', {
    body: { name: '小明', email: 'Ming@Example.com', password: 'password123', role: 'admin' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.user.role, 'user');
  assert.equal(r.body.data.user.email, 'ming@example.com');
  assert.equal(r.body.data.user.password, undefined, '回應不可包含密碼');
  userToken = r.body.data.token;

  const stored = await User.findOne({ email: 'ming@example.com' }).select('+password');
  assert.notEqual(stored.password, 'password123', '密碼不可明文儲存');
  assert.match(stored.password, /^\$2[aby]\$/);
});

test('重複註冊回 409、格式錯誤回 400', async () => {
  const dup = await api('POST', '/api/auth/register', {
    body: { name: 'x', email: 'ming@example.com', password: 'password123' },
  });
  assert.equal(dup.status, 409);

  const bad = await api('POST', '/api/auth/register', {
    body: { name: '', email: 'not-email', password: '123' },
  });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.length >= 3);
});

test('登入成功 / 密碼錯誤 / me', async () => {
  const wrong = await api('POST', '/api/auth/login', {
    body: { email: 'ming@example.com', password: 'wrongpass' },
  });
  assert.equal(wrong.status, 401);

  const ok = await api('POST', '/api/auth/login', {
    body: { email: 'ming@example.com', password: 'password123' },
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.token);

  const me = await api('GET', '/api/auth/me', { token: ok.body.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email, 'ming@example.com');

  assert.equal((await api('GET', '/api/auth/me')).status, 401);
  assert.equal((await api('GET', '/api/auth/me', { token: 'garbage' })).status, 401);
});

test('一般會員不能呼叫管理員 API（403）', async () => {
  const r = await api('POST', '/api/admin/products', {
    token: userToken,
    body: { name: 'hack', price: 1, category: '000000000000000000000000' },
  });
  assert.equal(r.status, 403);
  assert.equal((await api('POST', '/api/admin/products', { body: {} })).status, 401);
});

test('管理員：新增、編輯、刪除商品', async () => {
  const admin = new User({ name: 'admin', email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  await admin.save();
  adminToken = (
    await api('POST', '/api/auth/login', { body: { email: 'admin@test.com', password: 'adminpass' } })
  ).body.data.token;

  catToast = await Category.create({ name: '吐司', slug: 'toast' });
  const catBagel = await Category.create({ name: '貝果', slug: 'bagel' });

  const badCat = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: { name: 'x', price: 100, category: '000000000000000000000000' },
  });
  assert.equal(badCat.status, 400, '分類不存在');

  const badPrice = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: { name: 'x', price: -1, category: catToast._id },
  });
  assert.equal(badPrice.status, 400);

  const created = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: { name: '北海道生吐司', price: 500, stock: 10, category: catToast._id, description: '奶香' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.category.slug, 'toast');
  p1 = created.body.data._id;

  const updated = await api('PATCH', `/api/admin/products/${p1}`, {
    token: adminToken,
    body: { price: 450 },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.price, 450);

  const empty = await api('PATCH', `/api/admin/products/${p1}`, { token: adminToken, body: {} });
  assert.equal(empty.status, 400);

  // 再準備一批資料給列表測試
  const docs = [];
  for (let i = 0; i < 14; i++) {
    docs.push({ name: `貝果 ${i}`, price: 1000 + i, stock: 5, category: catBagel._id });
  }
  docs.push({ name: '下架商品', price: 1, stock: 5, category: catBagel._id, isActive: false });
  await Product.insertMany(docs);
  pLowStock = (await Product.create({ name: '限量布里歐', price: 1680, stock: 2, category: catToast._id }))._id.toString();

  const toDelete = (await Product.create({ name: '待刪', price: 1, stock: 9, category: catBagel._id }))._id.toString();
  await api('POST', '/api/cart/items', { token: userToken, body: { productId: toDelete } });
  const del = await api('DELETE', `/api/admin/products/${toDelete}`, { token: adminToken });
  assert.equal(del.status, 200);
  const cart = await api('GET', '/api/cart', { token: userToken });
  assert.equal(cart.body.data.items.length, 0, '刪除商品後購物車內也移除');
  assert.equal((await api('DELETE', `/api/admin/products/${toDelete}`, { token: adminToken })).status, 404);
});

test('商品列表：分頁、分類、搜尋、隱藏下架商品', async () => {
  const page1 = await api('GET', '/api/products?limit=5');
  assert.equal(page1.status, 200);
  assert.equal(page1.body.data.length, 5);
  assert.equal(page1.body.pagination.total, 16, '下架商品不應出現');
  assert.equal(page1.body.pagination.totalPages, 4);

  const page4 = await api('GET', '/api/products?limit=5&page=4');
  assert.equal(page4.body.data.length, 1);

  const toasts = await api('GET', '/api/products?category=toast');
  assert.equal(toasts.body.pagination.total, 2);

  const search = await api('GET', `/api/products?q=${encodeURIComponent('生吐司')}`);
  assert.equal(search.body.pagination.total, 1);
  assert.equal(search.body.data[0]._id, p1);

  const regexInjection = await api('GET', `/api/products?q=${encodeURIComponent('.*')}`);
  assert.equal(regexInjection.body.pagination.total, 0, '關鍵字需跳脫正規表達式');

  const noCat = await api('GET', '/api/products?category=nope');
  assert.equal(noCat.status, 200);
  assert.equal(noCat.body.data.length, 0);

  assert.equal((await api('GET', '/api/products?page=0')).status, 400);
  assert.equal((await api('GET', '/api/products?limit=999')).status, 400);

  const sorted = await api('GET', '/api/products?sort=price_asc&limit=50');
  const prices = sorted.body.data.map((p) => p.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test('單一商品：存在 / 不存在 / ID 格式錯誤', async () => {
  assert.equal((await api('GET', `/api/products/${p1}`)).status, 200);
  assert.equal((await api('GET', '/api/products/000000000000000000000000')).status, 404);
  assert.equal((await api('GET', '/api/products/abc')).status, 400);
});

test('購物車：未登入 401', async () => {
  assert.equal((await api('GET', '/api/cart')).status, 401);
  assert.equal((await api('POST', '/api/cart/items', { body: { productId: p1 } })).status, 401);
});

test('購物車：加入、重複加入累加、超過庫存、改數量、移除', async () => {
  const t = userToken;

  const add = await api('POST', '/api/cart/items', { token: t, body: { productId: p1, qty: 2 } });
  assert.equal(add.status, 201);
  assert.equal(add.body.data.totalQty, 2);
  assert.equal(add.body.data.totalPrice, 900);

  const again = await api('POST', '/api/cart/items', { token: t, body: { productId: p1, qty: 3 } });
  assert.equal(again.status, 200);
  assert.equal(again.body.data.items.length, 1, '重複加入不應產生重複品項');
  assert.equal(again.body.data.items[0].qty, 5);

  const overStock = await api('POST', '/api/cart/items', { token: t, body: { productId: pLowStock, qty: 3 } });
  assert.equal(overStock.status, 400, '超過庫存');

  for (const qty of [0, -1, 1.5, 100, 'abc']) {
    const r = await api('POST', '/api/cart/items', { token: t, body: { productId: p1, qty } });
    assert.equal(r.status, 400, `qty=${qty} 應被拒絕`);
  }

  const missing = await api('POST', '/api/cart/items', {
    token: t,
    body: { productId: '000000000000000000000000' },
  });
  assert.equal(missing.status, 404);

  const inactive = await Product.findOne({ isActive: false });
  const r = await api('POST', '/api/cart/items', { token: t, body: { productId: inactive._id } });
  assert.equal(r.status, 404, '下架商品不可加入');

  const patch = await api('PATCH', `/api/cart/items/${p1}`, { token: t, body: { qty: 1 } });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.data.items[0].qty, 1);

  const patchOver = await api('PATCH', `/api/cart/items/${p1}`, { token: t, body: { qty: 11 } });
  assert.equal(patchOver.status, 400);

  const patchMissing = await api('PATCH', `/api/cart/items/${pLowStock}`, { token: t, body: { qty: 1 } });
  assert.equal(patchMissing.status, 404, '不在購物車內的商品');

  const del = await api('DELETE', `/api/cart/items/${p1}`, { token: t });
  assert.equal(del.status, 200);
  assert.equal(del.body.data.items.length, 0);
  assert.equal((await api('DELETE', `/api/cart/items/${p1}`, { token: t })).status, 404);
});

test('購物車：商品被下架後自動從購物車移除', async () => {
  const t = userToken;
  await api('POST', '/api/cart/items', { token: t, body: { productId: p1 } });
  await api('PATCH', `/api/admin/products/${p1}`, { token: adminToken, body: { isActive: false } });
  const cart = await api('GET', '/api/cart', { token: t });
  assert.equal(cart.body.data.items.length, 0);
});

test('未知路由 404、壞掉的 JSON 400', async () => {
  assert.equal((await api('GET', '/api/nope')).status, 404);
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(res.status, 400);
});

test('API 文件可存取', async () => {
  const res = await fetch(`${base}/openapi.json`);
  assert.equal(res.status, 200);
  const doc = await res.json();
  assert.ok(doc.paths['/api/cart/items']);
});

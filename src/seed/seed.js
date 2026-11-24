// 執行：npm run seed
// 作用：重建分類與商品測試資料，並建立（或更新）管理員與一般會員測試帳號。
//
// 管理員產生方式：註冊 API 一律只能建立 role='user'，
// 管理員「只能」由能存取伺服器環境變數的人執行此腳本產生（帳密來自 ADMIN_EMAIL / ADMIN_PASSWORD）。
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js';
import { categories, productsByCategory } from './data.js';

// 商品圖片是靜態檔，放在前端網站（Cloudflare Pages / CDN）提供，資料庫只存網址：
// 圖片不佔資料庫空間、不經過後端，瀏覽器與 CDN 也能快取
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || 'https://bakeday.pages.dev';

async function upsertUser({ name, email, password, role }) {
  // 用 save() 而不是 updateOne，才會觸發 pre('save') 的密碼雜湊
  const user = (await User.findOne({ email })) ?? new User({ email });
  Object.assign(user, { name, password, role });
  await user.save();
  console.log(`  ${role.padEnd(5)} ${email}`);
}

async function seed() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('請先在環境變數設定 ADMIN_EMAIL 與 ADMIN_PASSWORD');
  }

  await connectDB(env.mongoUri);

  console.log('清除舊的商品、分類、購物車…');
  await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Cart.deleteMany({})]);

  const cats = await Category.insertMany(categories);
  const catIdBySlug = Object.fromEntries(cats.map((c) => [c.slug, c._id]));

  // 讓 createdAt 有先後差異，「最新上架」排序才有意義
  const now = Date.now();
  let n = 0;
  const products = Object.entries(productsByCategory).flatMap(([slug, list]) =>
    list.map(([name, price, description], i) => {
      n += 1;
      return {
        name,
        price,
        description,
        stock: n % 9 === 0 ? 0 : 10 + ((n * 7) % 40), // 少數商品庫存為 0，方便測試邊界
        category: catIdBySlug[slug],
        imageUrl: `${IMAGE_BASE_URL}/images/products/${slug}-${i + 1}.svg`,
        createdAt: new Date(now - n * 3600_000),
      };
    }),
  );
  await Product.insertMany(products);
  console.log(`已建立 ${cats.length} 個分類、${products.length} 件商品`);

  console.log('建立測試帳號：');
  await upsertUser({ name: '管理員', email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });
  await upsertUser({
    name: '測試會員',
    email: process.env.DEMO_USER_EMAIL || 'user@bakeday.test',
    password: process.env.DEMO_USER_PASSWORD || 'user12345',
    role: 'user',
  });
}

try {
  await seed();
  console.log('完成');
} catch (err) {
  console.error('seed 失敗：', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

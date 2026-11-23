# 焙日 Bakeday｜手作麵包電商 — 後端 API

手作麵包選物電商的後端，提供會員、商品、購物車 API。

- **API Base URL**：`https://<你的-render-網址>.onrender.com`
- **API 文件（Swagger UI，可直接測試）**：`https://<你的-render-網址>.onrender.com/api-docs`
- **OpenAPI JSON（可匯入 Postman）**：`/openapi.json`
- **前端 Repo**：`<前端 repo 網址>`

> 後端部署在 Render 免費方案，閒置 15 分鐘後會休眠，第一次請求可能需要等待約 30–60 秒喚醒。

## 測試帳號

| 角色 | Email | 密碼 |
| --- | --- | --- |
| 一般會員 | `user@bakeday.test` | `user12345` |
| 管理員 | `admin@bakeday.test` | `<部署時設定的 ADMIN_PASSWORD>` |

### 管理員帳號產生方式

- `POST /api/auth/register` **一律**建立 `role: user`。請求中的 `role` 欄位會在驗證層（zod schema 不含 role 欄位）被剔除，controller 也將 role 寫死為 `user`，雙重保險。
- 系統**沒有任何** API 可以修改 role。
- 管理員只能由能存取伺服器環境變數的人執行 `npm run seed` 產生，帳密取自環境變數 `ADMIN_EMAIL`、`ADMIN_PASSWORD`。
- JWT 只存 user id、不存 role；每次請求都從資料庫讀取最新 role，權限以 DB 為準。

## 技術選擇

| 項目 | 選擇 | 理由 |
| --- | --- | --- |
| Runtime / Framework | Node.js 20+、Express 5 | Express 5 原生支援 async handler 的錯誤傳遞，不需要每支 controller 包 try/catch |
| 資料庫 | MongoDB Atlas + Mongoose | Schema 驗證、索引、populate 關聯 |
| 驗證 | zod | 請求進入 controller 前驗證並轉型，未定義的欄位自動剔除 |
| 認證 | bcryptjs + jsonwebtoken | 密碼雜湊、JWT |
| 安全 | helmet、cors、express-rate-limit | 安全標頭、限制來源、登入限流 |
| 文件 | OpenAPI 3 + swagger-ui-express | 文件與伺服器一起部署 |
| 測試 | node:test + mongodb-memory-server | 不依賴外部 DB 的整合測試 |

## 專案架構（MVC）

```
src/
├── server.js              # 進入點：連 DB → 啟動 HTTP
├── app.js                 # 組裝 middleware、路由、錯誤處理
├── config/                # 環境變數（啟動時檢查）、DB 連線
├── models/                # M：Mongoose schema（資料結構、驗證、索引）
├── controllers/           # C：商業邏輯，只讀 req.valid、只 throw 錯誤
├── routes/                # 路由：URL → middleware → controller
├── middlewares/           # 認證、權限、驗證、統一錯誤處理
├── validators/schemas.js  # zod 請求驗證規則
├── utils/AppError.js      # 可預期錯誤（400/401/403/404/409）
└── seed/                  # 測試資料與管理員建立腳本
docs/openapi.yaml          # API 文件
tests/api.test.js          # 整合測試
```

> 本專案是純 API，沒有伺服器端渲染的頁面；MVC 的 View 對應「JSON 回應」，由前端負責呈現。

一個請求的流程：

```
request → helmet/cors/json → router → [requireAuth] → [requireAdmin] → validate(zod) → controller → model
                                                                                          ↓ throw
                                                                                     errorHandler → JSON 錯誤
```

## 資料庫設計

```
User ─1──1─ Cart ─┬─ items[] { product ─→ Product, qty }
                  │
Category ─1──N─ Product
```

| Collection | 重點欄位與約束 |
| --- | --- |
| `users` | `email` unique + lowercase + 格式驗證；`password` bcrypt 雜湊、`select: false`；`role` enum `user/admin` 預設 `user` |
| `categories` | `name`、`slug` 皆 unique；slug 限小寫英數與 `-` |
| `products` | `price`、`stock` 為 ≥ 0 的整數；`category` 參照 Category；`isActive` 控制上下架；複合索引 `{isActive, category, createdAt}` |
| `carts` | `user` unique（一人一台）；`items` 內嵌陣列，`qty` 為 1–99 的整數 |

**為什麼購物車品項用內嵌而不是另開 collection？** 購物車永遠整台一起讀寫，內嵌只要一次查詢；品項數量有限，不會無限成長。

## 購物車邊界處理

| 情況 | 行為 |
| --- | --- |
| 重複加入同商品 | 數量累加，不產生重複品項（回 200；新品項回 201） |
| 商品不存在 / 已下架 | 404 |
| 數量為 0、負數、小數、非數字、> 99 | 400 |
| 累加或設定後超過庫存 | 400，訊息附剩餘庫存 |
| 修改/刪除不在購物車內的商品 | 404 |
| 商品被下架 | 讀取購物車時自動移除 |
| 商品被刪除 | 同時從所有購物車移除 |
| 價格 | 一律由後端讀 DB 計算，前端無法竄改 |

## 本機啟動

需要 Node.js 20 以上，以及一個 MongoDB（建議 MongoDB Atlas 免費方案）。

```bash
npm install
# 在專案根目錄建立 .env（見下方環境變數）
npm run seed   # 建立分類、16 件商品、管理員與測試會員
npm run dev    # http://localhost:3000/api-docs
npm test       # 整合測試（使用記憶體 MongoDB，不需要 .env）
```

## 環境變數

`.env` 不會進版控（已列在 `.gitignore`）。

| 變數 | 必填 | 說明 | 範例 |
| --- | --- | --- | --- |
| `MONGODB_URI` | ✅ | MongoDB 連線字串 | `mongodb+srv://<帳號>:<密碼>@<cluster 位址>/bakeday` |
| `JWT_SECRET` | ✅ | JWT 簽章密鑰，請用長隨機字串 | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | | Token 有效期 | `7d`（預設） |
| `PORT` | | 監聽埠 | `3000`（預設） |
| `NODE_ENV` | | `development` / `production` | |
| `CORS_ORIGIN` | | 允許的前端網址，逗號分隔 | `http://localhost:5173,https://bakeday.pages.dev` |
| `ADMIN_EMAIL` | seed 用 | 管理員帳號 | `admin@bakeday.test` |
| `ADMIN_PASSWORD` | seed 用 | 管理員密碼 | |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | | 測試會員（預設 `user@bakeday.test` / `user12345`） | |

## API 一覽

完整參數與回應格式請見 `/api-docs`。

| Method | Path | 權限 | 說明 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 公開 | 註冊（一律為一般會員） |
| POST | `/api/auth/login` | 公開 | 登入，取得 JWT |
| GET | `/api/auth/me` | 會員 | 目前登入者 |
| GET | `/api/categories` | 公開 | 分類列表 |
| GET | `/api/products` | 公開 | 商品列表：`page`、`limit`、`category`(slug)、`q`、`sort` |
| GET | `/api/products/:id` | 公開 | 單一商品 |
| GET | `/api/cart` | 會員 | 查看購物車 |
| POST | `/api/cart/items` | 會員 | 加入（重複則累加） |
| PATCH | `/api/cart/items/:productId` | 會員 | 設定數量 |
| DELETE | `/api/cart/items/:productId` | 會員 | 移除品項 |
| DELETE | `/api/cart` | 會員 | 清空 |
| POST | `/api/admin/products` | 管理員 | 新增商品 |
| PATCH | `/api/admin/products/:id` | 管理員 | 編輯商品 |
| DELETE | `/api/admin/products/:id` | 管理員 | 刪除商品 |

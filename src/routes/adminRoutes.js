import { Router } from 'express';
import * as products from '../controllers/productController.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam, createProductBody, updateProductBody } from '../validators/schemas.js';

const router = Router();

// 整個 /api/admin 底下一次掛上「登入 + 管理員」檢查，
// 之後新增任何管理員 API 都不會忘記加權限。
router.use(requireAuth, requireAdmin);

router.post('/products', validate({ body: createProductBody }), products.createProduct);
router.patch(
  '/products/:id',
  validate({ params: idParam, body: updateProductBody }),
  products.updateProduct,
);
router.delete('/products/:id', validate({ params: idParam }), products.deleteProduct);

export default router;

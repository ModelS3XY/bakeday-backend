import { Router } from 'express';
import * as products from '../controllers/productController.js';
import { listCategories } from '../controllers/categoryController.js';
import { validate } from '../middlewares/validate.js';
import { idParam, listProductsQuery } from '../validators/schemas.js';

// 公開路由：所有人都能瀏覽
export const productRouter = Router();
productRouter.get('/', validate({ query: listProductsQuery }), products.listProducts);
productRouter.get('/:id', validate({ params: idParam }), products.getProduct);

export const categoryRouter = Router();
categoryRouter.get('/', listCategories);

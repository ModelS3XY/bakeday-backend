import { Router } from 'express';
import * as cart from '../controllers/cartController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { addCartItemBody, updateCartItemBody, productIdParam } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/', cart.getCart);
router.delete('/', cart.clearCart);
router.post('/items', validate({ body: addCartItemBody }), cart.addItem);
router.patch(
  '/items/:productId',
  validate({ params: productIdParam, body: updateCartItemBody }),
  cart.updateItem,
);
router.delete('/items/:productId', validate({ params: productIdParam }), cart.removeItem);

export default router;

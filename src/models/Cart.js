import mongoose from 'mongoose';

export const MAX_QTY_PER_ITEM = 99;

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_QTY_PER_ITEM,
      validate: { validator: Number.isInteger, message: '數量必須是整數' },
    },
  },
  { _id: false },
);

// 設計選擇：一個使用者一台購物車，品項以陣列內嵌（embedded）在購物車文件裡。
// 購物車一定是「整台一起讀」，內嵌只要一次查詢；品項數量也不會無限成長，適合內嵌。
const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

export const Cart = mongoose.model('Cart', cartSchema);

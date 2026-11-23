import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 2000 },
    // 價格用整數（新台幣元）存，避免浮點數誤差
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: '價格必須是整數' },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: { validator: Number.isInteger, message: '庫存必須是整數' },
    },
    // 關聯到 Category：只存 ObjectId，查詢時用 populate 帶出分類資料
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

// 列表查詢最常用「上架中 + 分類 + 依時間排序」，建複合索引讓查詢不用掃全表
productSchema.index({ isActive: 1, category: 1, createdAt: -1 });

export const Product = mongoose.model('Product', productSchema);

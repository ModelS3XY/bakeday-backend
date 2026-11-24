import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 30 },
    // slug 給前端網址用，例如 /products?category=toast
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'slug 只能包含小寫英數與 -'],
    },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

export const Category = mongoose.model('Category', categorySchema);

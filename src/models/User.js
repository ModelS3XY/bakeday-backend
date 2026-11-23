import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['user', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true, // DB 層的唯一索引：就算兩個請求同時註冊同一個 email 也只會成功一個
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'email 格式不正確'],
    },
    // select: false → 預設查詢不會帶出密碼，要用時必須明確 .select('+password')
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user' },
  },
  { timestamps: true },
);

// 存檔前把密碼雜湊。只有密碼被改過才重算，避免改名字時把雜湊再雜湊一次。
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

// 回傳給前端時移除敏感/內部欄位
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);

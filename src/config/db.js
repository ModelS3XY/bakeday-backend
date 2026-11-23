import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri = env.mongoUri) {
  await mongoose.connect(uri);
  console.log(`MongoDB 已連線：${mongoose.connection.name}`);
}

import mongoose from 'mongoose';
import { env } from './env';

/** Connects to MONGO_URI, or spins up an in-memory replica set in development. Returns true if in-memory. */
export async function connectDb(): Promise<boolean> {
  let uri = env.MONGO_URI;
  let inMemory = false;
  if (!uri) {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = replset.getUri('vsr');
    inMemory = true;
    console.log('[db] Using in-memory MongoDB (data resets on restart)');
  }
  await mongoose.connect(uri);
  console.log('[db] connected');
  return inMemory;
}

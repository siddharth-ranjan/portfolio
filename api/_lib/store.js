import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { createRedisStore } from './redisStore.js';
import { createMemoryStore } from './memoryStore.js';

let cached = null;

// The Vercel Upstash integration has used both names over time.
export function redisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function getStore() {
  if (cached) return cached;
  const env = redisEnv();
  if (env) {
    cached = createRedisStore(new Redis({ ...env, automaticDeserialization: false }));
    return cached;
  }
  if (process.env.CHESS_MEMORY_STORE === '1') {
    cached = createMemoryStore();
    return cached;
  }
  throw Object.assign(new Error("Crowd chess isn't connected to its database yet."), { status: 503 });
}

// Salt for hashing IPs, derived from the database token so no extra env var is needed.
export function ipSalt() {
  const env = redisEnv();
  return env ? createHash('sha256').update(env.token).digest('hex') : 'local-dev';
}

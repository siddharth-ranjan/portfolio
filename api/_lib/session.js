import { createHash, randomBytes } from 'node:crypto';

const COOKIE = 'chess_sid';

// An anonymous visitor id: random, opaque, never tied to anything personal.
export function readSid(req) {
  const m = /(?:^|;\s*)chess_sid=([a-f0-9]{32})(?:;|$)/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}

export const newSid = () => randomBytes(16).toString('hex');

export function sidCookie(sid, secure = true) {
  return `${COOKIE}=${sid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

// Raw IPs are never stored — only a salted hash, used to cap moves per network.
export function ipHash(req, salt) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

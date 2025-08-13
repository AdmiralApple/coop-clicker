// api/counter.js (ESM)
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const val = await redis.get('counter');
      const value = Number(val ?? 0);
      return res.status(200).json({ count: value }); // Adjusted to match the expected "count" key
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const delta = Number.isFinite(Number(body?.delta)) ? Number(body.delta) : 1;
      const value = await redis.incrby('counter', delta);
      return res.status(200).json({ count: value }); // Adjusted to match the expected "count" key
    }

    res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'counter failed' });
  }
}
const { Redis } = require('@upstash/redis');

// Initialize a Redis client from environment variables.
// The UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN variables must be set
// in your Vercel project settings. See the README for setup instructions.
const redis = Redis.fromEnv();

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      // Use an atomic increment to avoid race conditions when multiple users
      // click at the same time. Redis will automatically create the key if
      // it doesn't exist and start at 0.
      const count = await redis.incr('clicker:count');
      res.status(200).json({ count });
    } else if (req.method === 'GET') {
      // Retrieve the current count; default to 0 if the key has not been set yet.
      let count = await redis.get('clicker:count');
      if (count === null || count === undefined) {
        count = 0;
      }
      res.status(200).json({ count: Number(count) });
    } else {
      res.status(405).send('Method Not Allowed');
    }
  } catch (err) {
    console.error('Error handling request', err);
    res.status(500).send('Internal Server Error');
  }
};
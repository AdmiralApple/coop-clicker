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
            return res.status(200).json({ count: value });
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
            const delta = Number.isFinite(Number(body?.delta)) ? Number(body.delta) : 1;
            const value = await redis.incrby('counter', delta);
            return res.status(200).json({ count: value });
        }

        res.status(405).end('Method Not Allowed');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'counter failed' });
    }
}

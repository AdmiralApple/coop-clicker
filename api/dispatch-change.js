// Vercel Serverless Function: triggers a GitHub repository_dispatch event
// Env needed on Vercel Project:
// - GH_DISPATCH_TOKEN: a fine‑grained PAT with repo (or public_repo) on this repo
// - AI_WRITE_SECRET: shared secret you’ll send from the browser to prevent abuse

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    try {
        const { prompt, user } = req.body || {};
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ ok: false, error: 'Missing prompt' });
        }
        if (process.env.AI_WRITE_SECRET) {
            const header = req.headers['x-ai-secret'];
            if (!header || header !== process.env.AI_WRITE_SECRET) {
                return res.status(401).json({ ok: false, error: 'Unauthorized' });
            }
        }

        const owner = 'AdmiralApple';
        const repo = 'coop-clicker';
        const token = process.env.GH_DISPATCH_TOKEN;

        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
            method: 'POST',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_type: 'ai-change',
                client_payload: { prompt, user: user || 'web-user', at: new Date().toISOString() },
            }),
        });

        if (!r.ok) {
            const text = await r.text();
            return res.status(r.status).json({ ok: false, error: 'GitHub dispatch failed', detail: text });
        }

        return res.status(202).json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: 'Server error' });
    }
}
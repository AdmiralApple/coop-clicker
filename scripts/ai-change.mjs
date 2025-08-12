// Node script run in GitHub Actions. Reads the repo, asks OpenAI for a unified diff, applies it.
// Guardrails: only allow changes in index.html, main.js, public/**, src/**, styles/**, css/**.
// Requires OPENAI_API_KEY in repo secrets.

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import OpenAI from 'openai';

const pexec = promisify(execFile);
const ROOT = process.cwd();

const ALLOW_GLOBS = [
  'index.html', 'main.js', 'style.css',
  'public/', 'src/', 'styles/', 'css/'
];

function isPathAllowed(p) {
  const norm = p.replace(/^\.\/?/, '').replace(/^a\//, '').replace(/^b\//, '');
  return ALLOW_GLOBS.some(g => {
    if (g.endsWith('/')) return norm.startsWith(g);
    return norm === g;
  });
}

async function readTextIfExists(fp) {
  try { return await fs.readFile(fp, 'utf8'); } catch { return null; }
}

async function collectContext() {
  // Small repo: include key files if present
  const candidates = [
    'index.html', 'main.js', 'style.css',
  ];
  // Add common app dirs
  const extraDirs = ['src'];

  const parts = [];
  for (const f of candidates) {
    const content = await readTextIfExists(path.join(ROOT, f));
    if (content !== null) {
      parts.push(`FILE: ${f}\n\n\u0060\u0060\u0060\n${content}\n\u0060\u0060\u0060`);
    }
  }
  // src/index.js[x], src/App.js[x] if present (best-effort)
  for (const base of ['src/index.js', 'src/index.jsx', 'src/App.js', 'src/App.jsx']) {
    const content = await readTextIfExists(path.join(ROOT, base));
    if (content !== null) parts.push(`FILE: ${base}\n\n\u0060\u0060\u0060\n${content}\n\u0060\u0060\u0060`);
  }
  return parts.join('\n\n---\n\n');
}

function validatePatchTouchesAllowedPaths(patchText) {
  const lines = patchText.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const m = line.match(/^\+\+\+\s+(?:a\/|b\/)?(.+)$/) || line.match(/^---\s+(?:a\/|b\/)?(.+)$/);
      if (m) {
        const filePath = m[1].trim();
        if (!isPathAllowed(filePath)) {
          throw new Error(`Patch touches disallowed path: ${filePath}`);
        }
      }
    }
  }
}

async function applyPatch(patchText) {
  await fs.writeFile('ai.patch', patchText, 'utf8');
  // Try apply with some tolerance
  try {
    await pexec('git', ['apply', '--whitespace=fix', '--reject', 'ai.patch']);
  } catch (e) {
    throw new Error(`git apply failed: ${e.stderr || e.message}`);
  }
}

async function main() {
  const prompt = process.env.AI_PROMPT;
  const who = process.env.AI_REQUESTER || 'web-user';
  if (!prompt) throw new Error('AI_PROMPT not set');

  const context = await collectContext();

  const system = `You are an expert front-end coder. Output a single unified diff (git patch) only.\n` +
  `Constraints:\n- Only modify files under: index.html, main.js, style.css, public/**, src/**, styles/**, css/**.\n` +
  `- Keep changes minimal and self-contained.\n- Ensure the site still loads on Vercel (no new build tools).\n- If adding assets, inline small snippets (e.g. tiny CSS/JS) instead of adding npm deps.\n- If implementing confetti or similar, prefer vanilla JS or small CDN script tags.\n- Use UTF-8 and end files with a newline.`;

  const user = `Implement the following request for the Co-op Clicker site.\n` +
  `Request: ${prompt}\n\nProject files (read-only context):\n${context}\n\n` +
  `Return only a valid unified diff starting with lines like:\n` +
  `diff --git a/index.html b/index.html`;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Try the Responses API; if not available in your client version, you can swap to chat.completions.
  let patchText;
  try {
    const r = await client.responses.create({
      model: 'gpt-5',
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    patchText = (r.output_text || '').trim();
  } catch (e) {
    // Fallback to chat completions if needed
    const r = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    });
    patchText = (r.choices?.[0]?.message?.content || '').trim();
  }

  if (!patchText.startsWith('diff --git')) {
    throw new Error('Model did not return a unified diff');
  }

  validatePatchTouchesAllowedPaths(patchText);
  await applyPatch(patchText);

  // Optionally try a build; do not fail if absent
  try {
    await pexec('npm', ['run', '-s', 'build'], { env: process.env });
  } catch {
    // ok for static site
  }

  // Leave the working tree with changes; the next action step will open a PR.
  console.log(`\n✅ Patch applied for: ${prompt} (requested by ${who})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
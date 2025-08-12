// scripts/ai-change.mjs
// Robust: tries unified diff first; if git apply fails, asks for JSON file map and writes files.
// Guardrails: only touches allowed paths. Leaves changes staged for the PR step.

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
  return ALLOW_GLOBS.some(g => g.endsWith('/') ? norm.startsWith(g) : norm === g);
}

async function readTextIfExists(fp) {
  try { return await fs.readFile(fp, 'utf8'); } catch { return null; }
}

async function collectContext() {
  // Try to provide the model real context without overloading tokens.
  const picks = [];
  for (const f of ['index.html', 'main.js', 'style.css']) {
    const content = await readTextIfExists(path.join(ROOT, f));
    if (content !== null) picks.push(`FILE: ${f}\n\n\`\`\`\n${content}\n\`\`\``);
  }
  // common SPA files if they exist
  for (const f of ['src/index.js', 'src/index.jsx', 'src/App.js', 'src/App.jsx', 'src/main.js', 'src/main.ts', 'src/main.tsx']) {
    const content = await readTextIfExists(path.join(ROOT, f));
    if (content !== null) picks.push(`FILE: ${f}\n\n\`\`\`\n${content}\n\`\`\``);
  }
  return picks.join('\n\n---\n\n');
}

function extractUnifiedDiff(text) {
  // Strip BOM + CRLF
  let t = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();

  // If wrapped in ``` blocks, take the first diff-like block
  const fence = t.match(/```(?:diff|patch)?\n([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  // If extra prose before the patch, cut from first diff header
  const idx = t.indexOf('diff --git ');
  if (idx > 0) t = t.slice(idx);

  return t.trim();
}

function validatePatchAllowedPaths(patchText) {
  const files = [];
  const re = /^diff --git a\/(.+?) b\/\1$/gm;
  let m;
  while ((m = re.exec(patchText)) !== null) files.push(m[1]);
  for (const f of files) {
    if (!isPathAllowed(f)) throw new Error(`Patch touches disallowed path: ${f}`);
  }
}

async function tryGitApply(patch, variant) {
  await fs.writeFile('ai.patch', patch, 'utf8');
  const baseArgs = ['apply', '--whitespace=fix', '--reject'];
  const variants = {
    default: baseArgs,
    p0: [...baseArgs, '-p0'],
    p1: [...baseArgs, '-p1']
  }[variant || 'default'];

  try {
    await pexec('git', variants.concat('ai.patch'));
    return true;
  } catch (e) {
    const msg = e.stderr || e.stdout || e.message || String(e);
    await fs.writeFile('ai.patch.log.txt', msg, 'utf8');
    return false;
  }
}

async function openaiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey });
}

function systemPrompt(base) {
  return [
    'You are an expert front-end coder.',
    'Prefer minimal, self-contained changes. No new build tools.',
    'Allowed paths: index.html, main.js, style.css, public/**, src/**, styles/**, css/**.',
    base
  ].join('\n');
}

async function askForUnifiedDiff(client, userReq, context) {
  const sys = systemPrompt([
    'OUTPUT REQUIREMENTS:',
    '- Return ONLY a valid unified git diff.',
    '- Include proper headers for new files: "new file mode 100644", "--- /dev/null", "+++ b/<path>".',
    '- Use paths that actually exist or that you intentionally create under the allowed directories.',
    '- Do not include any prose or code fences.'
  ].join('\n'));
  const usr = `Implement this request: ${userReq}\n\nProject files (read-only):\n${context}\n\nBegin with:\ndiff --git a/... b/...`;

  // Try Responses API; fallback to chat
  try {
    const r = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      temperature: 0.1
    });
    return (r.output_text || '').trim();
  } catch {
    const r = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      temperature: 0.1
    });
    return (r.choices?.[0]?.message?.content || '').trim();
  }
}

async function askForFileMap(client, userReq, context, failureNote) {
  const sys = systemPrompt([
    'If your diff could not be applied, return a JSON file-map instead.',
    'JSON SCHEMA (no prose, no fences):',
    '{ "changes": [ { "path": "<allowed path>", "action": "upsert|delete", "content": "<full file content if upsert>" } ] }',
    'Rules:',
    '- Only include allowed paths.',
    '- For upsert, provide the FULL desired file content.',
    '- Use UTF-8; end files with newline.',
    '- No comments in JSON.'
  ].join('\n'));

  const usr = [
    `Implement this request as a JSON file map: ${userReq}`,
    failureNote ? `Previous diff failed with:\n${failureNote}` : '',
    'Project files (read-only):',
    context
  ].join('\n\n');

  // Responses → fallback to chat
  try {
    const r = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      temperature: 0.1
    });
    return (r.output_text || '').trim();
  } catch {
    const r = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      temperature: 0.1
    });
    return (r.choices?.[0]?.message?.content || '').trim();
  }
}

function tryParseJSONFileMap(text) {
  // Extract first JSON-looking block
  let t = text.trim();
  const fence = t.match(/```(?:json)?\n([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // Trim trailing junk
  const firstBrace = t.indexOf('{');
  const lastBrace = t.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) t = t.slice(firstBrace, lastBrace + 1);
  const obj = JSON.parse(t);
  if (!obj || !Array.isArray(obj.changes)) throw new Error('Invalid file-map JSON');
  return obj;
}

async function applyFileMap(obj) {
  await fs.writeFile('ai.json', JSON.stringify(obj, null, 2) + '\n', 'utf8');
  for (const ch of obj.changes) {
    const { path: p, action, content } = ch;
    if (!isPathAllowed(p)) throw new Error(`JSON change touches disallowed path: ${p}`);
    const abs = path.join(ROOT, p);
    if (action === 'delete') {
      await fs.rm(abs, { force: true });
    } else if (action === 'upsert') {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content.endsWith('\n') ? content : content + '\n', 'utf8');
    } else {
      throw new Error(`Unknown action: ${action} (${p})`);
    }
  }
  // Stage to ensure PR step sees changes
  await pexec('git', ['add', '-A']);
}

async function main() {
  const userReq = process.argv.slice(2).join(' ').trim() || process.env.AI_PROMPT;
  if (!userReq) throw new Error('No prompt provided');
  const context = await collectContext();
  const client = await openaiClient();

  // 1) Ask for a diff
  let rawPatch = await askForUnifiedDiff(client, userReq, context);
  let patch = extractUnifiedDiff(rawPatch);

  // sanity check + allowlist
  if (!patch.startsWith('diff --git')) throw new Error('Model did not return a unified diff');
  validatePatchAllowedPaths(patch);

  // 2) Try applying with a few variants
  const okDefault = await tryGitApply(patch, 'default');
  if (!okDefault) {
    const okP0 = await tryGitApply(patch, 'p0');
    if (!okP0) {
      const okP1 = await tryGitApply(patch, 'p1');
      if (!okP1) {
        // 3) Fall back to JSON file map
        const errTxt = await readTextIfExists('ai.patch.log.txt');
        const jsonOut = await askForFileMap(client, userReq, context, errTxt || 'git apply failed');
        await fs.writeFile('ai.json.raw.txt', jsonOut, 'utf8');
        const obj = tryParseJSONFileMap(jsonOut);
        await applyFileMap(obj);
        console.log('✅ Applied JSON file-map fallback.');
        return;
      }
    }
  }
  console.log('✅ Patch applied.');
}

main().catch(async (err) => {
  console.error(err);
  // ensure something is uploaded by the workflow
  try { await fs.writeFile('ai-error.txt', String(err), 'utf8'); } catch {}
  process.exit(1);
});

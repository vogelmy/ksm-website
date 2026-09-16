/**
 * Access-code gate for /intake.
 *
 * The questionnaire is for engaged clients only. A short code (INTAKE_CODE
 * secret) unlocks it; the browser then carries an HttpOnly cookie holding a
 * hash of the code, so the code itself is never stored client-side. The same
 * cookie is required by POST /api/intake, so the endpoint can't be hit without
 * passing the gate first.
 */

import { safeEqual } from './admin';

export interface GateEnv {
  INTAKE_CODE?: string;
}

const COOKIE = 'ksm_intake';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — long enough to finish a saved draft

async function tokenFor(code: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ksm-intake:${code}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieValue(request: Request): string {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return '';
}

export async function intakeUnlocked(request: Request, env: GateEnv): Promise<boolean> {
  if (!env.INTAKE_CODE) return false;
  const have = cookieValue(request);
  if (!have) return false;
  return safeEqual(have, await tokenFor(env.INTAKE_CODE));
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function gatePage(error?: string): Response {
  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Client intake · Kallus Strategic Management</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@800&display=swap">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F6FA;color:#3A5068;
       font:400 16px/1.6 Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;padding:24px}
  .card{width:100%;max-width:26rem;background:#fff;border:1px solid #E4E8EF;border-radius:20px;padding:36px 32px}
  .mark{display:flex;align-items:center;gap:12px;margin-bottom:26px}
  .mark i{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#0F1D33}
  .mark b{font:800 22px/1 "Plus Jakarta Sans",Inter,sans-serif;color:#0F1D33;letter-spacing:-.02em}
  .mark small{display:block;margin-top:5px;font:500 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#8592A6}
  h1{margin:0 0 8px;font:800 24px/1.15 "Plus Jakarta Sans",Inter,sans-serif;color:#0F1D33;letter-spacing:-.02em}
  p{margin:0 0 22px;font-size:15px}
  label{display:block;font-size:14px;font-weight:600;color:#22374F;margin-bottom:8px}
  input{width:100%;padding:14px 16px;border:1px solid #E4E8EF;border-radius:12px;font:inherit;font-size:18px;letter-spacing:.04em;color:#0F1D33}
  input:focus{outline:none;border-color:#6180FB;box-shadow:0 0 0 3px #EDF1FE}
  button{margin-top:14px;width:100%;padding:14px 18px;border:0;border-radius:999px;background:#2B57F0;color:#fff;font:600 15px Inter,sans-serif;cursor:pointer}
  button:hover{background:#1E42CC}
  .err{margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#FFF4E5;color:#7A4A0E;font-size:14px}
  .foot{margin:22px 0 0;font-size:12px;color:#8592A6;line-height:1.6}
</style></head><body>
<form class="card" method="post" action="/intake">
  <div class="mark"><i><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="11" width="3.2" height="6.5" rx="1.2" fill="#6180FB"/><rect x="8.4" y="7" width="3.2" height="10.5" rx="1.2" fill="#94ACFF"/><rect x="14.3" y="2.5" width="3.2" height="15" rx="1.2" fill="#fff"/></svg></i>
  <span><b>KSM</b><small>Kallus Strategic Management</small></span></div>
  <h1>Client intake</h1>
  <p>This questionnaire is for KSM clients. Enter the access code Motti gave you.</p>
  ${error ? `<p class="err">${esc(error)}</p>` : ''}
  <label for="code">Access code</label>
  <input id="code" name="code" type="text" autocomplete="one-time-code" autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus>
  <button type="submit">Continue</button>
  <p class="foot">Don't have a code? Email <a href="mailto:motti@kallusstrategicmanagement.com" style="color:#2B57F0">motti@kallusstrategicmanagement.com</a>.</p>
</form></body></html>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
    },
  });
}

/** Handles GET/POST /intake. Returns null when the caller should serve the real page. */
export async function handleIntakeGate(request: Request, env: GateEnv): Promise<Response | null> {
  if (!env.INTAKE_CODE) {
    return new Response('The intake page is not configured. Set the INTAKE_CODE secret with: wrangler secret put INTAKE_CODE', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
    });
  }

  if (request.method === 'POST') {
    let code = '';
    try {
      const form = await request.formData();
      code = String(form.get('code') || '').trim();
    } catch {
      /* fall through to the error page */
    }
    // Case-insensitive, spaces ignored — the code is meant to be easy to type on a phone.
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    if (code && safeEqual(norm(code), norm(env.INTAKE_CODE))) {
      const token = await tokenFor(env.INTAKE_CODE);
      return new Response(null, {
        status: 303,
        headers: {
          location: '/intake',
          'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
          'cache-control': 'no-store',
        },
      });
    }
    return gatePage("That code didn't match. Check it with Motti and try again.");
  }

  if (await intakeUnlocked(request, env)) return null;
  return gatePage();
}

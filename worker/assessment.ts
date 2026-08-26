/**
 * POST /api/assessment
 *
 * Receives a completed KSM Profile Score self-assessment, stores it, and emails
 * the result to KSM. Same durability rule as the lead endpoint: the row must be
 * written before the request succeeds; the notification is best-effort.
 */

import { BANDS, COMPONENT_STATUS } from '../src/data/profile';

export interface AssessmentEnv {
  DB: D1Database;
  LEAD_TO: string;
  LEAD_BCC?: string;
  LEAD_FROM_NAME: string;
  SITE_NAME: string;
  BREVO_API_KEY?: string;
  LEAD_FROM?: string;
}

interface ComponentIn {
  key?: string;
  label?: string;
  value?: number;
}

interface Payload {
  identity?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company_website?: string;
  components?: ComponentIn[];
  answers?: Record<string, string>;
  referrer?: string;
}

const KEYS = ['cash-flow', 'debt', 'credit', 'liquidity', 'income', 'capital'] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const clean = (v: unknown, max: number): string => {
  if (typeof v !== 'string') return '';
  let out = '';
  for (const ch of v) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? ' ' : ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max);
};

const clamp = (n: unknown): number => {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );

const bandFor = (v: number) => BANDS.find((b) => v >= b.min) ?? BANDS[BANDS.length - 1];
const statusFor = (v: number) =>
  COMPONENT_STATUS.find((s) => v >= s.min) ?? COMPONENT_STATUS[COMPONENT_STATUS.length - 1];

export async function handleAssessment(
  request: Request,
  env: AssessmentEnv,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'Cross-origin requests are not accepted' }, 403);
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400);
  }

  if (clean(body.company_website, 200)) return json({ ok: true, id: 'ok' });

  const contact = {
    identity: clean(body.identity, 20) === 'business' ? 'business' : 'individual',
    firstName: clean(body.firstName, 60),
    lastName: clean(body.lastName, 60),
    email: clean(body.email, 120).toLowerCase(),
    phone: clean(body.phone, 30),
    referrer: clean(body.referrer, 300),
  };

  const errors: string[] = [];
  if (!contact.firstName) errors.push('firstName');
  if (!contact.lastName) errors.push('lastName');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) errors.push('email');
  if (errors.length) {
    return json({ ok: false, error: 'Please check the highlighted fields.', fields: errors }, 400);
  }

  // Recompute server-side rather than trusting the numbers the page sent.
  const byKey = new Map<string, number>();
  for (const c of Array.isArray(body.components) ? body.components.slice(0, 12) : []) {
    const key = clean(c.key, 20);
    if ((KEYS as readonly string[]).includes(key)) byKey.set(key, clamp(c.value));
  }
  if (byKey.size !== KEYS.length) {
    return json({ ok: false, error: 'The assessment is incomplete.' }, 400);
  }

  const values = KEYS.map((k) => byKey.get(k) as number);
  const index = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const score = Number((index / 10).toFixed(1));
  const band = bandFor(index);

  let weakestKey = KEYS[0];
  for (const k of KEYS) {
    if ((byKey.get(k) as number) < (byKey.get(weakestKey) as number)) weakestKey = k;
  }

  const answers = JSON.stringify(body.answers && typeof body.answers === 'object' ? body.answers : {}).slice(0, 4000);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? '';

  try {
    await env.DB.prepare(
      `INSERT INTO assessments (
         id, created_at, identity, first_name, last_name, email, phone,
         score, band, weakest, cash_flow, debt, credit, liquidity, income, capital,
         answers, referrer, ip, country
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        id,
        createdAt,
        contact.identity,
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone,
        score,
        band.label,
        weakestKey,
        ...values,
        answers,
        contact.referrer,
        ip,
        country
      )
      .run();
  } catch (err) {
    console.error('assessment insert failed', err);
    return json({ ok: false, error: 'We could not save your assessment. Please try again.' }, 500);
  }

  ctx.waitUntil(
    notify(env, {
      id,
      createdAt,
      ...contact,
      score,
      band: band.label,
      weakest: weakestKey,
      values,
      country,
    })
  );

  return json({ ok: true, id, score, band: band.label });
}

interface NotifyInput {
  id: string;
  createdAt: string;
  identity: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  referrer: string;
  score: number;
  band: string;
  weakest: string;
  values: number[];
  country: string;
}

const LABELS: Record<string, string> = {
  'cash-flow': 'Cash Flow',
  debt: 'Debt Structure',
  credit: 'Credit Exposure',
  liquidity: 'Liquidity',
  income: 'Income',
  capital: 'Capital Readiness',
};

async function notify(env: AssessmentEnv, a: NotifyInput): Promise<void> {
  const apiKey = env.BREVO_API_KEY;
  const from = env.LEAD_FROM;
  if (!apiKey || !from) {
    console.log('assessment stored, email skipped (email not configured)', a.id);
    return;
  }

  const addresses = (list?: string) =>
    (list || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

  const to = addresses(env.LEAD_TO);
  const bcc = addresses(env.LEAD_BCC);
  if (!to.length && !bcc.length) return;

  const rows = KEYS.map((k, i) => {
    const v = a.values[i];
    const s = statusFor(v);
    const colour = s.tone === 'good' ? '#2F9E68' : s.tone === 'bad' ? '#B4483C' : '#C98A22';
    return `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #eef1f6;color:#22374f;font-size:14px">${escapeHtml(LABELS[k])}</td>
      <td style="padding:9px 0;border-bottom:1px solid #eef1f6;text-align:right;font-size:14px;color:${colour};font-weight:600">${v} · ${escapeHtml(s.label)}</td>
    </tr>`;
  }).join('');

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;padding:24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#22374f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e4e8ef;border-radius:16px;overflow:hidden">
<tr><td style="background:#0a1425;padding:22px 28px">
<div style="font-size:18px;font-weight:800;color:#fff">Assessment completed</div>
<div style="font-size:12px;color:#8592a6;margin-top:4px;text-transform:uppercase;letter-spacing:.14em">${escapeHtml(env.SITE_NAME || 'KSM')}</div>
</td></tr>
<tr><td style="padding:26px 28px 8px">
<div style="font-size:13px;color:#8592a6;text-transform:uppercase;letter-spacing:.14em">KSM Profile Score</div>
<div style="font-size:44px;font-weight:800;color:#0f1d33;line-height:1;margin-top:8px">${a.score}<span style="font-size:18px;color:#8592a6">/10</span></div>
<div style="font-size:15px;font-weight:600;color:#22374f;margin-top:8px">${escapeHtml(a.band)}</div>
<div style="font-size:13px;color:#8592a6;margin-top:4px">Weakest component: ${escapeHtml(LABELS[a.weakest] || a.weakest)}</div>
</td></tr>
<tr><td style="padding:14px 28px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr>
<tr><td style="padding:18px 28px 26px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
<tr><td style="padding:8px 0;color:#8592a6;width:110px">Name</td><td style="padding:8px 0;color:#0f1d33;font-weight:500">${escapeHtml(a.firstName + ' ' + a.lastName)}</td></tr>
<tr><td style="padding:8px 0;color:#8592a6">Email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml(a.email)}" style="color:#2b57f0">${escapeHtml(a.email)}</a></td></tr>
<tr><td style="padding:8px 0;color:#8592a6">Phone</td><td style="padding:8px 0;color:#0f1d33">${escapeHtml(a.phone || '—')}</td></tr>
<tr><td style="padding:8px 0;color:#8592a6">Type</td><td style="padding:8px 0;color:#0f1d33">${a.identity === 'business' ? 'Business owner' : 'Individual'}</td></tr>
<tr><td style="padding:8px 0;color:#8592a6">Received</td><td style="padding:8px 0;color:#0f1d33">${escapeHtml(a.createdAt)}</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;color:#8592a6;line-height:1.6">Self-reported snapshot from the KSM assessment link. Reply to this email to reach them directly.</p>
</td></tr></table></body></html>`;

  const text = [
    `KSM Profile Score: ${a.score}/10 (${a.band})`,
    `Weakest: ${LABELS[a.weakest] || a.weakest}`,
    ...KEYS.map((k, i) => `${LABELS[k]}: ${a.values[i]}`),
    '',
    `${a.firstName} ${a.lastName} — ${a.email}${a.phone ? ' — ' + a.phone : ''}`,
    a.identity === 'business' ? 'Business owner' : 'Individual',
    a.createdAt,
  ].join('\n');

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: from, name: env.LEAD_FROM_NAME || 'KSM Website' },
        to: to.length ? to : bcc,
        ...(to.length && bcc.length ? { bcc } : {}),
        replyTo: { email: a.email, name: `${a.firstName} ${a.lastName}` },
        subject: `Assessment — ${a.firstName} ${a.lastName} scored ${a.score}/10 (${a.band})`,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) console.error('brevo assessment send failed', res.status, await res.text());
  } catch (err) {
    console.error('brevo assessment send threw', err);
  }
}

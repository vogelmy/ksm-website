/**
 * KSM website Worker.
 *
 * Serves the static Astro build from the ASSETS binding and handles the
 * profile-request endpoint at POST /api/lead.
 *
 * Every submission is written to D1 first, then an email notification is
 * attempted. Email failures never fail the request — the lead is already
 * durable at that point.
 */

import { handleAdmin } from './admin';
import { handleAssessment } from './assessment';

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  LEAD_TO: string;
  LEAD_BCC?: string;
  LEAD_FROM_NAME: string;
  SITE_NAME: string;
  ADMIN_USER?: string;
  /** Secrets (wrangler secret put) */
  BREVO_API_KEY?: string;
  LEAD_FROM?: string;
  ADMIN_PASSWORD?: string;
}

interface LeadPayload {
  identity?: string;
  goal?: string;
  timeline?: string;
  concerns?: string[];
  notes?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  page?: string;
  referrer?: string;
  company_website?: string;
}

const IDENTITIES = new Set(['individual', 'business']);
const MAX = {
  name: 60,
  email: 120,
  phone: 30,
  text: 120,
  notes: 1200,
  url: 300,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
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

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= MAX.email;

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );

async function handleLead(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  // Same-origin guard: the form is the only intended caller.
  const origin = request.headers.get('origin');
  if (origin) {
    const target = new URL(request.url).origin;
    if (origin !== target) return json({ ok: false, error: 'Cross-origin requests are not accepted' }, 403);
  }

  let body: LeadPayload;
  try {
    body = (await request.json()) as LeadPayload;
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400);
  }

  // Honeypot — silently accept so bots do not learn anything.
  if (clean(body.company_website, 200)) {
    return json({ ok: true, id: 'ok' });
  }

  const lead = {
    identity: clean(body.identity, 20),
    goal: clean(body.goal, MAX.text),
    timeline: clean(body.timeline, MAX.text),
    concerns: Array.isArray(body.concerns)
      ? body.concerns.slice(0, 12).map((c) => clean(c, MAX.text)).filter(Boolean)
      : [],
    notes: clean(body.notes, MAX.notes),
    firstName: clean(body.firstName, MAX.name),
    lastName: clean(body.lastName, MAX.name),
    email: clean(body.email, MAX.email).toLowerCase(),
    phone: clean(body.phone, MAX.phone),
    page: clean(body.page, MAX.url),
    referrer: clean(body.referrer, MAX.url),
  };

  const errors: string[] = [];
  if (!IDENTITIES.has(lead.identity)) errors.push('identity');
  if (!lead.firstName) errors.push('firstName');
  if (!lead.lastName) errors.push('lastName');
  if (!isEmail(lead.email)) errors.push('email');
  if (errors.length) {
    return json({ ok: false, error: 'Please check the highlighted fields.', fields: errors }, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? '';
  const userAgent = clean(request.headers.get('user-agent'), 300);

  try {
    await env.DB.prepare(
      `INSERT INTO leads (
         id, created_at, identity, goal, timeline, concerns, notes,
         first_name, last_name, email, phone, page, referrer, ip, country, user_agent
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        id,
        createdAt,
        lead.identity,
        lead.goal,
        lead.timeline,
        lead.concerns.join(' | '),
        lead.notes,
        lead.firstName,
        lead.lastName,
        lead.email,
        lead.phone,
        lead.page,
        lead.referrer,
        ip,
        country,
        userAgent
      )
      .run();
  } catch (err) {
    console.error('lead insert failed', err);
    return json({ ok: false, error: 'We could not save your request. Please try again.' }, 500);
  }

  // Notification is best-effort and must not delay or fail the response.
  ctx.waitUntil(notify(env, { ...lead, id, createdAt, country }));

  return json({ ok: true, id });
}

interface NotifyPayload {
  id: string;
  createdAt: string;
  identity: string;
  goal: string;
  timeline: string;
  concerns: string[];
  notes: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  page: string;
  referrer: string;
  country: string;
}

async function notify(env: Env, lead: NotifyPayload): Promise<void> {
  const apiKey = env.BREVO_API_KEY;
  const from = env.LEAD_FROM;
  if (!apiKey || !from) {
    console.log('lead stored, email skipped (BREVO_API_KEY / LEAD_FROM not configured)', lead.id);
    return;
  }

  const addresses = (list?: string) =>
    (list || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

  const recipients = addresses(env.LEAD_TO);
  const bcc = addresses(env.LEAD_BCC);
  if (!recipients.length && !bcc.length) return;

  const rows: [string, string][] = [
    ['Name', `${lead.firstName} ${lead.lastName}`],
    ['Email', lead.email],
    ['Phone', lead.phone || '—'],
    ['Type', lead.identity === 'business' ? 'Business owner' : 'Individual / family'],
    ['Goal', lead.goal || '—'],
    ['Timeline', lead.timeline || '—'],
    ['Pressure points', lead.concerns.length ? lead.concerns.join(', ') : '—'],
    ['Notes', lead.notes || '—'],
    ['Submitted from', lead.page || '—'],
    ['Referrer', lead.referrer || 'direct'],
    ['Country', lead.country || '—'],
    ['Received', lead.createdAt],
    ['Record ID', lead.id],
  ];

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;padding:24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#22374f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e4e8ef;border-radius:16px;overflow:hidden">
<tr><td style="background:#0a1425;padding:22px 28px">
<div style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-.02em">New profile request</div>
<div style="font-size:12px;color:#8592a6;margin-top:4px;text-transform:uppercase;letter-spacing:.14em">${escapeHtml(env.SITE_NAME || 'KSM')}</div>
</td></tr>
<tr><td style="padding:8px 28px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:12px 0;border-bottom:1px solid #eef1f6;color:#8592a6;width:150px;vertical-align:top">${escapeHtml(
        k
      )}</td><td style="padding:12px 0;border-bottom:1px solid #eef1f6;color:#0f1d33;font-weight:500">${escapeHtml(
        v
      )}</td></tr>`
  )
  .join('')}
</table>
<p style="margin:22px 0 0;font-size:12px;color:#8592a6;line-height:1.6">Sent automatically by the KSM website. Reply directly to this email to reach the person who submitted it.</p>
</td></tr></table></body></html>`;

  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: from, name: env.LEAD_FROM_NAME || 'KSM Website' },
        to: recipients.length ? recipients : bcc,
        ...(recipients.length && bcc.length ? { bcc } : {}),
        replyTo: { email: lead.email, name: `${lead.firstName} ${lead.lastName}` },
        subject: `New profile request — ${lead.firstName} ${lead.lastName} (${
          lead.identity === 'business' ? 'Business' : 'Individual'
        })`,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) {
      console.error('brevo send failed', res.status, await res.text());
    }
  } catch (err) {
    console.error('brevo send threw', err);
  }
}

/**
 * Security and caching headers for every static response. Applied here rather
 * than in a _headers file because Workers static assets do not read one.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Inline scripts are used for the wizard, nav and reveal logic.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  // Scheduling embeds on /book. Iframe only — no third-party script is loaded.
  "frame-src https://calendly.com https://*.calendly.com https://cal.com https://*.cal.com https://calendar.google.com",
].join('; ');

function withSecurityHeaders(res: Response, url: URL): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  out.headers.set(
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=(), payment=(), browsing-topics=()'
  );
  out.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  out.headers.set('Content-Security-Policy', CSP);
  if (url.pathname.startsWith('/_astro/')) {
    out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  return out;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      return handleLead(request, env, ctx);
    }

    if (url.pathname === '/api/assessment') {
      return handleAssessment(request, env, ctx);
    }

    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return handleAdmin(request, env, url);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ ok: false, error: 'Not found' }, 404);
    }

    const asset = await env.ASSETS.fetch(request);
    return withSecurityHeaders(asset, url);
  },
} satisfies ExportedHandler<Env>;

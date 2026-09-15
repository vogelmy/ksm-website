/**
 * POST /api/intake
 *
 * Receives the client intake questionnaire from /intake, stores the answers as
 * JSON, emails KSM a full readout, sends the client a short confirmation with
 * the document list, and updates their pipeline row. Row first, everything
 * else best-effort — same rule as the other endpoints.
 */

import { SECTIONS, ALL_QUESTIONS, DEBT_COLUMNS, DOCUMENTS } from '../src/data/intake';
import { upsertSheetLead, type SheetsEnv } from './sheets';

export interface IntakeEnv extends SheetsEnv {
  DB: D1Database;
  LEAD_TO: string;
  LEAD_BCC?: string;
  LEAD_FROM_NAME: string;
  SITE_NAME: string;
  BREVO_API_KEY?: string;
  LEAD_FROM?: string;
}

interface Payload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company_website?: string;
  answers?: Record<string, unknown>;
  debts?: Record<string, unknown>[];
  referrer?: string;
}

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
    out += (code < 0x20 && code !== 0x0a) || code === 0x7f ? ' ' : ch;
  }
  return out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
};

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );

export async function handleIntake(request: Request, env: IntakeEnv, ctx: ExecutionContext): Promise<Response> {
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
  if (errors.length) return json({ ok: false, error: 'Please check the highlighted fields.', fields: errors }, 400);

  // Keep only known question ids; everything is stored as text.
  const answers: Record<string, string> = {};
  const raw = body.answers && typeof body.answers === 'object' ? body.answers : {};
  for (const [id, v] of Object.entries(raw)) {
    if (!ALL_QUESTIONS.has(id)) continue;
    const s = clean(typeof v === 'number' ? String(v) : v, 1500);
    if (s) answers[id] = s;
  }
  const debts = (Array.isArray(body.debts) ? body.debts.slice(0, 40) : []).map((r) => {
    const row: Record<string, string> = {};
    for (const c of DEBT_COLUMNS) row[c.id] = clean(r?.[c.id], 80);
    return row;
  }).filter((r) => Object.values(r).some(Boolean));

  const business = answers.business_name || '';
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? '';

  try {
    await env.DB.prepare(
      `INSERT INTO intakes (id, created_at, first_name, last_name, email, phone, business, answers, debts, referrer, ip, country)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        id, createdAt, contact.firstName, contact.lastName, contact.email, contact.phone, business,
        JSON.stringify(answers), JSON.stringify(debts), contact.referrer, ip, country
      )
      .run();
  } catch (err) {
    console.error('intake insert failed', err);
    return json({ ok: false, error: 'We could not save your answers. Please try again.' }, 500);
  }

  const forks = SECTIONS.flatMap((s) => s.questions.filter((q) => q.fork && answers[q.id]).map((q) => `${q.label.replace(/[?:].*$/, '')}: ${answers[q.id]}`));
  ctx.waitUntil(
    Promise.all([
      notifyKsm(env, { id, createdAt, ...contact, business, answers, debts }),
      confirmClient(env, contact),
      upsertSheetLead(env, {
        name: `${contact.firstName} ${contact.lastName}`,
        business,
        source: 'Intake questionnaire',
        stage: '4. Call completed',
        phone: contact.phone,
        email: contact.email,
        note: `Intake received (${Object.keys(answers).length} answers, ${debts.length} accounts). ${forks.slice(0, 3).join('; ').slice(0, 400)}`,
        nextAction: 'Review intake in /admin; chase documents; build position map',
        dueDays: 3,
      }),
    ])
  );

  return json({ ok: true, id });
}

// ---------------------------------------------------------------------------

interface Stored {
  id: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  business: string;
  answers: Record<string, string>;
  debts: Record<string, string>[];
}

function addresses(list?: string) {
  return (list || '').split(',').map((s) => s.trim()).filter(Boolean).map((email) => ({ email }));
}

async function send(env: IntakeEnv, msg: Record<string, unknown>): Promise<void> {
  if (!env.BREVO_API_KEY || !env.LEAD_FROM) {
    console.log('intake email skipped (email not configured)');
    return;
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { email: env.LEAD_FROM, name: env.LEAD_FROM_NAME || 'KSM' }, ...msg }),
    });
    if (!res.ok) console.error('brevo intake send failed', res.status, await res.text());
  } catch (err) {
    console.error('brevo intake send threw', err);
  }
}

/** Full readout to KSM, grouped by section, forks highlighted. */
export function intakeReadoutHtml(a: Stored): string {
  const sections = SECTIONS.map((s) => {
    const rows = s.questions
      .filter((q) => a.answers[q.id])
      .map(
        (q) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eef1f6;color:#5b6b82;font-size:13px;width:46%;vertical-align:top">${esc(q.label)}${q.fork ? ' <span style="color:#A8481B;font-size:10px;letter-spacing:.08em;text-transform:uppercase">forks</span>' : ''}</td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #eef1f6;color:#0f1d33;font-size:14px;font-weight:500;vertical-align:top;white-space:pre-wrap">${esc(a.answers[q.id])}</td></tr>`
      )
      .join('');
    if (!rows) return '';
    return `<tr><td style="padding:22px 28px 4px"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8592a6">${esc(s.title)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">${rows}</table></td></tr>`;
  }).join('');

  const debtRows = a.debts.length
    ? `<tr><td style="padding:22px 28px 4px"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8592a6">Accounts (${a.debts.length})</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;font-size:12.5px">
      <tr>${DEBT_COLUMNS.map((c) => `<th style="text-align:left;padding:6px 6px 6px 0;color:#8592a6;font-weight:500;font-size:10px;letter-spacing:.06em;text-transform:uppercase">${esc(c.label)}</th>`).join('')}</tr>
      ${a.debts.map((r) => `<tr>${DEBT_COLUMNS.map((c) => `<td style="padding:6px 6px 6px 0;border-top:1px solid #eef1f6;color:#0f1d33">${esc(r[c.id] || '—')}</td>`).join('')}</tr>`).join('')}
      </table></td></tr>`
    : '';

  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;padding:24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#22374f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e4e8ef;border-radius:16px;overflow:hidden">
<tr><td style="background:#0a1425;padding:22px 28px">
<div style="font-size:18px;font-weight:800;color:#fff">Intake received — ${esc(a.firstName)} ${esc(a.lastName)}</div>
<div style="font-size:12px;color:#8592a6;margin-top:4px;text-transform:uppercase;letter-spacing:.14em">${esc(a.business || 'Business not given')}</div>
</td></tr>
<tr><td style="padding:18px 28px 0;font-size:14px">
<a href="mailto:${esc(a.email)}" style="color:#2b57f0">${esc(a.email)}</a>${a.phone ? ` · ${esc(a.phone)}` : ''} · ${Object.keys(a.answers).length} answers · ${a.debts.length} accounts · <a href="https://ksm-strategy.com/admin#intakes" style="color:#2b57f0">Open in admin</a>
</td></tr>
${sections}${debtRows}
<tr><td style="padding:18px 28px 26px;font-size:12px;color:#8592a6;line-height:1.6">Self-reported. Documents to follow by email from the client. Reply to this email to reach them directly.</td></tr>
</table></body></html>`;
}

async function notifyKsm(env: IntakeEnv, a: Stored): Promise<void> {
  const to = addresses(env.LEAD_TO);
  const bcc = addresses(env.LEAD_BCC);
  if (!to.length && !bcc.length) return;
  const text = SECTIONS.map((s) =>
    [s.title.toUpperCase(), ...s.questions.filter((q) => a.answers[q.id]).map((q) => `${q.label}: ${a.answers[q.id]}`)].join('\n')
  ).join('\n\n');
  await send(env, {
    to: to.length ? to : bcc,
    ...(to.length && bcc.length ? { bcc } : {}),
    replyTo: { email: a.email, name: `${a.firstName} ${a.lastName}` },
    subject: `Intake — ${a.firstName} ${a.lastName}${a.business ? ` (${a.business})` : ''}`,
    htmlContent: intakeReadoutHtml(a),
    textContent: text,
  });
}

async function confirmClient(env: IntakeEnv, c: { firstName: string; email: string }): Promise<void> {
  const docs = DOCUMENTS.map(([t, d]) => `<li style="margin:0 0 8px"><strong>${esc(t)}</strong>${d ? `<br><span style="color:#5b6b82;font-size:13px">${esc(d)}</span>` : ''}</li>`).join('');
  await send(env, {
    to: [{ email: c.email }],
    replyTo: { email: env.LEAD_TO, name: env.SITE_NAME || 'KSM' },
    subject: 'Your intake is with KSM — documents to send next',
    htmlContent: `<!doctype html><html><body style="margin:0;background:#f4f6fa;padding:24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#22374f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e4e8ef;border-radius:16px;overflow:hidden">
<tr><td style="background:#0a1425;padding:22px 28px"><div style="font-size:18px;font-weight:800;color:#fff">Thank you, ${esc(c.firstName)}.</div>
<div style="font-size:12px;color:#8592a6;margin-top:4px;text-transform:uppercase;letter-spacing:.14em">${esc(env.SITE_NAME || 'Kallus Strategic Management')}</div></td></tr>
<tr><td style="padding:24px 28px;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px">Your answers are in. To build the profile properly we verify from documents — please reply to this email with as many of the following as you can. Partial is better than delayed.</p>
<ol style="padding-left:20px;margin:0 0 18px">${docs}</ol>
<p style="margin:0;font-size:13px;color:#8592a6;line-height:1.6">Kallus Strategic Management is not a lender, loan broker, credit repair organization or debt settlement company and does not guarantee any financing outcome. Your information is used only to prepare your financial profile.</p>
</td></tr></table></body></html>`,
    textContent: `Thank you, ${c.firstName}. Your answers are in. Please reply with:\n\n${DOCUMENTS.map(([t]) => `- ${t}`).join('\n')}\n\nPartial is better than delayed.`,
  });
}

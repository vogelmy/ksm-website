/**
 * Password-protected lead dashboard at /admin.
 *
 * HTTP Basic Auth over TLS, checked against a Wrangler secret. Deliberately
 * server-rendered from the Worker rather than built into the static site, so
 * no part of it can ever be served without passing the auth check.
 */

import { SECTIONS } from '../src/data/assessment';

/** qid -> { prompt, options } so stored weights can be shown as real answers. */
const QUESTIONS = new Map(
  SECTIONS.flatMap((section) =>
    section.questions.map((q) => [q.id, { section: section.title, prompt: q.prompt, options: q.options }])
  )
);

function answerLines(raw: string | null): [string, string, string][] {
  if (!raw) return [];
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const out: [string, string, string][] = [];
  for (const [id, value] of Object.entries(parsed)) {
    const q = QUESTIONS.get(id);
    if (!q) continue;
    const opt = q.options.find((o) => String(o.value) === String(value));
    out.push([q.section, q.prompt, opt ? opt.label : String(value)]);
  }
  return out;
}

export interface AdminEnv {
  DB: D1Database;
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
}

interface LeadRow {
  id: string;
  created_at: string;
  identity: string;
  goal: string | null;
  timeline: string | null;
  concerns: string | null;
  notes: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  page: string | null;
  referrer: string | null;
  country: string | null;
}

interface AssessmentRow {
  id: string;
  created_at: string;
  identity: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  score: number;
  band: string;
  weakest: string | null;
  cash_flow: number;
  debt: number;
  credit: number;
  liquidity: number;
  income: number;
  capital: number;
  answers: string | null;
}

const COMPONENT_LABELS: Record<string, string> = {
  'cash-flow': 'Cash flow',
  debt: 'Debt',
  credit: 'Credit',
  liquidity: 'Liquidity',
  income: 'Income',
  capital: 'Capital',
};

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );

/** Length-independent comparison so a wrong password leaks no timing signal. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function unauthorized(): Response {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="KSM admin", charset="UTF-8"',
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

function authorized(request: Request, env: AdminEnv): boolean {
  const expectedPass = env.ADMIN_PASSWORD;
  if (!expectedPass) return false;
  const expectedUser = env.ADMIN_USER || 'ksm';

  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('basic ')) return false;

  let decoded = '';
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  const i = decoded.indexOf(':');
  if (i < 0) return false;

  const user = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  // Both comparisons always run — no early exit on the username.
  const okUser = safeEqual(user, expectedUser);
  const okPass = safeEqual(pass, expectedPass);
  return okUser && okPass;
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export async function handleAdmin(request: Request, env: AdminEnv, url: URL): Promise<Response> {
  if (!env.ADMIN_PASSWORD) {
    return new Response(
      'Admin is not configured. Set the ADMIN_PASSWORD secret with: wrangler secret put ADMIN_PASSWORD',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } }
    );
  }
  if (!authorized(request, env)) return unauthorized();

  const { results } = await env.DB.prepare(
    `SELECT id, created_at, identity, goal, timeline, concerns, notes,
            first_name, last_name, email, phone, page, referrer, country
       FROM leads
      ORDER BY created_at DESC
      LIMIT 500`
  ).all<LeadRow>();

  const rows = results ?? [];

  const assessRes = await env.DB.prepare(
    `SELECT id, created_at, identity, first_name, last_name, email, phone,
            score, band, weakest, cash_flow, debt, credit, liquidity, income, capital, answers
       FROM assessments
      ORDER BY created_at DESC
      LIMIT 500`
  ).all<AssessmentRow>();
  const assessments = assessRes.results ?? [];

  if (url.pathname === '/admin/export.csv') {
    const headers = [
      'received',
      'first_name',
      'last_name',
      'email',
      'phone',
      'type',
      'goal',
      'timeline',
      'pressure_points',
      'notes',
      'submitted_from',
      'referrer',
      'country',
      'id',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.created_at,
          r.first_name,
          r.last_name,
          r.email,
          r.phone,
          r.identity === 'business' ? 'Business owner' : 'Individual',
          r.goal,
          r.timeline,
          (r.concerns || '').replace(/\s*\|\s*/g, '; '),
          r.notes,
          r.page,
          r.referrer,
          r.country,
          r.id,
        ]
          .map(csvCell)
          .join(',')
      );
    }
    return new Response('﻿' + lines.join('\r\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="ksm-leads.csv"',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  const now = Date.now();
  const since = (days: number) => rows.filter((r) => now - Date.parse(r.created_at) < days * 864e5).length;
  const business = rows.filter((r) => r.identity === 'business').length;

  const stats: [string, string | number][] = [
    ['Total requests', rows.length],
    ['Last 7 days', since(7)],
    ['Last 30 days', since(30)],
    ['Business owners', business],
    ['Individuals', rows.length - business],
    ['Assessments', assessments.length],
  ];

  const body = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Leads · KSM admin</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  :root{--ink:#0F1D33;--ink6:#3A5068;--ink4:#8592A6;--line:#E4E8EF;--brand:#2B57F0;--cream:#FBFAF5;--good:#2F9E68}
  *{box-sizing:border-box}
  body{margin:0;background:#F4F6FA;color:var(--ink6);
       font:400 15px/1.5 Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
  header{background:#0A1425;color:#fff;padding:22px 28px;display:flex;flex-wrap:wrap;
         gap:16px;align-items:center;justify-content:space-between}
  header h1{margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em;color:#fff}
  header p{margin:4px 0 0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink4);
           font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .btn{display:inline-block;background:var(--brand);color:#fff;text-decoration:none;font-weight:600;
       font-size:13px;padding:10px 16px;border-radius:999px}
  main{padding:28px;max-width:1500px;margin:0 auto}
  .stats{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);
         border-radius:14px;overflow:hidden;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
  .stat{background:#fff;padding:18px 20px}
  .stat b{display:block;font-size:28px;font-weight:800;color:var(--ink);letter-spacing:-.02em;
          font-variant-numeric:tabular-nums}
  .stat span{display:block;margin-top:4px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;
             color:var(--ink4);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .bar{display:flex;gap:12px;align-items:center;margin:24px 0 14px;flex-wrap:wrap}
  input[type=search]{flex:1;min-width:220px;padding:11px 14px;border:1px solid var(--line);
                     border-radius:10px;font:inherit;background:#fff;color:var(--ink)}
  input[type=search]:focus{outline:2px solid var(--brand);outline-offset:1px}
  .count{font-size:13px;color:var(--ink4)}
  .wrap{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:auto}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th{position:sticky;top:0;background:#fff;text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);
     font:500 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;
     text-transform:uppercase;color:var(--ink4);white-space:nowrap;z-index:1}
  td{padding:13px 14px;border-bottom:1px solid #EEF1F6;vertical-align:top}
  tr:last-child td{border-bottom:0}
  tr:hover td{background:var(--cream)}
  .who{font-weight:600;color:var(--ink);white-space:nowrap}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--ink4);white-space:nowrap}
  a{color:var(--brand)}
  .tag{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap}
  .tag.biz{background:#EFF3FF;color:#1E42CC}
  .tag.ind{background:#E7F5ED;color:#1F7A4E}
  .notes{max-width:280px;color:var(--ink6)}
  .empty{padding:60px 24px;text-align:center;color:var(--ink4)}
  h2.sec{margin:30px 0 12px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink4);
         font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500}
  .score{font-size:20px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}
  tr.answers td{background:var(--cream);padding:0 14px}
  tr.answers summary{cursor:pointer;padding:11px 0;font-size:13px;font-weight:600;color:var(--brand)}
  ol.qa{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:9px}
  ol.qa li{display:grid;grid-template-columns:110px 1fr 230px;gap:14px;align-items:baseline;
           font-size:13px;padding-bottom:9px;border-bottom:1px solid #e8ebf1}
  ol.qa li:last-child{border-bottom:0}
  ol.qa .sec{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;
             letter-spacing:.12em;text-transform:uppercase;color:var(--ink4)}
  ol.qa .q{color:var(--ink6)}
  ol.qa .a{color:var(--ink);font-weight:600}
  @media (max-width:900px){ol.qa li{grid-template-columns:1fr}}
  .score i{font-size:11px;font-style:normal;color:var(--ink4);font-weight:600}
  @media (max-width:700px){main{padding:16px}td,th{padding:10px}}
</style>
</head><body>
<header>
  <div><h1>Profile requests</h1><p>Kallus Strategic Management</p></div>
  <a class="btn" href="/admin/export.csv">Download CSV</a>
</header>
<main>
  <div class="stats">
    ${stats.map(([l, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}
  </div>

  ${
    assessments.length
      ? `<h2 class="sec">Assessment results</h2>
  <div class="wrap">
    <table><thead><tr>
      <th>Received</th><th>Score</th><th>Name</th><th>Contact</th><th>Type</th>
      <th>Weakest</th><th>Cash flow</th><th>Debt</th><th>Credit</th><th>Liquidity</th><th>Income</th><th>Capital</th>
    </tr></thead><tbody>
    ${assessments
      .map(
        (a) => `<tr>
      <td class="mono">${esc(fmtDate(a.created_at))}</td>
      <td><span class="score">${esc(a.score)}<i>/10</i></span><br><span class="mono">${esc(a.band)}</span></td>
      <td class="who">${esc(a.first_name)} ${esc(a.last_name)}</td>
      <td><a href="mailto:${esc(a.email)}">${esc(a.email)}</a>${
          a.phone ? `<br><span class="mono">${esc(a.phone)}</span>` : ''
        }</td>
      <td><span class="tag ${a.identity === 'business' ? 'biz' : 'ind'}">${
          a.identity === 'business' ? 'Business' : 'Individual'
        }</span></td>
      <td class="mono">${esc(COMPONENT_LABELS[a.weakest || ''] || a.weakest || '—')}</td>
      <td class="mono">${esc(a.cash_flow)}</td>
      <td class="mono">${esc(a.debt)}</td>
      <td class="mono">${esc(a.credit)}</td>
      <td class="mono">${esc(a.liquidity)}</td>
      <td class="mono">${esc(a.income)}</td>
      <td class="mono">${esc(a.capital)}</td>
    </tr>
    ${
      answerLines(a.answers).length
        ? `<tr class="answers"><td colspan="12">
            <details>
              <summary>See all 12 answers from ${esc(a.first_name)} ${esc(a.last_name)}</summary>
              <ol class="qa">
                ${answerLines(a.answers)
                  .map(
                    ([sec, prompt, ans]) =>
                      `<li><span class="sec">${esc(sec)}</span><span class="q">${esc(prompt)}</span><span class="a">${esc(ans)}</span></li>`
                  )
                  .join('')}
              </ol>
            </details>
          </td></tr>`
        : ''
    }`
      )
      .join('')}
    </tbody></table>
  </div>
  <h2 class="sec">Profile requests</h2>`
      : ''
  }

  <div class="bar">
    <input id="q" type="search" placeholder="Filter by name, email, goal, pressure point…" autocomplete="off">
    <span class="count" id="count">${rows.length} shown</span>
  </div>

  <div class="wrap">
  ${
    rows.length === 0
      ? `<p class="empty">No profile requests yet.<br>Submissions from /start will appear here.</p>`
      : `<table id="t"><thead><tr>
          <th>Received</th><th>Name</th><th>Contact</th><th>Type</th>
          <th>Goal</th><th>Timeline</th><th>Pressure points</th><th>Notes</th><th>Source</th>
        </tr></thead><tbody>
        ${rows
          .map(
            (r) => `<tr>
          <td class="mono">${esc(fmtDate(r.created_at))}</td>
          <td class="who">${esc(r.first_name)} ${esc(r.last_name)}</td>
          <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${
            r.phone ? `<br><span class="mono">${esc(r.phone)}</span>` : ''
          }</td>
          <td><span class="tag ${r.identity === 'business' ? 'biz' : 'ind'}">${
            r.identity === 'business' ? 'Business' : 'Individual'
          }</span></td>
          <td>${esc(r.goal) || '—'}</td>
          <td>${esc(r.timeline) || '—'}</td>
          <td>${esc((r.concerns || '').replace(/\s*\|\s*/g, ', ')) || '—'}</td>
          <td class="notes">${esc(r.notes) || '—'}</td>
          <td class="mono">${esc(r.page) || '—'}${
            r.country ? `<br>${esc(r.country)}` : ''
          }</td>
        </tr>`
          )
          .join('')}
        </tbody></table>`
  }
  </div>
</main>
<script>
  (function () {
    var q = document.getElementById('q');
    var table = document.getElementById('t');
    var count = document.getElementById('count');
    if (!q || !table) return;
    var rows = Array.prototype.slice.call(table.tBodies[0].rows);
    q.addEventListener('input', function () {
      var term = q.value.toLowerCase().trim();
      var shown = 0;
      rows.forEach(function (row) {
        var hit = !term || row.textContent.toLowerCase().indexOf(term) > -1;
        row.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      count.textContent = shown + ' shown';
    });
  })();
</script>
</body></html>`;

  return new Response(body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
    },
  });
}

/**
 * Google Sheets sync for the KSM lead pipeline.
 *
 * Authenticates as a service account (GOOGLE_SA_KEY secret = the JSON key file)
 * with a self-signed RS256 JWT, then upserts one row per person into the
 * Pipeline tab, matched on email. Best-effort: callers run this in
 * ctx.waitUntil and never let it fail the request.
 *
 * Column layout (Pipeline tab):
 *   A Lead · B Business · C Source · D Stage · E Owner · F Phone · G Email ·
 *   H Profile score · I Date in · J Last contact · K Next action · L Due ·
 *   M Days to due (formula) · N Notes · O Brief
 */

export interface SheetsEnv {
  GOOGLE_SA_KEY?: string;
  SHEET_ID?: string;
}

export interface SheetLead {
  name: string;
  business?: string;
  source: string;
  stage: string;
  phone?: string;
  email: string;
  score?: number | string;
  note: string;
  nextAction?: string;
  dueDays?: number;
}

const TAB = 'Pipeline';
const MAX_ROWS = 500;
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const b64url = (data: ArrayBuffer | string): string => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const pemToDer = (pem: string): ArrayBuffer => {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

async function accessToken(keyJson: string): Promise<string> {
  const key = JSON.parse(keyJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(key.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const fmtDate = (d: Date): string =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/New_York' });

/** Add or update the pipeline row for this email. */
export async function upsertSheetLead(env: SheetsEnv, lead: SheetLead): Promise<void> {
  if (!env.GOOGLE_SA_KEY || !env.SHEET_ID) {
    console.log('sheet sync skipped (GOOGLE_SA_KEY / SHEET_ID not configured)');
    return;
  }
  try {
    const token = await accessToken(env.GOOGLE_SA_KEY);
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}`;
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

    const read = await fetch(`${base}/values/${TAB}!A2:N${MAX_ROWS}`, { headers: auth });
    if (!read.ok) throw new Error(`read ${read.status}: ${await read.text()}`);
    const rows = (((await read.json()) as { values?: string[][] }).values ?? []) as string[][];

    const email = lead.email.toLowerCase();
    let rowIndex = -1; // 0-based within rows (sheet row = index + 2)
    let firstEmpty = -1;
    for (let i = 0; i < Math.max(rows.length, 1); i++) {
      const r = rows[i] ?? [];
      if (firstEmpty < 0 && !(r[0] || '').trim()) firstEmpty = i;
      if ((r[6] || '').trim().toLowerCase() === email) { rowIndex = i; break; }
    }
    if (firstEmpty < 0) firstEmpty = rows.length;

    const today = new Date();
    const dateStr = fmtDate(today);
    const due = lead.dueDays != null ? fmtDate(new Date(today.getTime() + lead.dueDays * 864e5)) : '';
    const stamp = `${dateStr}: ${lead.note}`;

    const data: { range: string; values: string[][] }[] = [];
    if (rowIndex >= 0) {
      const sheetRow = rowIndex + 2;
      const existing = rows[rowIndex] ?? [];
      const notes = [existing[13] || '', stamp].filter(Boolean).join(' · ');
      data.push({ range: `${TAB}!J${sheetRow}`, values: [[dateStr]] });
      data.push({ range: `${TAB}!N${sheetRow}`, values: [[notes.slice(0, 4000)]] });
      if (lead.score != null && lead.score !== '') data.push({ range: `${TAB}!H${sheetRow}`, values: [[String(lead.score)]] });
      if (lead.business && !(existing[1] || '').trim()) data.push({ range: `${TAB}!B${sheetRow}`, values: [[lead.business]] });
      if (lead.phone && !(existing[5] || '').trim()) data.push({ range: `${TAB}!F${sheetRow}`, values: [[lead.phone]] });
      if (lead.nextAction) {
        data.push({ range: `${TAB}!K${sheetRow}`, values: [[lead.nextAction]] });
        if (due) data.push({ range: `${TAB}!L${sheetRow}`, values: [[due]] });
      }
    } else {
      const sheetRow = firstEmpty + 2;
      data.push({
        range: `${TAB}!A${sheetRow}:L${sheetRow}`,
        values: [[
          lead.name, lead.business || '', lead.source, lead.stage, 'Motti',
          lead.phone || '', lead.email, lead.score != null ? String(lead.score) : '',
          dateStr, dateStr, lead.nextAction || '', due,
        ]],
      });
      data.push({ range: `${TAB}!N${sheetRow}`, values: [[stamp.slice(0, 4000)]] });
    }

    const write = await fetch(`${base}/values:batchUpdate`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    });
    if (!write.ok) throw new Error(`write ${write.status}: ${await write.text()}`);
  } catch (err) {
    console.error('sheet sync failed', err);
  }
}

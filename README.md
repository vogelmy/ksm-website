# KSM — Kallus Strategic Management

Marketing and lead-capture site for KSM, a financial strategy consulting practice.

**Live:** https://ksm-website.moishyv.workers.dev

---

## Stack

| Layer | Choice |
|---|---|
| Site | Astro 7 (static output) + Tailwind CSS v4 |
| Hosting | Cloudflare Workers with static assets |
| Lead storage | Cloudflare D1 (`ksm-leads`) |
| Lead notification | Brevo transactional email API |
| Fonts | Plus Jakarta Sans (display), Inter (UI), IBM Plex Mono (data labels) |

No client-side framework. Every page is static HTML; the only JavaScript is a
handful of inline scripts (scroll reveal, nav, FAQ accordion, audience tabs, the
profile wizard, and a centralized analytics dispatcher).

---

## Pages

```
/                            Homepage
/financial-profile           What a KSM Financial Profile is
/individuals                 Individuals & families track
/business                    Business owners track
/cash-flow-optimization      Service page
/debt-strategy               Service page
/financing-readiness         Service page
/how-it-works                Five-step process, deliverable, FAQ
/about                       Practice, beliefs, what KSM is not
/insights                    Article index
/insights/<slug>             6 long-form articles
/start                       4-step profile wizard (primary conversion)
/thank-you                   Post-submission confirmation
/privacy /terms /disclosures Legal
/404                         Not found
/admin                       Lead dashboard (Basic Auth, not in the sitemap)
/admin/export.csv            CSV of all leads
```

---

## The KSM Profile Score

`src/data/profile.ts` is the single source of truth for the scoring model.

The headline figure is **0–10, where 10 is the strongest funding-ready
position**, shown to one decimal beside a ten-segment dial. Single digits are
deliberate: consumer credit scores are three digits, so this scale cannot be
mistaken for one. A band descriptor ("Solid", "Developing") always travels with
the number so it never arrives as a bare figure.

The hero dashboard is interactive: moving any component recomputes the score and
swaps the KSM Insight to the line belonging to whichever component is weakest.
Pass `interactive={true}` to enable it, `values={[...]}` to set a starting
position, and neither to render a read-only version.

---

## Content compliance

`npm run check:content` scans the built HTML and **fails the build** if any
credit-repair, credit-improvement or guaranteed-outcome claim appears. It runs
automatically inside both `npm run build` and `npm run deploy`.

Negation is judged per sentence, so a disclaimer elsewhere on the page cannot
excuse a claim made here:

```
Allowed   KSM is not a credit repair organization.
Allowed   Is KSM a debt settlement company? No. KSM does not ...
Blocked   We raise your score. KSM is not a lender.
```

Rules live in `scripts/check-content.mjs`. Add terms there rather than relying
on anyone remembering the constraint.

---

## Local development

```bash
npm install
npm run dev            # http://localhost:4321
```

Preview the built site through the Worker (D1 runs locally):

```bash
npm run build
npx wrangler dev
```

---

## Deploy

```bash
npm run deploy         # astro build && wrangler deploy
```

---

## Lead capture

`POST /api/lead` is handled by `worker/index.ts`. Each submission is:

1. Validated and sanitized (honeypot, same-origin check, field limits).
2. Written to the D1 `leads` table — this must succeed or the request fails.
3. Emailed to `LEAD_TO` via Brevo, best-effort in `ctx.waitUntil()`. Email
   failure never fails the request, because the lead is already durable.

### Configuration

Plain vars live in `wrangler.jsonc`:

| Var | Purpose |
|---|---|
| `LEAD_TO` | Comma-separated notification recipients |
| `LEAD_FROM_NAME` | Display name on the notification |
| `SITE_NAME` | Used in the email header |

Secrets are set with Wrangler, never committed:

```bash
wrangler secret put BREVO_API_KEY
wrangler secret put LEAD_FROM      # must be a verified Brevo sender
```

### Reading leads

The dashboard at `/admin` lists every request with stats, filtering and CSV
export. It is rendered by the Worker behind HTTP Basic Auth, sent `no-store`
and `noindex`, and disallowed in `robots.txt`.

```bash
wrangler secret put ADMIN_PASSWORD    # rotate the password
```

`ADMIN_USER` is a plain var in `wrangler.jsonc` (default `ksm`).

Straight from the database:

```bash
wrangler d1 execute ksm-leads --remote \
  --command "SELECT created_at, first_name, last_name, email, identity, goal, concerns FROM leads ORDER BY created_at DESC LIMIT 20"
```

### Migrations

```bash
wrangler d1 migrations apply ksm-leads --remote
```

---

## Analytics

`window.ksm.track(event, props)` in `src/layouts/Base.astro` is the single
dispatch point. It forwards to `gtag`, `posthog` and `dataLayer` if any of them
are present, so adding a provider means adding one script tag and nothing else.

Events fired: `page_view`, `hero_cta_click`, `hero_secondary_click`,
`individual_click`, `business_click`, `profile_start`, `profile_step_1..4`,
`profile_completed`, `profile_error`, `faq_open`, `email_click`,
`scroll_25/50/75/100`, plus per-CTA events via the `data-ev` attribute.

Any element gains tracking by adding `data-ev="event_name"` — no JS change
required.

---

## Content

Nav, footer, the six profile components, the five process steps, the FAQ and the
article index all live in `src/data/site.ts`. Editing copy there updates every
page that uses it.

---

## Compliance notes

The site states in several places that KSM is not a lender, broker, credit
repair organization, debt settlement company, credit reporting agency or
investment adviser, and that no financing outcome is guaranteed. Every score,
metric and sample report is labelled illustrative. There are no testimonials,
client logos, awards or statistics anywhere on the site — those sections are
built to receive real material later rather than filled with invented content.

Do not remove the disclaimers in `src/components/Footer.astro`,
`src/pages/disclosures.astro` or the illustrative-example labels under the
dashboards without legal review.

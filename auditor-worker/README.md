# fakan-auditor

Autonomní audit webů. Form na fakan.cz → 5min → mail s reportem → 3 mail-drip → konverze.

## Architektura

```
[POST /api/audit]
  → Worker (handlers/audit.js)  validate + ratelimit + cache check
  → D1: lead + audit row (queued)
  → Queue: { kind: 'audit', auditId, ... }

[Queue consumer]
  → puppeteer (Browser Rendering)
  → checks: axe, cookies, headers, seo, cms, perf
  → score + persist findings
  → R2: screenshot + (později) PDF report
  → KV: 7-day cache per doména
  → scheduleEmail('audit_done', now)
  → enqueue { kind: 'strategist' }

[Strategist]
  → Claude API (sonnet-4-5, JSON output)
  → strategist_outputs row
  → scheduleEmail('strategist', T+2d)
  → scheduleEmail('offer', T+5d)
  → scheduleEmail('reaudit_30d', T+30d)

[Cron */15min]
  → dispatchPendingMail: vyzvedne queued maily, pošle přes Resend, označí sent
```

## Setup

```bash
# 1. závislosti
npm install

# 2. vytvořit cloudflare resources
wrangler d1 create fakan_auditor
wrangler kv namespace create AUDIT_CACHE
wrangler kv namespace create RATELIMIT
wrangler r2 bucket create fakan-reports
wrangler queues create fakan-audit-jobs
wrangler queues create fakan-audit-dlq

# 3. doplň ID do wrangler.toml

# 4. inicializovat schéma
npm run db:init

# 5. tajemství
wrangler secret put RESEND_API_KEY
wrangler secret put ANTHROPIC_API_KEY

# 6. deploy
npm run deploy
```

## Form na fakan.cz volá:

```js
fetch('https://api.fakan.cz/api/audit', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: '...',
    email: '...',
    consent: true,
    website: ''   // honeypot
  })
})
```

## Co dodělat (po MVP)

- [ ] PDF generování reportu (R2)
- [ ] ARES enrichment z domény (lead segmentation)
- [ ] Lighthouse v puppeteer (LCP, CLS, TBT) místo jen `performance.timing`
- [ ] Wappalyzer-style fingerprint pro CMS detekci
- [ ] Admin UI pro lead pipeline (kanban — máš to v hlavě)
- [ ] Re-audit přes čas: ukládat sérii skóre per doména

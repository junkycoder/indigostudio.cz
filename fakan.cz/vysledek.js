// Klient pro /api/analyze SSE stream.
// Žije bez frameworku, žádné cookies, žádný localStorage. Jen DOM + EventSource.

(() => {
  const params = new URLSearchParams(location.search);
  const target = (params.get('url') || '').trim();

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const stageLabel = $('stageLabel');
  const verdictsBox = $('verdicts');
  const titleEl = $('title');
  const targetUrlEl = $('targetUrl');
  const ctaNext = $('ctaNext');
  const ctaMail = $('ctaMail');

  if (!target) {
    showError('Chybí URL. Vyplň formulář na úvodní stránce.');
    return;
  }

  targetUrlEl.textContent = target;
  document.title = `Analýza ${target} — fakan.cz`;

  const es = new EventSource('/api/analyze?url=' + encodeURIComponent(target));
  let analysisStarted = Date.now();
  let finalHost = target;

  const handlers = {
    hello: (data) => {
      finalHost = data.host || finalHost;
    },
    stage: (data) => {
      setStage(data.label || '…', 'loading');
    },
    status: renderStatus,
    headers: renderSecurity,
    cookies: renderCookies,
    trackers: renderTrackers,
    stack: renderStack,
    banners: renderBanners,
    meta: renderMeta,
    score: renderScore,
    body: () => { /* informational; nothing to render */ },
    done: (data) => {
      es.close();
      const ms = data?.totalMs || (Date.now() - analysisStarted);
      setStage(`Hotovo za ${formatMs(ms)}.`, 'done');
      titleEl.textContent = 'Tvůj web pod drobnohledem';
      // Vyčisti případně pending karty.
      document.querySelectorAll('.card[data-state="pending"]').forEach((card) => {
        card.dataset.state = 'empty';
        card.querySelector('.card-body').textContent = 'Žádná data.';
      });
      showCta();
    },
    error: (data) => {
      es.close();
      showError(data?.message || 'Něco se rozbilo.');
    },
  };

  Object.keys(handlers).forEach((evt) => {
    es.addEventListener(evt, (e) => {
      let data = null;
      try { data = JSON.parse(e.data); } catch { /* ignored */ }
      handlers[evt](data);
    });
  });

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      // Spojení skončilo bez done → ber jako chybu, pokud ještě nezahlášeno.
      if (stage.dataset.state === 'loading') {
        showError('Spojení se serverem se přerušilo.');
      }
    }
  };

  // ---------- Renderers ----------

  function renderStatus(data) {
    const card = $('card-status');
    const body = card.querySelector('.card-body');
    const badge = $('status-badge');

    const status = data.status;
    const tone = status >= 200 && status < 300 ? 'good' : status >= 400 ? 'bad' : 'warn';
    badge.textContent = `HTTP ${status}`;
    badge.dataset.tone = tone;

    const finalUrl = safeUrl(data.finalUrl);
    body.innerHTML = '';
    body.appendChild(buildKv([
      ['Cílová URL', mono(data.finalUrl)],
      data.redirected ? ['Přesměrování', `ano · ${data.fetchMs} ms`] : ['Přesměrování', `ne · ${data.fetchMs} ms`],
      ['Schéma', data.isHttps ? text('HTTPS', 'ok') : text('HTTP — bez šifrování', 'bad')],
      finalUrl ? ['Host', mono(finalUrl.host)] : null,
    ]));
    card.dataset.state = 'done';
  }

  function renderSecurity(data) {
    const card = $('card-security');
    const body = card.querySelector('.card-body');
    const score = Number(data.securityScore || 0);
    const gauge = $('security-gauge');
    gauge.style.setProperty('--p', String(score));
    $('security-score').textContent = String(score);
    gauge.style.setProperty('background', `conic-gradient(${gaugeColor(score)} ${score}%, var(--line) 0)`);

    body.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'list';
    for (const h of data.headers) {
      const li = document.createElement('li');
      const status = h.present
        ? `<span class="ok">✓</span>`
        : `<span class="bad">✗</span>`;
      li.innerHTML =
        `${status} <span class="name">${escapeHtml(h.name)}</span>` +
        ` <span class="note">${escapeHtml(h.note)}${h.value ? ` · <code>${escapeHtml(truncate(h.value, 80))}</code>` : ''}</span>`;
      ul.appendChild(li);
    }
    body.appendChild(ul);

    const meta = [];
    if (data.server) meta.push(['Server', mono(data.server)]);
    if (data.poweredBy) meta.push(['X-Powered-By', mono(data.poweredBy)]);
    if (meta.length) {
      const dl = buildKv(meta);
      dl.style.marginTop = '14px';
      body.appendChild(dl);
    }
    card.dataset.state = 'done';
  }

  function renderCookies(data) {
    const card = $('card-cookies');
    const body = card.querySelector('.card-body');
    const badge = $('cookies-badge');

    const count = data.count || 0;
    badge.textContent = count === 0 ? 'žádné' : `${count}`;
    badge.dataset.tone = count === 0 ? 'good' : data.trackingLikeCount > 0 ? 'bad' : 'warn';

    body.innerHTML = '';
    if (count === 0) {
      const p = document.createElement('p');
      p.className = 'note';
      p.style.cssText = 'margin: 0; color: var(--green); font-size: 14px;';
      p.textContent = 'Server neposlal žádné cookies. Žádný banner pak není potřeba.';
      body.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'list';
      for (const c of data.cookies) {
        const li = document.createElement('li');
        const flags = [];
        if (c.secure) flags.push('Secure');
        if (c.httpOnly) flags.push('HttpOnly');
        if (c.sameSite) flags.push(`SameSite=${escapeHtml(c.sameSite)}`);
        const isTracker = looksTracker(c.name);
        li.innerHTML =
          `<span class="${isTracker ? 'bad' : 'name'}">${escapeHtml(c.name)}</span>` +
          (isTracker ? ` <span class="note">vypadá jako tracking cookie</span>` : '') +
          (flags.length ? ` <span class="note">${flags.join(' · ')}</span>` : '');
        ul.appendChild(li);
      }
      body.appendChild(ul);
    }
    card.dataset.state = 'done';
  }

  function renderTrackers(data) {
    const card = $('card-trackers');
    const body = card.querySelector('.card-body');
    const badge = $('trackers-badge');

    badge.textContent = data.length === 0 ? 'žádné' : `${data.length}`;
    badge.dataset.tone = data.length === 0 ? 'good' : data.some(t => t.severity === 'high') ? 'bad' : 'warn';

    body.innerHTML = '';
    if (!data.length) {
      const p = document.createElement('p');
      p.style.cssText = 'margin: 0; color: var(--green); font-size: 14px;';
      p.textContent = 'Žádné známé trackery. Slušná práce.';
      body.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'list';
      for (const t of data) {
        const li = document.createElement('li');
        const sev = t.severity === 'high' ? 'bad' : t.severity === 'medium' ? 'warn' : 'name';
        li.innerHTML = `<span class="${sev}">${escapeHtml(t.name)}</span>` +
          (t.note ? ` <span class="note">${escapeHtml(t.note)}</span>` : '');
        ul.appendChild(li);
      }
      body.appendChild(ul);
    }
    card.dataset.state = 'done';
  }

  function renderStack(data) {
    const card = $('card-stack');
    const body = card.querySelector('.card-body');
    const badge = $('stack-badge');

    badge.textContent = data.length === 0 ? 'neznámé' : `${data.length}`;
    badge.dataset.tone = data.length > 0 ? 'good' : 'warn';

    body.innerHTML = '';
    if (!data.length) {
      const p = document.createElement('p');
      p.style.cssText = 'margin: 0; color: var(--muted); font-size: 14px;';
      p.textContent = 'Stack se nepodařilo identifikovat. Buď je to čistá statika (dobré), nebo je obfuskovaný.';
      body.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'list';
      for (const s of data) {
        const li = document.createElement('li');
        li.innerHTML = `<span class="name">${escapeHtml(s.name)}</span>` +
          (s.note ? ` <span class="note">${escapeHtml(s.note)}</span>` : '');
        ul.appendChild(li);
      }
      body.appendChild(ul);
    }
    card.dataset.state = 'done';
  }

  function renderBanners(data) {
    const card = $('card-banners');
    const body = card.querySelector('.card-body');
    const badge = $('banners-badge');

    body.innerHTML = '';
    if (!data.length) {
      badge.textContent = 'žádný';
      badge.dataset.tone = 'good';
      const p = document.createElement('p');
      p.style.cssText = 'margin: 0; color: var(--green); font-size: 14px;';
      p.textContent = 'Žádný známý cookie banner. Pokud nejsou cookies, ani nemá co řešit.';
      body.appendChild(p);
    } else {
      badge.textContent = `${data.length}`;
      badge.dataset.tone = 'warn';
      const ul = document.createElement('ul');
      ul.className = 'list';
      for (const b of data) {
        const li = document.createElement('li');
        li.innerHTML = `<span class="warn">${escapeHtml(b.name)}</span>` +
          ` <span class="note">U nás by nebyl potřeba — neukládáme cookies.</span>`;
        ul.appendChild(li);
      }
      body.appendChild(ul);
    }
    card.dataset.state = 'done';
  }

  function renderMeta(data) {
    const card = $('card-meta');
    const body = card.querySelector('.card-body');
    const badge = $('meta-badge');

    let critCount = 0;
    if (!data.title) critCount++;
    if (!data.description) critCount++;
    if (!data.viewport) critCount++;
    if (data.h1Count === 0) critCount++;
    badge.textContent = critCount === 0 ? 'OK' : `${critCount} ${critCount === 1 ? 'problém' : critCount < 5 ? 'problémy' : 'problémů'}`;
    badge.dataset.tone = critCount === 0 ? 'good' : critCount > 1 ? 'bad' : 'warn';

    body.innerHTML = '';
    body.appendChild(buildKv([
      ['Title', data.title ? `${escapeHtml(data.title)} <span class="note" style="display:inline">(${data.titleLength} znaků)</span>` : text('chybí', 'bad')],
      ['Description', data.description ? `${escapeHtml(data.description)} <span class="note" style="display:inline">(${data.descriptionLength} znaků)</span>` : text('chybí', 'bad')],
      ['Lang', data.lang ? mono(data.lang) : text('chybí', 'warn')],
      ['Viewport', data.viewport ? mono(data.viewport) : text('chybí', 'bad')],
      ['Robots', data.robots ? mono(data.robots) : text('výchozí (index, follow)', 'name')],
      ['Generator', data.generator ? escapeHtml(data.generator) : '—'],
      ['Canonical', data.canonical ? mono(data.canonical) : text('chybí', 'warn')],
      ['JSON-LD bloků', String(data.jsonLdCount)],
      ['<h1> na stránce', data.h1Count === 1 ? text('1', 'ok') : text(String(data.h1Count), data.h1Count === 0 ? 'bad' : 'warn')],
    ]));
    card.dataset.state = 'done';
  }

  function renderScore(data) {
    if (!data.verdicts || !data.verdicts.length) return;
    verdictsBox.hidden = false;
    verdictsBox.innerHTML = '';
    for (const v of data.verdicts) {
      const div = document.createElement('div');
      div.className = 'verdict';
      div.dataset.kind = v.kind;
      div.textContent = v.text;
      verdictsBox.appendChild(div);
    }
  }

  // OG dorazí jako součást meta.og — zobrazíme zvlášť až máme meta.
  // Prosté řešení: přepsat meta handler tak, aby po renderu zavolal i renderOg.
  const origMetaHandler = handlers.meta;
  handlers.meta = (data) => {
    origMetaHandler(data);
    renderOg(data.og || {}, data.twitter || {});
  };

  function renderOg(og, twitter) {
    const card = $('card-og');
    const body = card.querySelector('.card-body');
    const badge = $('og-badge');

    const hasAny = og.title || og.description || og.image;
    badge.textContent = hasAny ? (og.image ? 'OK' : 'částečně') : 'chybí';
    badge.dataset.tone = og.image ? 'good' : hasAny ? 'warn' : 'bad';

    body.innerHTML = '';
    if (!hasAny) {
      const p = document.createElement('p');
      p.style.cssText = 'margin: 0; color: var(--muted); font-size: 14px;';
      p.textContent = 'Žádné Open Graph tagy. Sdílení na Facebooku, LinkedInu nebo Slacku vypadá smutně.';
      body.appendChild(p);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'og-preview';

      if (og.image) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = absolutize(og.image);
        img.referrerPolicy = 'no-referrer';
        img.onerror = () => { img.style.display = 'none'; };
        wrap.appendChild(img);
      }
      const txt = document.createElement('div');
      txt.className = 'og-text';
      txt.innerHTML =
        `<div class="og-host">${escapeHtml(finalHost)}</div>` +
        `<div class="og-title">${escapeHtml(og.title || '(bez og:title)')}</div>` +
        `<div class="og-desc">${escapeHtml(og.description || '(bez og:description)')}</div>`;
      wrap.appendChild(txt);
      body.appendChild(wrap);

      // Twitter card extras
      const extras = [];
      if (twitter.card) extras.push(['Twitter card', mono(twitter.card)]);
      if (og.type) extras.push(['og:type', mono(og.type)]);
      if (og.locale) extras.push(['og:locale', mono(og.locale)]);
      if (extras.length) {
        const dl = buildKv(extras);
        dl.style.marginTop = '14px';
        body.appendChild(dl);
      }
    }
    card.dataset.state = 'done';
  }

  function showError(message) {
    setStage(message, 'error');
    titleEl.textContent = 'Analýza neproběhla';
    document.querySelectorAll('.card[data-state="pending"]').forEach((card) => {
      card.dataset.state = 'empty';
      card.querySelector('.card-body').textContent = '—';
    });
    showCta();
  }

  function showCta() {
    ctaNext.hidden = false;
    if (target) {
      const subject = encodeURIComponent('Konzultace k webu: ' + target);
      const body = encodeURIComponent('Ahoj,\n\nudělal jsem si free analýzu webu ' + target + ' a rád bych to s vámi probral.\n\nDíky!');
      ctaMail.href = 'mailto:jsem@fakan.cz?subject=' + subject + '&body=' + body;
    } else {
      ctaMail.href = 'mailto:jsem@fakan.cz';
    }
  }

  function setStage(label, state) {
    stageLabel.textContent = label;
    stage.dataset.state = state;
  }

  // ---------- Helpers ----------

  function buildKv(rows) {
    const dl = document.createElement('dl');
    dl.className = 'kv';
    for (const row of rows) {
      if (!row) continue;
      const [k, v] = row;
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd');
      if (typeof v === 'string') dd.innerHTML = v;
      else if (v instanceof Node) dd.appendChild(v);
      else dd.textContent = String(v);
      dl.appendChild(dt); dl.appendChild(dd);
    }
    return dl;
  }

  function text(s, cls) {
    return `<span class="${cls}">${escapeHtml(s)}</span>`;
  }

  function mono(s) {
    return `<span class="mono">${escapeHtml(s)}</span>`;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function safeUrl(s) {
    try { return new URL(s); } catch { return null; }
  }

  function absolutize(src) {
    try { return new URL(src, 'https://' + finalHost).toString(); } catch { return src; }
  }

  function looksTracker(name) {
    const n = name.toLowerCase();
    return n.startsWith('_ga') || n.startsWith('_gid') || n.startsWith('_gat') ||
           n.startsWith('_fbp') || n.startsWith('_fbc') ||
           n.startsWith('_hj') || n.startsWith('hubspotutk') ||
           n.startsWith('_pin_') || n.startsWith('_uet') ||
           n === 'fr' || n === 'tr' || n.startsWith('sklik');
  }

  function gaugeColor(score) {
    if (score >= 75) return 'var(--green)';
    if (score >= 40) return 'var(--orange)';
    return 'var(--burgundy)';
  }

  function formatMs(ms) {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }
})();

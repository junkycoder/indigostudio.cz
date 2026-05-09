// src/audit/checks/axe.js
// V puppeteeru injektni axe-core a spusť kontrolu.
// V produkci načítej axe-core ze CDN nebo ho bundluj.

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js';

const SEVERITY_MAP = { critical: 'critical', serious: 'high', moderate: 'medium', minor: 'low' };

export async function runAxe(page) {
  try {
    await page.addScriptTag({ url: AXE_CDN });
    const result = await page.evaluate(async () => {
      // @ts-ignore
      return await window.axe.run(document, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        resultTypes: ['violations'],
      });
    });
    const findings = (result?.violations || []).slice(0, 30).map(v => ({
      category: 'a11y',
      severity: SEVERITY_MAP[v.impact] || 'low',
      title: v.help,
      detail: `${v.nodes.length} prvků: ${v.description}`,
      fix_hint: v.helpUrl ? `Návod: ${v.helpUrl}` : '',
      weight: v.nodes.length > 5 ? 2 : 1,
    }));
    return { findings };
  } catch (err) {
    return { findings: [{
      category: 'a11y', severity: 'info',
      title: 'A11y kontrola se nespustila', detail: err.message, weight: 0,
    }] };
  }
}

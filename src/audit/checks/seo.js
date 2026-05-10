// src/audit/checks/seo.js
//
// Sbírá SEO meta data jako STRINGY (ne jen booly), aby je SPA mohla vykreslit
// jako náhledy: Google + Seznam SERP, Facebook/LinkedIn OG card, Twitter card.
//
// Vrací:
//   {
//     title, titleLength, metaDescription, metaDescriptionLength,
//     canonical, lang, hreflang: [{ hreflang, href }],
//     h1Count, imgWithoutAlt, imgTotal,
//     og:      { title, description, image, url, type, siteName },
//     twitter: { card, title, description, image, site },
//     jsonLd:  [{ type, name, ... }],   // raw types extracted from <script type="application/ld+json">
//     robotsMeta: 'index,follow' | 'noindex,nofollow' | null,
//   }

const TITLE_OK_MIN = 30;     // Google typicky cropuje pod ~30 znaků zobrazí celý
const TITLE_OK_MAX = 60;     // přes ~60 znaků v SERP cropuje "..."
const DESC_OK_MIN = 70;
const DESC_OK_MAX = 160;     // Google ~155-160, Seznam ~200, vzít přísnější

export async function checkSeo(page) {
  return await page.evaluate(() => {
    const get = (sel, attr = 'content') =>
      document.querySelector(sel)?.getAttribute(attr) || null;
    const getAll = (sel) => [...document.querySelectorAll(sel)];

    const title = (document.title || '').trim() || null;
    const metaDescription = get('meta[name="description"]');

    // Hreflang varianty.
    const hreflang = getAll('link[rel="alternate"][hreflang]').map((el) => ({
      hreflang: el.getAttribute('hreflang') || '',
      href:     el.getAttribute('href')     || '',
    }));

    // JSON-LD blocky — extrahuj typy + jména. Tichý parser, nepád'e na vadných JSON.
    const jsonLd = [];
    for (const script of getAll('script[type="application/ld+json"]')) {
      try {
        const raw = (script.textContent || '').trim();
        if (!raw) continue;
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          // Schema.org @graph wrapper.
          const graph = Array.isArray(item['@graph']) ? item['@graph'] : [item];
          for (const node of graph) {
            if (!node || typeof node !== 'object') continue;
            const type = Array.isArray(node['@type']) ? node['@type'].join(', ') : (node['@type'] || null);
            if (!type) continue;
            jsonLd.push({
              type,
              name: node.name || node.headline || node.legalName || null,
            });
            if (jsonLd.length >= 20) break;
          }
          if (jsonLd.length >= 20) break;
        }
      } catch { /* tichý fail — vadný JSON-LD je sám o sobě finding */ }
    }

    // Obrázky — počet bez alt + celkový počet (kontextová informace).
    const imgs = getAll('img');
    const imgWithoutAlt = imgs.filter((i) => !i.getAttribute('alt')).length;

    return {
      title,
      titleLength:           title ? title.length : 0,
      metaDescription,
      metaDescriptionLength: metaDescription ? metaDescription.length : 0,
      canonical:             get('link[rel="canonical"]', 'href'),
      lang:                  document.documentElement.lang || null,
      h1Count:               getAll('h1').length,
      imgTotal:              imgs.length,
      imgWithoutAlt,
      hreflang,
      jsonLd,
      robotsMeta:            get('meta[name="robots"]'),

      og: {
        title:       get('meta[property="og:title"]'),
        description: get('meta[property="og:description"]'),
        image:       get('meta[property="og:image"]'),
        url:         get('meta[property="og:url"]'),
        type:        get('meta[property="og:type"]'),
        siteName:    get('meta[property="og:site_name"]'),
      },
      twitter: {
        card:        get('meta[name="twitter:card"]'),
        title:       get('meta[name="twitter:title"]'),
        description: get('meta[name="twitter:description"]'),
        image:       get('meta[name="twitter:image"]'),
        site:        get('meta[name="twitter:site"]'),
      },
    };
  });
}

// Doplňkové findings k délce title/description, které processor.js zavolá
// vedle stávajícího buildFindings. Drží se v seo.js, aby pravidla
// (TITLE_OK_*, DESC_OK_*) byly na jednom místě.
export function buildSeoLengthFindings(seoData) {
  const f = [];
  if (seoData.title && seoData.titleLength > TITLE_OK_MAX) {
    f.push({
      category: 'seo', severity: 'low',
      title: 'Titulek stránky se v Google ořízne',
      detail: `Titulek má ${seoData.titleLength} znaků, Google v SERP zobrazí jen prvních ~${TITLE_OK_MAX}.`,
      fix_hint: `Zkrátit pod ${TITLE_OK_MAX} znaků a klíčové slovo nechat na začátku.`,
      weight: 1,
    });
  }
  if (seoData.title && seoData.titleLength < TITLE_OK_MIN) {
    f.push({
      category: 'seo', severity: 'low',
      title: 'Titulek stránky je krátký',
      detail: `Titulek má ${seoData.titleLength} znaků. Pod ${TITLE_OK_MIN} znaků nese málo informace.`,
      fix_hint: `Doplnit popis nabídky a lokalitu, ať je hned jasné, o čem to je. Cíl je ${TITLE_OK_MIN}–${TITLE_OK_MAX} znaků.`,
      weight: 1,
    });
  }
  if (seoData.metaDescription && seoData.metaDescriptionLength > DESC_OK_MAX) {
    f.push({
      category: 'seo', severity: 'low',
      title: 'Popis stránky se v Google ořízne',
      detail: `Popis má ${seoData.metaDescriptionLength} znaků, Google zobrazí jen ~${DESC_OK_MAX}.`,
      fix_hint: `Zkrátit pod ${DESC_OK_MAX} znaků, ať si Google nedopisuje vlastní text.`,
      weight: 1,
    });
  }
  if (seoData.metaDescription && seoData.metaDescriptionLength < DESC_OK_MIN) {
    f.push({
      category: 'seo', severity: 'low',
      title: 'Popis stránky je krátký',
      detail: `Popis má ${seoData.metaDescriptionLength} znaků, optimum je ${DESC_OK_MIN}–${DESC_OK_MAX}.`,
      fix_hint: 'Doplnit, co návštěvník na stránce najde a proč by měl kliknout.',
      weight: 1,
    });
  }
  // Robots meta = "noindex" je vážné — Google web indexovat nebude.
  if (seoData.robotsMeta && /noindex/i.test(seoData.robotsMeta)) {
    f.push({
      category: 'seo', severity: 'critical',
      title: 'Stránka má zákaz indexace',
      detail: `Meta robots = "${seoData.robotsMeta}". Google webu zakazuje, aby se objevil ve vyhledávání.`,
      fix_hint: 'Zkontrolovat, jestli to je záměr (testovací prostředí?). Na produkci tag odstranit.',
      weight: 5,
    });
  }
  // Žádný h1 nebo víc h1 — pomáhá hierarchii.
  if (seoData.h1Count === 0) {
    f.push({
      category: 'seo', severity: 'medium',
      title: 'Stránka nemá hlavní nadpis',
      detail: 'Není tag <h1>, který by Google řekl, o čem stránka je.',
      fix_hint: 'Doplnit hlavní nadpis (<h1>) — typicky název služby + lokalita.',
      weight: 2,
    });
  } else if (seoData.h1Count > 1) {
    f.push({
      category: 'seo', severity: 'low',
      title: 'Stránka má víc hlavních nadpisů',
      detail: `Tagů <h1> je ${seoData.h1Count}. Google čeká jen jeden, aby věděl, co je hlavní téma.`,
      fix_hint: 'Ponechat jeden <h1>, ostatní zmenšit na <h2>.',
      weight: 1,
    });
  }
  // Obrázky bez popisku.
  if (seoData.imgWithoutAlt > 0 && seoData.imgTotal > 0) {
    const pct = Math.round((seoData.imgWithoutAlt / seoData.imgTotal) * 100);
    if (pct >= 30) {
      f.push({
        category: 'seo', severity: 'medium',
        title: 'Obrázky nemají textový popis',
        detail: `${seoData.imgWithoutAlt} z ${seoData.imgTotal} obrázků (${pct} %) nemá popisek (alt). Google ani čtečky pak nevědí, co na nich je.`,
        fix_hint: 'Doplnit alt u obsahových obrázků (ne dekorativních). Stačí krátká věta toho, co je vidět.',
        weight: 2,
      });
    }
  }
  // OG / Twitter náhled — pokud chybí, sdílení vypadá genericky.
  const hasOg = seoData.og?.title || seoData.og?.image;
  if (!hasOg) {
    f.push({
      category: 'seo', severity: 'low',
      title: 'Sdílení na sociálních sítích vypadá genericky',
      detail: 'Chybí Open Graph tagy. Když někdo sdílí Váš web na Facebooku nebo LinkedInu, vidí jen URL bez náhledu a popisu.',
      fix_hint: 'Přidat <meta property="og:title">, og:description a og:image (1200×630 px).',
      weight: 1,
    });
  }
  return f;
}

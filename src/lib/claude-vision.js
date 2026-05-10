// src/lib/claude-vision.js
//
// Anthropic Messages API klient s Vision podporou. Žádné npm SDK, jen fetch.
//
// Doc:  https://docs.anthropic.com/en/api/messages
// Vision: max 5 obrázků na zprávu, doporučená max edge 1568 px, max 5 MB base64.
// Model: claude-sonnet-4-5 (per CLAUDE.md, deterministicky).

const API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS_OUT = 8192;

// Volá Claude s polem obrázků + textovým briefem + system promptem.
// Vrátí { text, usage } — `text` je raw odpověď, sanitaci řeší volající.
export async function callVision(env, { systemPrompt, briefText, images }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY není nastaveno');
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('callVision: musí být alespoň jeden obrázek');
  }
  if (images.length > 5) {
    throw new Error('callVision: max 5 obrázků na zprávu');
  }

  const content = [];
  for (const img of images) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
    });
  }
  content.push({ type: 'text', text: briefText });

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS_OUT,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  };

  const resp = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const err = new Error(`Claude API ${resp.status}: ${errText.slice(0, 500)}`);
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  // content je pole content blocks; pro náš case čekáme jeden text block.
  const textBlock = (data.content || []).find((c) => c.type === 'text');
  if (!textBlock) throw new Error('Claude vrátil odpověď bez textu');

  return {
    text: textBlock.text,
    usage: data.usage || {},
    requestId: data.id,
  };
}

// Pomocná: ArrayBuffer → base64 string. Workers má nodejs_compat,
// takže Buffer je dostupný.
export function bufferToBase64(arrayBuffer) {
  // eslint-disable-next-line no-undef
  return Buffer.from(arrayBuffer).toString('base64');
}

// src/lib/files.js
//
// Validace + uložení uživatelských uploadů do R2. Limity:
//   - max 10 souborů
//   - max 20 MB total
//   - per-file limit 10 MB
//   - allowed: PNG, JPG, WebP, PDF, DOC(X), TXT
//
// MIME sniff přes magic bytes (prvních 12 bajtů). Spoléhat na browserem
// reportované Content-Type je hloupé — útočník pošle .exe s text/plain.

const MAX_FILES        = 10;
const MAX_TOTAL_BYTES  = 20 * 1024 * 1024;
const MAX_PER_FILE     = 10 * 1024 * 1024;

// [magic-bytes-prefix-hex, mime, extension]
const SIGNATURES = [
  ['89504e470d0a1a0a',                 'image/png',  'png'],
  ['ffd8ff',                           'image/jpeg', 'jpg'],
  ['52494646',                         'image/webp', 'webp'],   // RIFF…WEBP — zkontroluje se ještě offset 8
  ['25504446',                         'application/pdf', 'pdf'],
  ['504b0304',                         'application/zip', 'docx'], // DOCX = ZIP container; rozlišení dle ext
  ['d0cf11e0a1b11ae1',                 'application/msword', 'doc'],
];

function bytesToHex(arr, len) {
  return [...arr.slice(0, len)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sniff(buffer, originalName) {
  const head = new Uint8Array(buffer.slice(0, 16));
  const headHex = bytesToHex(head, 16);

  for (const [prefix, mime, ext] of SIGNATURES) {
    if (headHex.startsWith(prefix)) {
      // WebP refinement
      if (mime === 'image/webp') {
        const tag = bytesToHex(head.slice(8, 12), 4);
        if (tag !== '57454250') continue; // 'WEBP'
      }
      // DOC/DOCX rozlišení podle přípony — oba mají stejný container
      if (mime === 'application/zip' && /\.docx$/i.test(originalName)) {
        return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
      }
      // .txt nemá magic bytes — povolíme jen pokud nic nematchnulo (níž)
      return { mime, ext };
    }
  }
  // Plain text — žádný magic byte, jen ASCII / UTF-8 first bytes
  if (/\.(txt|md)$/i.test(originalName)) {
    let allTextish = true;
    for (let i = 0; i < Math.min(head.length, 16); i++) {
      const b = head[i];
      if (b === 0) { allTextish = false; break; }
      if (b < 0x09 && b !== 0x0A && b !== 0x0D) { allTextish = false; break; }
    }
    if (allTextish) return { mime: 'text/plain', ext: 'txt' };
  }
  return null;
}

// Z formy vezme všechny `file_*` fieldy. Vrátí pole { name, mime, bytes, buffer }.
// Throws s `code='LIMIT'` při přečerpání limitů, `code='TYPE'` při nepovoleném MIME.
export async function collectUploads(formData) {
  const out = [];
  let total = 0;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('file_')) continue;
    if (typeof value === 'string') continue;     // FormData input bez souboru
    if (out.length >= MAX_FILES) {
      const e = new Error('Maximálně 10 souborů.'); e.code = 'LIMIT'; throw e;
    }
    if (value.size > MAX_PER_FILE) {
      const e = new Error('Soubor přesahuje 10 MB.'); e.code = 'LIMIT'; throw e;
    }
    total += value.size;
    if (total > MAX_TOTAL_BYTES) {
      const e = new Error('Soubory dohromady přesahují 20 MB.'); e.code = 'LIMIT'; throw e;
    }
    const buffer = await value.arrayBuffer();
    const det = sniff(buffer, value.name || '');
    if (!det) {
      const e = new Error(`Nepovolený typ souboru: ${value.name}.`); e.code = 'TYPE'; throw e;
    }
    out.push({
      originalName: value.name || `file-${out.length}`,
      mime: det.mime,
      ext: det.ext,
      bytes: value.size,
      buffer,
    });
  }
  return out;
}

// Uloží soubor do R2 pod prefixem `suggestions/{orderId}/{i}.{ext}`.
// Vrátí pole metadat pro `suggestions.files_json`.
export async function storeUploadsToR2(env, orderId, uploads) {
  const meta = [];
  for (let i = 0; i < uploads.length; i++) {
    const f = uploads[i];
    const r2Key = `suggestions/${orderId}/${i}.${f.ext}`;
    await env.REPORTS.put(r2Key, f.buffer, {
      httpMetadata: { contentType: f.mime },
      customMetadata: { originalName: f.originalName, orderId },
    });
    meta.push({
      r2_key: r2Key,
      original_name: f.originalName,
      mime: f.mime,
      bytes: f.bytes,
    });
  }
  return meta;
}

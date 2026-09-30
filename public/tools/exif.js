// EXIF v JPEG: čtení a zápis bez knihoven. Hodnoty se uchovávají jako surové bajty
// v pořadí původního souboru, nezměněné údaje se tak zapíší zpět beze ztráty.
// Pozn.: údaje výrobce (MakerNote) se přenášejí beze změny; některé obsahují
// vlastní odkazy do souboru, které po přeskládání nemusí sedět.

const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0, 0];
const XMP_ID = [...'http://ns.adobe.com/xap/1.0/\0'].map(c => c.charCodeAt(0));
const EXIF_POINTER = 0x8769, GPS_POINTER = 0x8825, INTEROP_POINTER = 0xA005;
const THUMB_OFFSET = 0x0201, THUMB_LENGTH = 0x0202;

const startsWith = (bytes, prefix, at = 0) => prefix.every((b, i) => bytes[at + i] === b);
export const isJpeg = bytes => bytes[0] === 0xFF && bytes[1] === 0xD8;

// Segmenty JPEG až po začátek obrazových dat (SOS); zbytek souboru se kopíruje beze změny.
export function jpegSegments(bytes) {
  if (!isJpeg(bytes)) throw Error('Soubor není JPEG.');
  const segments = [];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xFF) throw Error('Poškozená struktura JPEG.');
    const marker = bytes[i + 1];
    if (marker === 0xFF) { i++; continue; }
    if (marker === 0xDA || marker === 0xD9) { segments.push({ marker, data: bytes.subarray(i) }); break; }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    segments.push({ marker, data: bytes.subarray(i, i + 2 + length) });
    i += 2 + length;
  }
  return segments;
}

const isExifSegment = s => s.marker === 0xE1 && startsWith(s.data, EXIF_ID, 4);
const isXmpSegment = s => s.marker === 0xE1 && startsWith(s.data, XMP_ID, 4);

export const emptyExif = () => ({ little: false, ifd0: new Map(), exif: new Map(), gps: new Map(), interop: new Map(), ifd1: new Map(), thumbnail: null });

export function readExif(bytes) {
  const segments = jpegSegments(bytes);
  const segment = segments.find(isExifSegment), xmp = segments.find(isXmpSegment);
  const meta = segment ? parseTiff(segment.data.subarray(4 + EXIF_ID.length)) : emptyExif();
  meta.hasExif = Boolean(segment);
  meta.xmp = xmp ? new TextDecoder().decode(xmp.data.subarray(4 + XMP_ID.length)) : '';
  return meta;
}

function parseTiff(tiff) {
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const order = view.getUint16(0);
  if (order !== 0x4949 && order !== 0x4D4D) throw Error('Neplatná hlavička EXIF.');
  const little = order === 0x4949;
  const readIfd = offset => {
    const entries = new Map();
    if (!offset || offset + 2 > tiff.length) return { entries, next: 0 };
    const count = view.getUint16(offset, little);
    for (let k = 0; k < count; k++) {
      const at = offset + 2 + k * 12;
      if (at + 12 > tiff.length) break;
      const tag = view.getUint16(at, little), type = view.getUint16(at + 2, little), n = view.getUint32(at + 4, little);
      const size = (SIZES[type] || 0) * n;
      if (!size) continue;
      const start = size <= 4 ? at + 8 : view.getUint32(at + 8, little);
      if (start + size > tiff.length) continue;
      entries.set(tag, { type, count: n, bytes: tiff.slice(start, start + size) });
    }
    const next = offset + 2 + count * 12;
    return { entries, next: next + 4 <= tiff.length ? view.getUint32(next, little) : 0 };
  };
  const pointer = (ifd, tag) => { const e = ifd.get(tag); return e && e.bytes.length === 4 ? new DataView(e.bytes.buffer).getUint32(0, little) : 0; };
  const first = readIfd(view.getUint32(4, little));
  const exif = readIfd(pointer(first.entries, EXIF_POINTER)).entries;
  const second = first.next ? readIfd(first.next).entries : new Map();
  const thumbStart = pointer(second, THUMB_OFFSET), thumbLength = pointer(second, THUMB_LENGTH);
  return {
    little,
    ifd0: first.entries,
    exif,
    gps: readIfd(pointer(first.entries, GPS_POINTER)).entries,
    interop: readIfd(pointer(exif, INTEROP_POINTER)).entries,
    ifd1: second,
    thumbnail: thumbStart && thumbLength && thumbStart + thumbLength <= tiff.length ? tiff.slice(thumbStart, thumbStart + thumbLength) : null,
  };
}

// Hodnota položky jako číslo, text, pole čísel, nebo zlomek [čitatel, jmenovatel].
export function entryValue(entry, little) {
  const { type, count, bytes } = entry;
  if (type === 2) return new TextDecoder().decode(bytes).replace(/\0+$/, '').trim();
  if (type === 7) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = Array.from({ length: count }, (_, i) => {
    const at = i * SIZES[type];
    switch (type) {
      case 1: return view.getUint8(at);
      case 3: return view.getUint16(at, little);
      case 4: return view.getUint32(at, little);
      case 5: return [view.getUint32(at, little), view.getUint32(at + 4, little)];
      case 6: return view.getInt8(at);
      case 8: return view.getInt16(at, little);
      case 9: return view.getInt32(at, little);
      case 10: return [view.getInt32(at, little), view.getInt32(at + 4, little)];
      case 11: return view.getFloat32(at, little);
      default: return view.getFloat64(at, little);
    }
  });
  return count === 1 ? values[0] : values;
}

// Prázdný text položku odstraní. Text se zapisuje jako UTF-8 (běžná praxe i u exiftool).
export function setText(ifd, tag, text) {
  if (!text) { ifd.delete(tag); return; }
  const bytes = new TextEncoder().encode(`${text}\0`);
  ifd.set(tag, { type: 2, count: bytes.length, bytes });
}

// Nový segment APP1 s EXIF; když se nevejde do 64 kB, vynechá se náhled.
export function encodeExifSegment(meta) {
  for (const withThumbnail of [true, false]) {
    const tiff = encodeTiff(meta, withThumbnail);
    const length = 2 + EXIF_ID.length + tiff.length;
    if (length > 0xFFFF) continue;
    const segment = new Uint8Array(2 + length);
    segment.set([0xFF, 0xE1, length >> 8, length & 0xFF]);
    segment.set(EXIF_ID, 4);
    segment.set(tiff, 4 + EXIF_ID.length);
    return segment;
  }
  throw Error('Údaje EXIF jsou příliš velké.');
}

function encodeTiff(meta, withThumbnail) {
  const { little } = meta;
  const ifd0 = new Map(meta.ifd0), exif = new Map(meta.exif), gps = new Map(meta.gps), interop = new Map(meta.interop);
  const thumbnail = withThumbnail && meta.thumbnail && meta.ifd1.size ? meta.thumbnail : null;
  const ifd1 = thumbnail ? new Map(meta.ifd1) : new Map();
  const long = () => ({ type: 4, count: 1, bytes: new Uint8Array(4) });
  [EXIF_POINTER, GPS_POINTER, INTEROP_POINTER].forEach(tag => { ifd0.delete(tag); exif.delete(tag); });
  if (interop.size && exif.size) exif.set(INTEROP_POINTER, long());
  if (exif.size) ifd0.set(EXIF_POINTER, long());
  if (gps.size) ifd0.set(GPS_POINTER, long());
  if (thumbnail) { ifd1.set(THUMB_OFFSET, long()); ifd1.set(THUMB_LENGTH, long()); }

  // Rozvržení: každý adresář (IFD) následují jeho delší hodnoty, na konci náhled.
  const order = [ifd0, exif, exif.size ? interop : new Map(), gps, ifd1].filter((ifd, i) => i === 0 || ifd.size);
  const sizeOf = ifd => [...ifd.values()].reduce((sum, e) => sum + (e.bytes.length > 4 ? e.bytes.length + (e.bytes.length & 1) : 0), 6 + ifd.size * 12);
  const offsets = new Map();
  let end = 8;
  for (const ifd of order) { offsets.set(ifd, end); end += sizeOf(ifd); }
  const thumbnailAt = end;
  if (thumbnail) end += thumbnail.length;

  const setLong = (ifd, tag, value) => { if (ifd.has(tag)) new DataView(ifd.get(tag).bytes.buffer).setUint32(0, value, little); };
  setLong(ifd0, EXIF_POINTER, offsets.get(exif) || 0);
  setLong(ifd0, GPS_POINTER, offsets.get(gps) || 0);
  setLong(exif, INTEROP_POINTER, offsets.get(interop) || 0);
  setLong(ifd1, THUMB_OFFSET, thumbnailAt);
  setLong(ifd1, THUMB_LENGTH, thumbnail?.length || 0);

  const out = new Uint8Array(end), view = new DataView(out.buffer);
  out.set(little ? [0x49, 0x49] : [0x4D, 0x4D]);
  view.setUint16(2, 42, little);
  view.setUint32(4, 8, little);
  for (const ifd of order) {
    const at = offsets.get(ifd), tags = [...ifd.keys()].sort((a, b) => a - b);
    let data = at + 6 + tags.length * 12;
    view.setUint16(at, tags.length, little);
    tags.forEach((tag, k) => {
      const e = ifd.get(tag), p = at + 2 + k * 12;
      view.setUint16(p, tag, little);
      view.setUint16(p + 2, e.type, little);
      view.setUint32(p + 4, e.count, little);
      if (e.bytes.length <= 4) out.set(e.bytes, p + 8);
      else { view.setUint32(p + 8, data, little); out.set(e.bytes, data); data += e.bytes.length + (e.bytes.length & 1); }
    });
    view.setUint32(at + 2 + tags.length * 12, ifd === ifd0 && ifd1.size ? offsets.get(ifd1) : 0, little);
  }
  if (thumbnail) out.set(thumbnail, thumbnailAt);
  return out;
}

// Složí JPEG znovu: nahradí EXIF, případně odstraní XMP nebo všechna metadata.
// Při úplném odstranění zůstává JFIF (APP0), barevný profil ICC (APP2) a Adobe (APP14).
export function rebuildJpeg(bytes, { exif = null, dropXmp = false, stripAll = false } = {}) {
  const kept = jpegSegments(bytes).filter(s => {
    if (stripAll) return !(s.marker === 0xFE || (s.marker >= 0xE1 && s.marker <= 0xEF && s.marker !== 0xE2 && s.marker !== 0xEE));
    return !isExifSegment(s) && !(dropXmp && isXmpSegment(s));
  });
  const parts = [new Uint8Array([0xFF, 0xD8])];
  const insertAt = kept.findIndex(s => s.marker !== 0xE0);
  kept.forEach((s, i) => { if (exif && i === insertAt) parts.push(exif); parts.push(s.data); });
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0);
  return out;
}

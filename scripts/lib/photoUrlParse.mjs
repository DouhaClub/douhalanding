const DOUBLE_PHOTO_PREFIX = 'double::';
const WIDE_PHOTO_PREFIX = 'wide::';

export function parsePhotoEntry(entry) {
  const raw = String(entry || '').trim();
  if (!raw) return { mode: 'single', primary: '', secondary: '' };
  if (raw.startsWith(WIDE_PHOTO_PREFIX)) {
    const primary = raw.slice(WIDE_PHOTO_PREFIX.length).trim();
    return { mode: 'wide', primary, secondary: '' };
  }
  if (!raw.startsWith(DOUBLE_PHOTO_PREFIX)) {
    return { mode: 'single', primary: raw, secondary: '' };
  }
  const body = raw.slice(DOUBLE_PHOTO_PREFIX.length);
  const [primary, secondary] = body.split('||');
  const p = String(primary || '').trim();
  const s = String(secondary || '').trim();
  if (p && s) return { mode: 'double', primary: p, secondary: s };
  if (p) return { mode: 'wide', primary: p, secondary: '' };
  return { mode: 'single', primary: raw, secondary: '' };
}

/** Extrai URLs de imagem de uma entrada da galeria (single/wide/double). */
export function extractUrlsFromGalleryEntry(entry) {
  const parsed = parsePhotoEntry(entry);
  const urls = [];
  if (parsed.primary) urls.push(parsed.primary);
  if (parsed.secondary) urls.push(parsed.secondary);
  return urls;
}

const SITE_CONTENT_IMAGE_KEYS = [
  'experienceHeroImageUrl',
  'experienceCopyBannerBgUrl',
  'setsBannerBgUrl',
  'rolePhotosStageBgUrl',
  'footerLogoUrl',
];

export function extractUrlsFromSiteContentPayload(payload) {
  if (!payload || typeof payload !== 'object') return [];
  return SITE_CONTENT_IMAGE_KEYS
    .map((key) => String(payload[key] || '').trim())
    .filter(Boolean);
}

/** Substitui URLs dentro de uma entrada da galeria (single/wide/double). */
export function replaceUrlsInGalleryEntry(entry, replacer) {
  const parsed = parsePhotoEntry(entry);
  const primary = replacer(parsed.primary) ?? parsed.primary;
  const secondary = parsed.secondary ? (replacer(parsed.secondary) ?? parsed.secondary) : '';

  if (parsed.mode === 'double' && primary && secondary) {
    return `${DOUBLE_PHOTO_PREFIX}${primary}||${secondary}`;
  }
  if (parsed.mode === 'wide' || (parsed.mode === 'double' && primary && !secondary)) {
    return `${WIDE_PHOTO_PREFIX}${primary}`;
  }
  return primary;
}

/** Atualiza campos de imagem no payload de douha_site_content. */
export function replaceUrlsInSiteContentPayload(payload, replacer) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  for (const key of SITE_CONTENT_IMAGE_KEYS) {
    const current = String(out[key] || '').trim();
    if (!current) continue;
    out[key] = replacer(current) ?? current;
  }
  return out;
}

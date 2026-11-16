/**
 * URLs de mídia no estilo CircoLoco: o arquivo master fica no Storage;
 * o visitante recebe uma versão redimensionada (sem crop) via Supabase Image Transform.
 *
 * Cobre:
 * - URLs `.../storage/v1/object/public/...`
 * - Paths locais espelhados no Storage (`/gallery/...`, `/role-photos/...`, `/events/...`)
 *
 * data:, YouTube, brand SVG/PNG estático etc. passam intactos.
 */

const OBJECT_PUBLIC = '/storage/v1/object/public/';
const RENDER_PUBLIC = '/storage/v1/render/image/public/';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

/** Larguras típicas no site (CSS px ≈ device pixels / densidades comuns). */
export const MEDIA_WIDTH = {
  poster: 720,
  poster2x: 1080,
  role: 420,
  role2x: 720,
  hero: 900,
  heroWide: 1400,
  banner: 1600,
  editorial: 800,
  gallery: 1000,
  footerLogo: 400,
  avatar: 96,
};

function isSupabasePublicObjectUrl(url) {
  return url.includes(OBJECT_PUBLIC) || url.includes(RENDER_PUBLIC);
}

/**
 * Paths locais que já existem no Storage (cópia/migração do public/).
 * Sem isso o site continua baixando JPG/PNG master de /gallery e /role-photos.
 */
function localPublicPathToSupabaseObjectUrl(url) {
  if (!SUPABASE_URL) return '';
  const raw = String(url || '').trim();
  if (!raw.startsWith('/')) return '';

  const pathOnly = raw.split('?')[0].split('#')[0];

  if (pathOnly.startsWith('/gallery/')) {
    return `${SUPABASE_URL}${OBJECT_PUBLIC}douha-posters${pathOnly}`;
  }
  if (pathOnly.startsWith('/events/')) {
    return `${SUPABASE_URL}${OBJECT_PUBLIC}douha-posters${pathOnly}`;
  }
  if (pathOnly.startsWith('/role-photos/')) {
    const file = pathOnly.slice('/role-photos/'.length);
    return `${SUPABASE_URL}${OBJECT_PUBLIC}douha-role-photos/role-photos/${file}`;
  }
  return '';
}

function toTransformableUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (isSupabasePublicObjectUrl(raw)) return raw;
  return localPublicPathToSupabaseObjectUrl(raw) || raw;
}

/**
 * @param {string} url
 * @param {{ width?: number, quality?: number, resize?: 'contain' | 'cover' | 'fill' }} [opts]
 * @returns {string}
 */
export function optimizeMediaUrl(url, opts = {}) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  const transformable = toTransformableUrl(raw);
  if (!isSupabasePublicObjectUrl(transformable)) return raw;

  const {
    width,
    quality = 75,
    /** contain = encaixa sem cortar (pedido do Douha). */
    resize = 'contain',
  } = opts;

  try {
    const absolute = transformable.startsWith('http://') || transformable.startsWith('https://')
      ? transformable
      : `https://placeholder.local${transformable.startsWith('/') ? '' : '/'}${transformable}`;
    const u = new URL(absolute);

    if (u.pathname.includes(OBJECT_PUBLIC)) {
      u.pathname = u.pathname.replace(OBJECT_PUBLIC, RENDER_PUBLIC);
    }

    if (width && Number(width) > 0) {
      u.searchParams.set('width', String(Math.round(Number(width))));
    }
    u.searchParams.set('resize', resize === 'cover' || resize === 'fill' ? resize : 'contain');
    u.searchParams.set(
      'quality',
      String(Math.min(100, Math.max(40, Math.round(Number(quality) || 75)))),
    );

    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * srcSet 1x/2x para posters/cards (só se a URL for transformável).
 * @param {string} url
 * @param {number} width
 * @param {number} [quality]
 */
export function optimizeMediaSrcSet(url, width, quality = 75) {
  const w = Math.round(Number(width) || 0);
  const candidate = toTransformableUrl(url);
  if (!w || !isSupabasePublicObjectUrl(candidate)) return undefined;
  const one = optimizeMediaUrl(url, { width: w, quality });
  const two = optimizeMediaUrl(url, { width: Math.round(w * 1.5), quality });
  if (!one || one === String(url).trim()) return undefined;
  return `${one} 1x, ${two} 1.5x`;
}

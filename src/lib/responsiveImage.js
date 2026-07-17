/** Presets CircoLoco-style: srcset em alta qualidade; o browser escolhe o tamanho certo. */
export const IMAGE_PRESETS = {
  hero: {
    widths: [640, 960, 1280, 1920],
    sizes: '(max-width: 767px) 92vw, (max-width: 1200px) 32vw, 400px',
    fallbackWidth: 1280,
    quality: 90,
  },
  heroWide: {
    widths: [960, 1280, 1920, 2560],
    sizes: '(max-width: 767px) 92vw, (max-width: 1200px) 64vw, 800px',
    fallbackWidth: 1920,
    quality: 90,
  },
  role: {
    widths: [320, 480, 640, 840],
    sizes: '(max-width: 767px) 38vw, 198px',
    fallbackWidth: 640,
    quality: 90,
  },
  poster: {
    widths: [480, 720, 960, 1280],
    sizes: '(max-width: 767px) 46vw, 280px',
    fallbackWidth: 960,
    quality: 90,
  },
  editorial: {
    widths: [640, 960, 1280, 1600],
    sizes: '(max-width: 900px) 92vw, 420px',
    fallbackWidth: 1280,
    quality: 90,
  },
  banner: {
    widths: [960, 1280, 1920],
    sizes: '100vw',
    fallbackWidth: 1920,
    quality: 88,
  },
};

export function toSupabaseRenderBase(url) {
  const raw = String(url || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('/')) return null;
  const marker = '/storage/v1/object/public/';
  if (!raw.includes(marker)) return null;
  return raw.replace(marker, '/storage/v1/render/image/public/');
}

export function buildSupabaseRenderUrl(url, { width, quality = 90, format, resize = 'cover' } = {}) {
  const base = toSupabaseRenderBase(url);
  if (!base) return String(url || '').trim();
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    resize,
  });
  if (format) params.set('format', format);
  return `${base}?${params.toString()}`;
}

export function buildSupabaseSrcSet(url, widths, { quality = 90, format, resize = 'cover' } = {}) {
  const base = toSupabaseRenderBase(url);
  if (!base || !Array.isArray(widths) || !widths.length) return undefined;
  return widths
    .map((w) => {
      const params = new URLSearchParams({
        width: String(w),
        quality: String(quality),
        resize,
      });
      if (format) params.set('format', format);
      return `${base}?${params.toString()} ${w}w`;
    })
    .join(', ');
}

export function resolveResponsiveImageProps(url, presetKey = 'hero', { useWebp = true } = {}) {
  const raw = String(url || '').trim();
  const preset = IMAGE_PRESETS[presetKey] || IMAGE_PRESETS.hero;
  if (!raw) {
    return { src: '', srcSet: undefined, sizes: undefined, webpSrcSet: undefined };
  }
  if (!toSupabaseRenderBase(raw)) {
    return { src: raw, srcSet: undefined, sizes: undefined, webpSrcSet: undefined };
  }
  const srcSet = buildSupabaseSrcSet(raw, preset.widths, { quality: preset.quality });
  const webpSrcSet = useWebp
    ? buildSupabaseSrcSet(raw, preset.widths, { quality: preset.quality, format: 'webp' })
    : undefined;
  const src = buildSupabaseRenderUrl(raw, {
    width: preset.fallbackWidth,
    quality: preset.quality,
  });
  return { src, srcSet, sizes: preset.sizes, webpSrcSet };
}

export function responsiveBannerBackgroundUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const preset = IMAGE_PRESETS.banner;
  return buildSupabaseRenderUrl(raw, {
    width: preset.fallbackWidth,
    quality: preset.quality,
  }) || raw;
}

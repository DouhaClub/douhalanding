/** Presets de exportação (alta qualidade, arquivo menor — estilo export no source). */

export const SUPABASE_POSTERS_BUCKET = 'douha-posters';
export const SUPABASE_ROLE_PHOTOS_BUCKET = 'douha-role-photos';

/** Pula reprocessamento no batch se já estiver abaixo deste tamanho e dentro do maxWidth. */
export const IMAGE_SKIP_IF_BYTES = 800 * 1024;

export const IMAGE_EXPORT_PRESETS = {
  gallery: { maxWidth: 2560, quality: 0.92, format: 'jpeg' },
  role: { maxWidth: 1400, quality: 0.90, format: 'jpeg' },
  poster: { maxWidth: 1600, quality: 0.90, format: 'jpeg' },
  editorial: { maxWidth: 1920, quality: 0.90, format: 'jpeg' },
  banner: { maxWidth: 1920, quality: 0.90, format: 'jpeg' },
  footerLogo: { maxWidth: 400, quality: 0.92, format: 'png' },
};

export function getBannerPreset(maxWidth) {
  return { maxWidth, quality: 0.90, format: 'jpeg' };
}

export function getFooterLogoPreset(usePng) {
  return usePng
    ? { ...IMAGE_EXPORT_PRESETS.footerLogo, format: 'png' }
    : { maxWidth: IMAGE_EXPORT_PRESETS.footerLogo.maxWidth, quality: 0.92, format: 'jpeg' };
}

/** Resolve preset do batch a partir do bucket + path no storage. */
export function getBatchPresetForStoragePath(bucket, path) {
  const p = String(path || '');
  if (bucket === SUPABASE_ROLE_PHOTOS_BUCKET) return IMAGE_EXPORT_PRESETS.role;
  if (p.startsWith('gallery/')) return IMAGE_EXPORT_PRESETS.gallery;
  if (p.startsWith('events/')) return IMAGE_EXPORT_PRESETS.poster;
  if (p.startsWith('editorial/')) return IMAGE_EXPORT_PRESETS.editorial;
  return IMAGE_EXPORT_PRESETS.gallery;
}

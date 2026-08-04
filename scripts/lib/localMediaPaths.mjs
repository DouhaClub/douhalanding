import { SUPABASE_ROLE_PHOTOS_BUCKET } from '../../src/lib/imagePresets.js';

const KNOWN_PREFIXES = ['events/', 'gallery/', 'editorial/', 'role-photos/', 'media/'];

/** URL pública do site (Vite/Amplify) a partir do bucket + path no storage. */
export function storagePathToPublicUrl(bucket, path) {
  const p = String(path || '').replace(/^\/+/, '');
  if (!p) return '';

  if (bucket === SUPABASE_ROLE_PHOTOS_BUCKET) {
    if (p.startsWith('role-photos/')) return `/${p}`;
    return `/role-photos/${p}`;
  }

  if (KNOWN_PREFIXES.some((prefix) => p.startsWith(prefix))) {
    return `/${p}`;
  }

  return `/media/${p}`;
}

export function normalizeUrlKey(url) {
  return String(url || '').trim().split('?')[0];
}

export function isSupabaseStorageUrl(url) {
  return /supabase\.co\/storage\/v1\/object\/public\//i.test(String(url || ''));
}

export function categoryForStoragePath(path) {
  const p = String(path || '');
  if (p.startsWith('gallery/')) return 'gallery';
  if (p.startsWith('role-photos/')) return 'role';
  if (p.startsWith('events/')) return 'posters';
  if (p.startsWith('editorial/')) return 'editorial';
  return 'other';
}

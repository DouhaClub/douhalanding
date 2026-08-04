import {
  SUPABASE_POSTERS_BUCKET,
  SUPABASE_ROLE_PHOTOS_BUCKET,
} from '../../src/lib/imagePresets.js';

export { SUPABASE_POSTERS_BUCKET, SUPABASE_ROLE_PHOTOS_BUCKET };

export function getStoragePathFromPublicUrl(publicUrl, bucketId) {
  const value = String(publicUrl || '').trim();
  if (!value) return '';
  const marker = `/storage/v1/object/public/${bucketId}/`;
  const idx = value.indexOf(marker);
  if (idx < 0) return '';
  const rawPath = value.slice(idx + marker.length);
  if (!rawPath) return '';
  return rawPath.split('?')[0];
}

export function resolveBucketAndPath(publicUrl) {
  const value = String(publicUrl || '').trim();
  if (!value || value.startsWith('data:')) return null;

  for (const bucket of [SUPABASE_POSTERS_BUCKET, SUPABASE_ROLE_PHOTOS_BUCKET]) {
    const path = getStoragePathFromPublicUrl(value, bucket);
    if (path) return { bucket, path, url: value.split('?')[0] };
  }
  return null;
}

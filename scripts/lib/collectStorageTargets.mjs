import { resolveBucketAndPath } from './storagePaths.mjs';
import {
  extractUrlsFromGalleryEntry,
  extractUrlsFromSiteContentPayload,
} from './photoUrlParse.mjs';

/** Coleta URLs únicas do Supabase Storage referenciadas no banco. */
export async function collectStorageTargets(supabase) {
  const urlSet = new Map();

  const addUrl = (url) => {
    const resolved = resolveBucketAndPath(url);
    if (!resolved) return;
    const key = `${resolved.bucket}/${resolved.path}`;
    if (!urlSet.has(key)) urlSet.set(key, resolved);
  };

  const { data: galleryRows, error: galleryErr } = await supabase
    .from('douha_site_photos')
    .select('photo_url');
  if (galleryErr && !galleryErr.message.includes('does not exist')) {
    throw new Error(`douha_site_photos: ${galleryErr.message}`);
  }
  for (const row of galleryRows || []) {
    for (const url of extractUrlsFromGalleryEntry(row.photo_url)) addUrl(url);
  }

  const { data: roleRows, error: roleErr } = await supabase
    .from('douha_role_photos')
    .select('photo_url');
  if (roleErr && !roleErr.message.includes('does not exist')) {
    throw new Error(`douha_role_photos: ${roleErr.message}`);
  }
  for (const row of roleRows || []) addUrl(row.photo_url);

  const { data: eventRows, error: eventErr } = await supabase
    .from('douha_events')
    .select('poster');
  if (eventErr && !eventErr.message.includes('does not exist')) {
    throw new Error(`douha_events: ${eventErr.message}`);
  }
  for (const row of eventRows || []) {
    if (row.poster) addUrl(row.poster);
  }

  const { data: contentRows, error: contentErr } = await supabase
    .from('douha_site_content')
    .select('payload');
  if (contentErr && !contentErr.message.includes('does not exist')) {
    throw new Error(`douha_site_content: ${contentErr.message}`);
  }
  for (const row of contentRows || []) {
    for (const url of extractUrlsFromSiteContentPayload(row.payload)) addUrl(url);
  }

  const { data: editorialRows, error: editorialErr } = await supabase
    .from('douha_editorial_posts')
    .select('cover_url');
  if (editorialErr && !editorialErr.message.includes('does not exist')) {
    throw new Error(`douha_editorial_posts: ${editorialErr.message}`);
  }
  for (const row of editorialRows || []) {
    if (row.cover_url) addUrl(row.cover_url);
  }

  return Array.from(urlSet.values());
}

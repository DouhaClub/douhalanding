/**
 * YouTube Data API v3 — ultimos videos do canal pela playlist oficial de uploads
 * (playlistItems + channels), mais estavel e barato em quota que search.list.
 */

const YT_API = 'https://www.googleapis.com/youtube/v3';

function parseYouTubeApiError(json) {
  const err = json?.error?.errors?.[0];
  if (err?.reason === 'quotaExceeded') {
    return 'Cota da API YouTube esgotada. Verifique o projeto no Google Cloud ou tente mais tarde.';
  }
  if (err?.reason === 'keyInvalid') {
    return 'Chave da API YouTube invalida (VITE_YOUTUBE_API_KEY).';
  }
  if (err?.reason === 'accessNotConfigured' || err?.reason === 'forbidden') {
    return 'Ative "YouTube Data API v3" no Google Cloud (APIs e servicos → Biblioteca) e confira restricoes da chave (HTTP referrer: localhost).';
  }
  if (json?.error?.message) return String(json.error.message);
  return '';
}

function thumbFromSnippet(snippet) {
  const t = snippet?.thumbnails || {};
  return String(
    t.maxres?.url
      || t.standard?.url
      || t.high?.url
      || t.medium?.url
      || t.default?.url
      || '',
  );
}

/** ISO 8601 duration from videos.list (ex.: PT1H2M3S, PT45S). */
export function parseIso8601DurationToSeconds(iso) {
  const s = String(iso || '').trim();
  if (!s || !s.startsWith('PT')) return 0;
  let sec = 0;
  const h = s.match(/(\d+)H/);
  const m = s.match(/(\d+)M/);
  const x = s.match(/(\d+)S/);
  if (h) sec += parseInt(h[1], 10) * 3600;
  if (m) sec += parseInt(m[1], 10) * 60;
  if (x) sec += parseInt(x[1], 10);
  return sec;
}

/** Playlist de uploads mistura videos e Shorts; Shorts costumam ter ate 60s (configuravel). */
const PLAYLIST_PAGE_SIZE = 50;

async function fetchVideoDurationMap(apiKey, videoIds) {
  const key = apiKey.trim();
  const unique = [...new Set(videoIds)].filter(Boolean);
  const map = new Map();
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const params = new URLSearchParams({
      key,
      part: 'contentDetails',
      id: batch.join(','),
    });
    const res = await fetch(`${YT_API}/videos?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(parseYouTubeApiError(json) || `YouTube videos.list HTTP ${res.status}`);
    }
    for (const item of json.items || []) {
      const id = item?.id;
      const dur = item?.contentDetails?.duration;
      if (id) map.set(id, dur);
    }
  }
  return map;
}

/** ID de canal: UC + 22 caracteres (24 no total). */
export function isLikelyYoutubeChannelId(value) {
  return /^UC[a-zA-Z0-9_-]{22}$/.test(String(value || '').trim());
}

/**
 * Resolve ID UC... a partir de ID ja UC, forHandle, ou busca por nome/handle (fallback).
 */
async function resolveChannelIdToUc(apiKey, channelIdOrHandle) {
  const raw = String(channelIdOrHandle || '').trim();
  if (!raw) throw new Error('Canal YouTube nao configurado (VITE_YOUTUBE_CHANNEL_ID).');
  const key = apiKey.trim();

  if (isLikelyYoutubeChannelId(raw)) return raw;

  const tryChannels = async (searchParams) => {
    const res = await fetch(`${YT_API}/channels?${searchParams.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(parseYouTubeApiError(json) || `YouTube channels.list HTTP ${res.status}`);
    }
    const id = json?.items?.[0]?.id;
    return id || null;
  };

  const p1 = new URLSearchParams({ key, part: 'id' });
  p1.set('forHandle', raw.replace(/^@/, '').toLowerCase());
  let uc = await tryChannels(p1);
  if (uc) return uc;

  if (import.meta.env.DEV) {
    console.info('[Douha] YouTube: forHandle nao retornou canal; tentando search...');
  }

  const pSearch = new URLSearchParams({
    key,
    part: 'snippet',
    type: 'channel',
    maxResults: '5',
    q: raw.replace(/^@/, ''),
  });
  const resS = await fetch(`${YT_API}/search?${pSearch.toString()}`);
  const jsonS = await resS.json();
  if (!resS.ok) {
    throw new Error(parseYouTubeApiError(jsonS) || `YouTube search.list HTTP ${resS.status}`);
  }
  const items = Array.isArray(jsonS?.items) ? jsonS.items : [];
  const channelId = items.find((it) => it?.id?.channelId)?.id?.channelId;
  if (!channelId) {
    throw new Error(
      'Canal nao encontrado. Confira VITE_YOUTUBE_CHANNEL_ID (UC... ou @handle). Se a chave API estiver restrita, libere http://localhost:5180 no Google Cloud.',
    );
  }
  return channelId;
}

/**
 * Playlist "uploads" do canal (ID UC... ou handle / nome buscavel).
 */
export async function fetchUploadsPlaylistId(apiKey, channelIdOrHandle) {
  const uc = await resolveChannelIdToUc(apiKey, channelIdOrHandle);
  const params = new URLSearchParams({
    key: apiKey.trim(),
    part: 'contentDetails',
    id: uc,
  });

  const res = await fetch(`${YT_API}/channels?${params.toString()}`);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(parseYouTubeApiError(json) || `YouTube channels.list HTTP ${res.status}`);
  }

  const uploads = json?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) {
    throw new Error('Canal sem playlist de uploads.');
  }
  return uploads;
}

export async function fetchVideosFromUploadsPlaylist(apiKey, uploadsPlaylistId, maxResults) {
  const cap = Math.min(50, Math.max(1, Number(maxResults) || 12));
  const params = new URLSearchParams({
    key: apiKey.trim(),
    part: 'snippet',
    playlistId: uploadsPlaylistId,
    maxResults: String(cap),
  });

  const res = await fetch(`${YT_API}/playlistItems?${params.toString()}`);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(parseYouTubeApiError(json) || `YouTube playlistItems.list HTTP ${res.status}`);
  }

  const items = Array.isArray(json?.items) ? json.items : [];
  return items
    .map((item) => {
      const videoId = item?.snippet?.resourceId?.videoId;
      const snippet = item?.snippet || {};
      if (!videoId) return null;
      return {
        videoId,
        title: String(snippet.title || 'Video'),
        thumb: thumbFromSnippet(snippet),
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        platform: 'YOUTUBE',
        publishedAt: snippet.publishedAt ? String(snippet.publishedAt) : null,
      };
    })
    .filter(Boolean);
}

/**
 * @param {{ apiKey: string, channelId: string, maxResults?: number }} args
 * channelId: ID UC... ou handle do canal (mesmo valor do .env; @ opcional)
 * Exclui Shorts: duracao <= VITE_YOUTUBE_SHORTS_MAX_SECONDS (padrao 60s).
 */
export async function fetchLatestYouTubeVideos({ apiKey, channelId, maxResults = 12 }) {
  if (!String(apiKey || '').trim()) {
    throw new Error('Chave da API YouTube ausente (VITE_YOUTUBE_API_KEY).');
  }
  const shortsMaxSec = Math.max(
    0,
    Number(String(import.meta.env.VITE_YOUTUBE_SHORTS_MAX_SECONDS ?? '60').trim()) || 60,
  );

  const uploadsId = await fetchUploadsPlaylistId(apiKey, channelId);
  const raw = await fetchVideosFromUploadsPlaylist(apiKey, uploadsId, PLAYLIST_PAGE_SIZE);
  if (!raw.length) return [];

  const durationMap = await fetchVideoDurationMap(
    apiKey,
    raw.map((v) => v.videoId),
  );

  const longForm = raw.filter((v) => {
    const iso = durationMap.get(v.videoId);
    const sec = parseIso8601DurationToSeconds(iso);
    if (!iso) return false;
    return sec > shortsMaxSec;
  });

  const videos = longForm.slice(0, maxResults);

  if (import.meta.env.DEV) {
    const dropped = raw.length - longForm.length;
    console.info(
      `[Douha] YouTube OK: ${videos.length} video(s) longos (excluidos ${dropped} com duracao <= ${shortsMaxSec}s, tipico Short).`,
    );
  }
  return videos;
}

/**
 * Foto de perfil e titulo do canal (header). Mesma chave/API dos videos.
 * @returns {{ avatarUrl: string, title: string } | null}
 */
export async function fetchYoutubeChannelBranding({ apiKey, channelIdOrHandle }) {
  if (!String(apiKey || '').trim()) return null;
  const raw = String(channelIdOrHandle || '').trim();
  if (!raw) return null;
  try {
    const uc = await resolveChannelIdToUc(apiKey, channelIdOrHandle);
    const params = new URLSearchParams({
      key: apiKey.trim(),
      part: 'snippet',
      id: uc,
    });
    const res = await fetch(`${YT_API}/channels?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.warn('[Douha] channels.list (branding):', parseYouTubeApiError(json) || res.status);
      }
      return null;
    }
    const s = json?.items?.[0]?.snippet;
    if (!s) return null;
    const th = s.thumbnails || {};
    const avatarUrl = String(
      th.high?.url || th.medium?.url || th.default?.url || '',
    ).trim();
    const title = String(s.title || '').trim();
    if (!avatarUrl) return null;
    return { avatarUrl, title };
  } catch (err) {
    console.warn('[Douha] fetchYoutubeChannelBranding:', err?.message || err);
    return null;
  }
}

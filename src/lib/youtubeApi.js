/**
 * YouTube Data API v3 — ultimos videos do canal pela playlist oficial de uploads
 * (playlistItems + channels), mais estavel e barato em quota que search.list.
 */

const YT_API = 'https://www.googleapis.com/youtube/v3';

/** Aspas no .env ou espacos; chave nao pode ter prefixo errado. */
export function normalizeYoutubeApiKey(value) {
  let s = String(value ?? '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Aceita UC..., handle, @handle ou URL youtube.com/@x ou /channel/UC...
 * (evita .env “certo” mas colado com aspas ou URL inteira.)
 */
export function normalizeYoutubeChannelEnv(value) {
  let s = normalizeYoutubeApiKey(value);
  if (!s) return '';
  s = s.replace(/^@/, '').trim();
  const channelMatch = s.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/i);
  if (channelMatch) return channelMatch[1];
  const atPath = s.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/i);
  if (atPath) return atPath[1];
  if (/youtube\.com/i.test(s)) {
    try {
      const u = new URL(s.startsWith('http') ? s : `https://${s}`);
      const seg = u.pathname.split('/').filter(Boolean)[0];
      if (seg?.startsWith('@')) return seg.slice(1);
    } catch {
      /* ignore */
    }
  }
  return s;
}

/**
 * A API devolve thumbs pequenas (=s88, =s240). O site do YouTube usa versao maior;
 * trocar o parametro =sNNN na URL do ggpht para =s800 alinha a foto do header a do canal.
 */
function upgradeYoutubeChannelAvatarUrl(url) {
  const u = String(url || '').trim();
  if (!u) return u;
  if (!/ggpht\.com|googleusercontent\.com/i.test(u)) return u;
  /* Ex.: =s88-c-k-c... -> =s800-c-k-c... (mesma arte que o YouTube mostra no perfil). */
  return u.replace(/=s[0-9]+/i, '=s800');
}

function stripHtmlMessage(s) {
  return String(s || '').replace(/<[^>]*>/g, '').trim();
}

function parseYouTubeApiError(json) {
  const err = json?.error?.errors?.[0];
  const plainMsg = stripHtmlMessage(json?.error?.message || '');
  if (err?.reason === 'quotaExceeded' || /quota/i.test(plainMsg)) {
    return 'Cota da API YouTube esgotada. No Google Cloud: APIs e servicos > Painel de cotas, ou aguarde o reset diario (meia-noite Pacifico).';
  }
  if (err?.reason === 'keyInvalid') {
    return 'Chave da API YouTube invalida (VITE_YOUTUBE_API_KEY).';
  }
  if (err?.reason === 'accessNotConfigured' || err?.reason === 'forbidden') {
    return 'Ative "YouTube Data API v3" no Google Cloud (APIs e servicos → Biblioteca) e confira restricoes da chave (HTTP referrer: localhost).';
  }
  if (plainMsg) return plainMsg;
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

/** Se a API nao mandar thumb no snippet, o i.ytimg padrao ainda funciona no front. */
export function defaultYoutubeVideoThumbUrl(videoId) {
  const id = String(videoId || '').trim();
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

/** ISO 8601 duration from videos.list (ex.: PT1H2M3S, PT45S). Aceita maiusculas/minusculas. */
export function parseIso8601DurationToSeconds(iso) {
  const s = String(iso || '').trim().toUpperCase();
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
/** Paginas playlistItems ao procurar videos longos (limite de requests). */
const MAX_UPLOADS_PLAYLIST_PAGES = 2;
/** Cache simples para evitar chamadas repetidas na mesma sessao. */
const YOUTUBE_CACHE_TTL_MS = 10 * 60 * 1000;
const youtubeFeedCache = new Map();
const youtubeFeedInFlight = new Map();
const youtubeUcCache = new Map();
const youtubeUploadsCache = new Map();
const youtubeBrandingCache = new Map();

function getShortsMaxSeconds() {
  return Math.max(
    0,
    Number(String(import.meta.env.VITE_YOUTUBE_SHORTS_MAX_SECONDS ?? '60').trim()) || 60,
  );
}

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
      const id = item?.id != null ? String(item.id).trim() : '';
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

/** Escolhe o canal certo entre varios resultados de search.list (evita pegar o primeiro aleatorio). */
function pickChannelIdFromSearchItems(items, queryRaw) {
  const itemsArr = Array.isArray(items) ? items : [];
  if (!itemsArr.length) return '';
  const q = String(queryRaw || '').replace(/^@/, '').trim().toLowerCase();
  if (!q) return itemsArr.find((it) => it?.id?.channelId)?.id?.channelId || '';

  const byCustom = itemsArr.find((it) => {
    const cu = String(it?.snippet?.customUrl || '')
      .toLowerCase()
      .replace(/^@/, '');
    return cu && (cu === q || cu.endsWith(q));
  });
  if (byCustom?.id?.channelId) return byCustom.id.channelId;

  const byTitle = itemsArr.find((it) => {
    const t = String(it?.snippet?.title || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
    const qFlat = q.replace(/\s+/g, ' ');
    return t === qFlat || t.replace(/\s/g, '') === qFlat.replace(/\s/g, '');
  });
  if (byTitle?.id?.channelId) return byTitle.id.channelId;

  const first = itemsArr.find((it) => it?.id?.channelId)?.id?.channelId || '';
  if (import.meta.env.DEV && first) {
    const title = itemsArr[0]?.snippet?.title;
    console.warn(
      `[Douha] YouTube: search.list usou o 1º resultado (${title || '?'}). Se nao for o canal certo, use VITE_YOUTUBE_CHANNEL_ID=UC... (YouTube → Sobre → ID do canal).`,
    );
  }
  return first;
}

async function logResolvedChannelTitleDev(apiKey, uc, rawQuery) {
  if (!import.meta.env.DEV || !uc) return;
  try {
    const params = new URLSearchParams({ key: apiKey.trim(), part: 'snippet', id: uc });
    const res = await fetch(`${YT_API}/channels?${params.toString()}`);
    const json = await res.json();
    const title = json?.items?.[0]?.snippet?.title;
    if (title) {
      console.info(
        `[Douha] YouTube: "${rawQuery}" → canal "${title}". Confira se e o Douha; senao use so o UC... no .env.`,
      );
    }
  } catch {
    /* ignore */
  }
}

/**
 * Resolve ID UC... a partir de ID ja UC, forHandle, ou busca por nome/handle (fallback).
 */
async function resolveChannelIdToUc(apiKey, channelIdOrHandle) {
  const raw = normalizeYoutubeChannelEnv(channelIdOrHandle);
  if (!raw) throw new Error('Canal YouTube nao configurado (VITE_YOUTUBE_CHANNEL_ID).');
  const key = apiKey.trim();
  const cachedUc = youtubeUcCache.get(raw);
  if (cachedUc && (Date.now() - cachedUc.ts) < YOUTUBE_CACHE_TTL_MS) {
    return cachedUc.uc;
  }

  if (isLikelyYoutubeChannelId(raw)) {
    youtubeUcCache.set(raw, { ts: Date.now(), uc: raw });
    return raw;
  }

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
  p1.set('forHandle', raw.replace(/^@/, ''));
  let uc = await tryChannels(p1);
  if (uc) {
    youtubeUcCache.set(raw, { ts: Date.now(), uc });
    await logResolvedChannelTitleDev(key, uc, raw);
    return uc;
  }

  if (import.meta.env.DEV) {
    console.info('[Douha] YouTube: forHandle nao retornou canal; tentando search...');
  }

  const pSearch = new URLSearchParams({
    key,
    part: 'snippet',
    type: 'channel',
    maxResults: '10',
    q: raw.replace(/^@/, ''),
  });
  const resS = await fetch(`${YT_API}/search?${pSearch.toString()}`);
  const jsonS = await resS.json();
  if (!resS.ok) {
    throw new Error(parseYouTubeApiError(jsonS) || `YouTube search.list HTTP ${resS.status}`);
  }
  const items = Array.isArray(jsonS?.items) ? jsonS.items : [];
  const channelId = pickChannelIdFromSearchItems(items, raw.replace(/^@/, ''));
  if (!channelId) {
    throw new Error(
      'Canal nao encontrado para este handle. No YouTube, abra o canal > Sobre e copie o "ID do canal" (comeca com UC). O @ na URL precisa existir; muitos canais so tem /channel/UC...',
    );
  }
  youtubeUcCache.set(raw, { ts: Date.now(), uc: channelId });
  await logResolvedChannelTitleDev(key, channelId, raw);
  return channelId;
}

/**
 * Playlist "uploads" do canal (ID UC... ou handle / nome buscavel).
 */
export async function fetchUploadsPlaylistId(apiKey, channelIdOrHandle) {
  const uc = await resolveChannelIdToUc(apiKey, channelIdOrHandle);
  const cachedUploads = youtubeUploadsCache.get(uc);
  if (cachedUploads && (Date.now() - cachedUploads.ts) < YOUTUBE_CACHE_TTL_MS) {
    return cachedUploads.uploads;
  }
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
  youtubeUploadsCache.set(uc, { ts: Date.now(), uploads });
  return uploads;
}

function mapPlaylistItemsToVideos(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const videoId = item?.snippet?.resourceId?.videoId;
      const snippet = item?.snippet || {};
      if (!videoId) return null;
      const thumb = thumbFromSnippet(snippet) || defaultYoutubeVideoThumbUrl(videoId);
      return {
        videoId,
        title: String(snippet.title || 'Video'),
        thumb,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        platform: 'YOUTUBE',
        publishedAt: snippet.publishedAt ? String(snippet.publishedAt) : null,
      };
    })
    .filter(Boolean);
}

/**
 * Uma pagina da playlist de uploads (playlistItems.list).
 * @returns {{ videos: Array, nextPageToken: string }}
 */
async function fetchUploadsPlaylistPage(apiKey, uploadsPlaylistId, maxResults, pageToken) {
  const cap = Math.min(50, Math.max(1, Number(maxResults) || 12));
  const params = new URLSearchParams({
    key: apiKey.trim(),
    part: 'snippet',
    playlistId: uploadsPlaylistId,
    maxResults: String(cap),
  });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${YT_API}/playlistItems?${params.toString()}`);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(parseYouTubeApiError(json) || `YouTube playlistItems.list HTTP ${res.status}`);
  }

  const items = Array.isArray(json?.items) ? json.items : [];
  const nextPageToken = typeof json?.nextPageToken === 'string' ? json.nextPageToken : '';
  return { videos: mapPlaylistItemsToVideos(items), nextPageToken };
}

export async function fetchVideosFromUploadsPlaylist(apiKey, uploadsPlaylistId, maxResults) {
  const { videos } = await fetchUploadsPlaylistPage(apiKey, uploadsPlaylistId, maxResults, undefined);
  return videos;
}

/**
 * @param {{ apiKey: string, channelId: string, maxResults?: number }} args
 * Lista vem da playlist oficial de uploads (playlistItems) — nao depende de videos.list para montar a lista.
 * Assim, cota esgotada em videos.list nao deixa so 1 video.
 * Shorts: opcionalmente filtrados se videos.list responder (ver comentario abaixo).
 */
export async function fetchLatestYouTubeVideos({ apiKey, channelId, maxResults = 12 }) {
  if (!String(apiKey || '').trim()) {
    throw new Error('Chave da API YouTube ausente (VITE_YOUTUBE_API_KEY).');
  }
  const shortsMaxSec = getShortsMaxSeconds();
  const need = Math.min(50, Math.max(1, Number(maxResults) || 12));

  const uploadsId = await fetchUploadsPlaylistId(apiKey, channelId);

  const fromPlaylist = [];
  let pageToken;
  let pages = 0;

  while (pages < MAX_UPLOADS_PLAYLIST_PAGES) {
    const { videos: raw, nextPageToken } = await fetchUploadsPlaylistPage(
      apiKey,
      uploadsId,
      PLAYLIST_PAGE_SIZE,
      pageToken,
    );
    pages += 1;
    if (!raw.length) break;
    for (const v of raw) {
      fromPlaylist.push(v);
    }
    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  let videos = fromPlaylist.slice(0, PLAYLIST_PAGE_SIZE * MAX_UPLOADS_PLAYLIST_PAGES);
  if (videos.length === 0) return [];

  /* Modo estrito: sem duracao valida, nao entra (evita Shorts). */
  const durationMap = await fetchVideoDurationMap(
    apiKey,
    videos.map((v) => String(v.videoId || '').trim()),
  );
  videos = videos.filter((v) => {
    const vid = String(v.videoId || '').trim();
    const iso = durationMap.get(vid);
    if (!iso) return false;
    return parseIso8601DurationToSeconds(iso) > shortsMaxSec;
  }).slice(0, need);

  if (import.meta.env.DEV) {
    console.info(`[Douha] YouTube: ${videos.length} video(s) para o feed (base: playlist de uploads).`);
  }
  return videos;
}

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractEntryAlternateLink(block) {
  const relFirst = block.match(/<link[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i)?.[1];
  if (relFirst) return relFirst;
  return (
    block.match(/<link[^>]*\bhref=["'](https?:\/\/www\.youtube\.com\/[^"']+)["'][^>]*\brel=["']alternate["']/i)?.[1]
    || ''
  );
}

/**
 * Feed RSS: ignora entradas com link /shorts/; demais passam (fallback quando a Data API falha).
 */
function parseYoutubeRssFeedXml(xml, maxResults) {
  const out = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let em;
  while ((em = entryRe.exec(xml))) {
    if (out.length >= maxResults) break;
    const block = em[1];
    const altLink = extractEntryAlternateLink(block);
    if (altLink && /\/shorts\//i.test(altLink)) continue;

    const vidId =
      block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      || altLink.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1];
    if (!vidId) continue;

    const titleMatch = block.match(/<title>([^<]*)<\/title>/);
    const title = titleMatch ? decodeXmlEntities(titleMatch[1].trim()) : 'Video';
    out.push({
      videoId: vidId,
      title: title || 'Video',
      thumb: defaultYoutubeVideoThumbUrl(vidId),
      videoUrl: `https://www.youtube.com/watch?v=${vidId}`,
      platform: 'YOUTUBE',
      publishedAt: null,
    });
  }
  return out;
}

/** Titulo do canal no Atom feed (antes do primeiro &lt;entry&gt;). */
function parseChannelTitleFromYoutubeFeedXml(xml) {
  const s = String(xml || '');
  const head = s.split(/<entry[\s>]/i)[0] || s;
  const m = head.match(/<title(?:\s[^>]*)?>([^<]*)<\/title>/i);
  return m ? decodeXmlEntities(m[1].trim()) : '';
}

async function fetchYoutubeFeedXmlViaProxy(channelIdUc) {
  const url = `/yt-rss-proxy/feeds/videos.xml?channel_id=${encodeURIComponent(channelIdUc)}`;
  const res = await fetch(url);
  if (!res.ok) return '';
  return res.text();
}

async function fetchVideosFromChannelRssProxy(channelIdUc, maxResults) {
  const xml = await fetchYoutubeFeedXmlViaProxy(channelIdUc);
  if (!xml) return [];
  return parseYoutubeRssFeedXml(xml, maxResults);
}

/**
 * Nome do canal pelo feed RSS (sem Data API). So funciona com ID UC... + proxy (/yt-rss-proxy no Vite).
 */
export async function fetchYoutubeChannelTitleFromRssProxy(channelIdUc) {
  const uc = String(channelIdUc || '').trim();
  if (!isLikelyYoutubeChannelId(uc)) return '';
  const xml = await fetchYoutubeFeedXmlViaProxy(uc);
  return parseChannelTitleFromYoutubeFeedXml(xml);
}

/**
 * Foto do canal quando a Data API nao responde (cota etc.): servico publico por ID UC.
 * So use com canal ja conhecido (mesmo UC do .env).
 */
export function youtubeChannelAvatarFallbackUrl(channelIdUc) {
  const id = String(channelIdUc || '').trim();
  if (!isLikelyYoutubeChannelId(id)) return '';
  return `https://unavatar.io/youtube/${id}`;
}

/** URL publica do canal: UC... -> /channel/UC..., handle -> /@handle */
export function resolveYoutubeChannelWebUrl(channelIdOrHandle) {
  const raw = normalizeYoutubeChannelEnv(channelIdOrHandle);
  if (!raw) return '';
  if (isLikelyYoutubeChannelId(raw)) return `https://www.youtube.com/channel/${raw}`;
  const h = raw.replace(/^@/, '');
  return h ? `https://www.youtube.com/@${h}` : '';
}

function mergeVideoListsDedupe(primary, secondary, maxResults) {
  const cap = Math.min(50, Math.max(1, Number(maxResults) || 12));
  const seen = new Set();
  const out = [];
  const pushList = (arr) => {
    for (const v of arr || []) {
      const id = String(v?.videoId || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(v);
      if (out.length >= cap) return;
    }
  };
  pushList(primary);
  if (out.length < cap) pushList(secondary);
  return out.slice(0, cap);
}

/**
 * Data API primeiro; se falhar (ex.: cota) e o canal for ID UC..., tenta feed RSS pelo proxy do Vite (dev/preview).
 * Em producao estatica sem proxy, continua dependendo da API.
 */
export async function fetchLatestYouTubeVideosResilient({ apiKey, channelId, maxResults = 12 }) {
  const cacheKey = `${normalizeYoutubeChannelEnv(channelId)}::${Math.min(50, Math.max(1, Number(maxResults) || 12))}`;
  const cached = youtubeFeedCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < YOUTUBE_CACHE_TTL_MS) {
    return cached.videos;
  }
  const inFlight = youtubeFeedInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const run = (async () => {
  const normalized = normalizeYoutubeChannelEnv(channelId);
  const uc = isLikelyYoutubeChannelId(normalized) ? normalized : '';

  const tryRss = async (n) => {
    if (!uc) return [];
    const list = await fetchVideosFromChannelRssProxy(uc, n);
    if (list.length && import.meta.env.DEV) {
      console.info(`[Douha] YouTube: ${list.length} video(s) via RSS (fallback).`);
    }
    return list;
  };

  if (!String(apiKey || '').trim()) {
    const rss = await tryRss(maxResults);
    if (rss.length) return rss;
    throw new Error(
      'Sem VITE_YOUTUBE_API_KEY: use o ID do canal no formato UC... em VITE_YOUTUBE_CHANNEL_ID para carregar pelo RSS (dev), ou adicione a chave da API.',
    );
  }

  try {
    const api = await fetchLatestYouTubeVideos({ apiKey, channelId, maxResults });
    const cap = Math.min(50, Math.max(1, Number(maxResults) || 12));
    return api.slice(0, cap);
  } catch (err) {
    const rss = await tryRss(maxResults);
    if (rss.length) return rss;
    throw err;
  }
  })();
  youtubeFeedInFlight.set(cacheKey, run);
  try {
    const videos = await run;
    youtubeFeedCache.set(cacheKey, { ts: Date.now(), videos });
    return videos;
  } finally {
    youtubeFeedInFlight.delete(cacheKey);
  }
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
    const cachedBranding = youtubeBrandingCache.get(uc);
    if (cachedBranding && (Date.now() - cachedBranding.ts) < YOUTUBE_CACHE_TTL_MS) {
      return cachedBranding.data;
    }
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
    const rawAvatar = String(
      th.high?.url || th.medium?.url || th.default?.url || '',
    ).trim();
    const avatarUrl = upgradeYoutubeChannelAvatarUrl(rawAvatar);
    const title = String(s.title || '').trim();
    const data = { avatarUrl: avatarUrl || '', title };
    youtubeBrandingCache.set(uc, { ts: Date.now(), data });
    return data;
  } catch (err) {
    console.warn('[Douha] fetchYoutubeChannelBranding:', err?.message || err);
    return null;
  }
}

/**
 * Avatar + titulo via Data API quando houver chave; senao titulo (e opcionalmente avatar vazio) via RSS com UC...
 */
export async function fetchYoutubeChannelBrandingResilient({ apiKey, channelIdOrHandle }) {
  const normalized = normalizeYoutubeChannelEnv(channelIdOrHandle);
  if (!normalized) return null;

  let fromApi = null;
  if (String(apiKey || '').trim()) {
    fromApi = await fetchYoutubeChannelBranding({ apiKey, channelIdOrHandle });
  }

  const uc = isLikelyYoutubeChannelId(normalized) ? normalized : '';
  let rssTitle = '';
  if (uc) {
    try {
      rssTitle = await fetchYoutubeChannelTitleFromRssProxy(uc);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[Douha] RSS (titulo canal):', e?.message || e);
      }
    }
  }

  const title = (fromApi?.title && fromApi.title.trim()) || rssTitle || '';
  const fromApiAvatar = (fromApi?.avatarUrl && fromApi.avatarUrl.trim()) || '';
  const avatarUrl = fromApiAvatar || (uc ? youtubeChannelAvatarFallbackUrl(uc) : '');

  if (!title && !avatarUrl) return null;
  return { avatarUrl, title: title || 'Canal YouTube' };
}

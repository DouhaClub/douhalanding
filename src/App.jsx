import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, NavLink, Routes, Route, Link } from 'react-router-dom';
import { isSupabaseConfigured, supabase, supabaseConfigError } from './lib/supabaseClient';
import { fetchLatestYouTubeVideos } from './lib/youtubeApi';

const CALENDAR_FOCUS_KEY = 'douha_calendar_focus_v1';
const PHOTOS_STORAGE_KEY = 'douha_site_photos_v1';
const ROLE_PHOTOS_STORAGE_KEY = 'douha_role_photos_v1';
const SITE_CONTENT_STORAGE_KEY = 'douha_site_content_v1';
const ADMIN_AUTH_KEY = 'douha_admin_auth_v1';
const ADMIN_USERNAME = 'adm';
const ADMIN_PASSWORD = 'senhadouha';

const defaultAgenda = [
  {
    id: 'night-1',
    date: '02.05.26',
    time: 'A CONFIRMAR',
    lineup: 'SYON TRIO',
    poster: '/events/syon-trio-by-douha.png',
    ticketUrl: 'https://www.ingressonacional.com.br/evento/33724/syon-trio-by-douha',
    photosUrl: '',
  },
  {
    id: 'night-2',
    date: '04th JULY',
    time: 'FROM 18:00',
    lineup: 'ARTIST G, ARTIST H, ARTIST I, ARTIST J, ARTIST K, ARTIST L',
    poster: '/brand/elements/02.png',
    ticketUrl: 'https://www.sympla.com.br',
    photosUrl: '',
  },
  {
    id: 'night-3',
    date: '11th JULY',
    time: 'FROM 18:00',
    lineup: 'RESIDENT A, RESIDENT B, GUEST M, GUEST N, GUEST O',
    poster: '/brand/elements/03.png',
    ticketUrl: 'https://www.sympla.com.br',
    photosUrl: '',
  },
];

const cities = [
  { city: 'SAO PAULO', date: 'JUL 2026' },
  { city: 'RIO', date: 'AUG 2026' },
  { city: 'LISBON', date: 'OCT 2026' },
  { city: 'MADRID', date: 'NOV 2026' },
  { city: 'PARIS', date: 'JAN 2027' },
  { city: 'BERLIN', date: 'FEB 2027' },
];

const editorial = [
  {
    source: 'BOLETIM DOUHA',
    issue: 'ED. 01',
    date: 'ABR 2026',
    title: 'Abertura oficial da temporada e nova fase editorial do clube',
    deck: 'Resumo semanal com agenda, bastidores e curadoria para quem acompanha o movimento desde o inicio.',
  },
  {
    source: 'REPORTAGEM',
    issue: 'ED. 02',
    date: 'ABR 2026',
    title: 'Como a pista conversa com moda, arte e comportamento noturno',
    deck: 'Leitura de cena com foco em artistas residentes, convidados e referencias que moldam a experiencia Douha.',
  },
  {
    source: 'NEWSLETTER',
    issue: 'ED. 03',
    date: 'MAI 2026',
    title: 'Guia de proximas datas, links oficiais e cobertura pos-evento',
    deck: 'O que abre, o que muda e onde acessar ingressos, fotos e conteudo completo em um unico lugar.',
  },
  {
    source: 'CULTURA',
    issue: 'ED. 04',
    date: 'MAI 2026',
    title: 'Rockstar, label culture e o novo ciclo criativo das pistas',
    deck: 'Panorama rapido sobre referencias globais que influenciam a narrativa visual e sonora do clube.',
  },
];
const defaultEditorialPosts = editorial.map((item, idx) => ({
  id: `editorial-${idx + 1}`,
  source: String(item.source || 'DOUHA CLUB'),
  issue: String(item.issue || ''),
  date: String(item.date || ''),
  title: String(item.title || ''),
  deck: String(item.deck || ''),
  body: '',
  category: '',
  coverUrl: '',
  publishedAt: null,
  isPublished: true,
  position: idx,
}));

const youtubeChannelUrl = 'https://www.youtube.com/@douhaclub';
const YOUTUBE_API_KEY = String(import.meta.env.VITE_YOUTUBE_API_KEY || '').trim();
const YOUTUBE_CHANNEL_ID = String(import.meta.env.VITE_YOUTUBE_CHANNEL_ID || '').trim();
const YOUTUBE_FEED_CARDS = 4;
const YOUTUBE_TOPICS_ROWS = 6;
/** Quantidade pedida na API (grade + lista de titulos); max. 50 por requisicao. */
const YOUTUBE_FETCH_COUNT = 12;

const tracks = [
  {
    videoId: 'dQw4w9WgXcQ',
    title: 'DOUHA CLUB LIVE 001',
    thumb: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    platform: 'YOUTUBE',
  },
  {
    videoId: '3JZ_D3ELwOQ',
    title: 'DOUHA RADIO 002',
    thumb: 'https://i.ytimg.com/vi/3JZ_D3ELwOQ/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
    platform: 'YOUTUBE',
  },
  {
    videoId: 'oRdxUFDoQe0',
    title: 'GUEST MIX 003',
    thumb: 'https://i.ytimg.com/vi/oRdxUFDoQe0/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=oRdxUFDoQe0',
    platform: 'YOUTUBE',
  },
  {
    videoId: '2Vv-BfVoq4g',
    title: 'LIVE FROM SAO PAULO',
    thumb: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=2Vv-BfVoq4g',
    platform: 'YOUTUBE',
  },
  {
    videoId: 'JGwWNGJdvx8',
    title: 'DOUHA CLUB LIVE 005',
    thumb: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
    platform: 'YOUTUBE',
  },
  {
    videoId: 'fLexgOxsZu0',
    title: 'DOUHA RADIO 006',
    thumb: 'https://i.ytimg.com/vi/fLexgOxsZu0/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=fLexgOxsZu0',
    platform: 'YOUTUBE',
  },
];

const gallery = ['/brand/elements/01.png', '/brand/elements/02.png', '/brand/elements/03.png', '/brand/elements/05.png'];
const MONTH_LABELS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const MAX_EVENTS_PER_MONTH = 4;
/** 48h apos o fim do dia do evento: ai o card troca ingresso -> link do Drive (fotos). */
const EVENT_PHOTOS_LINK_DELAY_MS = 2 * 24 * 60 * 60 * 1000;
const DEFAULT_TIME_OPTIONS = [
  'A CONFIRMAR',
  'A PARTIR DAS 20H',
  'A PARTIR DAS 21H',
  'A PARTIR DAS 22H',
  'A PARTIR DAS 23H',
  'FROM 18:00',
  'FROM 20:00',
  'FROM 22:00',
];
const SUPABASE_EVENTS_TABLE = 'douha_events';
const SUPABASE_POSTERS_BUCKET = 'douha-posters';
const SUPABASE_GALLERY_TABLE = 'douha_site_photos';
const SUPABASE_GALLERY_BUCKET = SUPABASE_POSTERS_BUCKET;
const SUPABASE_EDITORIAL_TABLE = 'douha_editorial_posts';
const SUPABASE_ROLE_PHOTOS_TABLE = 'douha_role_photos';
const SUPABASE_ROLE_PHOTOS_BUCKET = 'douha-role-photos';
const DOUBLE_PHOTO_PREFIX = 'double::';
/** Uma imagem so, largura de 2 cards no carrossel (marcado no upload no admin) */
const WIDE_PHOTO_PREFIX = 'wide::';
const POSTER_MAX_BYTES = 2 * 1024 * 1024;
const POSTER_MAX_LABEL = '2 MB';

const defaultSiteContent = {
  whoWeAreText:
    'O Douha Club, inspirado no estilo e atmosfera vistos no perfil do Instagram, mistura curadoria musical, visual tropical noir e narrativa editorial para criar experiencias de pista e conteudo.',
  whoWeAreInstagram: 'https://www.instagram.com/douha.club/',
  contactEmail: 'booking@douhaclub.com',
  contactWhatsApp: 'https://wa.me/5500000000000',
  communityNewsletterLabel: 'Newsletter',
  communityNewsletterUrl: 'https://douha.club/newsletter',
  communityWhatsAppLabel: 'Comunidade do WhatsApp',
  communityWhatsAppUrl: 'https://wa.me/5500000000000',
  communityInstagramLabel: 'Comunidade do Insta',
  communityInstagramUrl: 'https://www.instagram.com/douha.club/',
  socialInstagramHandle: '@douha.club',
  socialInstagramUrl: 'https://www.instagram.com/douha.club/',
  socialTikTokHandle: '@douha.club',
  socialTikTokUrl: 'https://www.tiktok.com/',
  socialSoundCloudHandle: '@douhaclub',
  socialSoundCloudUrl: 'https://soundcloud.com/',
  socialYouTubeHandle: '@douhaclub',
  socialYouTubeUrl: 'https://youtube.com/',
  /** URL da faixa visual acima de "Conheca a experiencia Douha" na Home (vazio = fundo padrao) */
  experienceHeroImageUrl: '',
};

const faq = [
  { q: 'Como compro ingresso?', a: 'Use a pagina Ingressos. Cada card redireciona para a plataforma oficial.' },
  { q: 'A agenda e a bilheteria sao a mesma coisa?', a: 'Nao. Agenda mostra datas e lineups; bilheteria e separada.' },
  { q: 'Como falar com o comercial?', a: 'Na pagina Contato voce encontra email business e WhatsApp comercial.' },
];

/** Referencia de tamanho para exportar arquivos (alinha com o layout do site) */
const IMAGE_SPEC = {
  heroStrip:
    'Faixa alta na página: cada foto preenche um card (pode cortar um pouco nas bordas). No admin, marque "foto larga" ao enviar para uma imagem ocupar 2 cards lado a lado. Use arquivos grandes (ex.: 2400 px de largura). Proporção 3:4 ou 2:3 funciona bem.',
  agendaPoster: `Tamanho sugerido para poster na agenda: 1080×1620 px (proporcao 2:3, retrato). Tamanho maximo recomendado: ${POSTER_MAX_LABEL}.`,
  gallery:
    'Tamanho sugerido para galeria: largura minima 1200 px; proporcao livre (imagem inteira). Foto larga: panoramas ou banners largos ocupam 2 colunas no carrossel.',
};

function normalizeAgendaItem(item, idx = 0) {
  return {
    id: String(item?.id || `event-${idx + 1}`),
    date: String(item?.date || ''),
    time: String(item?.time || ''),
    lineup: String(item?.lineup || ''),
    poster: String(item?.poster || ''),
    ticketUrl: String(item?.ticketUrl || ''),
    photosUrl: String(item?.photosUrl || ''),
  };
}

function mapDbEventToAgendaItem(row, idx = 0) {
  return normalizeAgendaItem(
    {
      id: row?.id,
      date: row?.date,
      time: row?.time,
      lineup: row?.lineup,
      poster: row?.poster,
      ticketUrl: row?.ticket_url,
      photosUrl: row?.photos_url,
    },
    idx,
  );
}

function mapAgendaItemToDbEvent(item) {
  return {
    id: String(item.id),
    date: String(item.date || ''),
    time: String(item.time || ''),
    lineup: String(item.lineup || ''),
    poster: String(item.poster || ''),
    ticket_url: String(item.ticketUrl || ''),
    photos_url: String(item.photosUrl || ''),
  };
}

function isMissingPhotosUrlColumnError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('photos_url') && text.includes('does not exist');
}

function formatSupabaseAgendaSaveError(error) {
  const detail = String(error?.message || 'erro desconhecido');
  let msg = `Nao foi possivel salvar no Supabase: ${detail}`;
  if (/photos_url/i.test(detail)) {
    msg += ' Rode no SQL Editor o arquivo supabase/migrations/001_douha_events_photos_url.sql (adiciona a coluna no banco que ja existia).';
  }
  return msg;
}

function loadStoredPhotos() {
  try {
    const raw = localStorage.getItem(PHOTOS_STORAGE_KEY);
    if (!raw) return gallery;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return gallery;
    const clean = parsed.filter((item) => typeof item === 'string' && item.trim());
    return clean.length ? clean : gallery;
  } catch {
    return gallery;
  }
}

function loadStoredRolePhotos() {
  try {
    const raw = localStorage.getItem(ROLE_PHOTOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parsePhotoEntry(entry) {
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
  if (p && s) {
    return { mode: 'double', primary: p, secondary: s };
  }
  if (p) {
    return { mode: 'wide', primary: p, secondary: '' };
  }
  return { mode: 'single', primary: raw, secondary: '' };
}

function buildDoublePhotoEntry(primary, secondary) {
  return `${DOUBLE_PHOTO_PREFIX}${String(primary || '').trim()}||${String(secondary || '').trim()}`;
}

function buildWidePhotoEntry(url) {
  return `${WIDE_PHOTO_PREFIX}${String(url || '').trim()}`;
}

function isMissingGalleryTableError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes("could not find the table 'public.douha_site_photos'")
    || text.includes('douha_site_photos')
    || text.includes('schema cache');
}

function isMissingEditorialTableError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes("could not find the table 'public.douha_editorial_posts'")
    || text.includes('douha_editorial_posts')
    || text.includes('schema cache');
}

function isMissingRolePhotosTableError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes("could not find the table 'public.douha_role_photos'")
    || text.includes('douha_role_photos')
    || text.includes('schema cache');
}

function normalizeEditorialItem(item, idx = 0) {
  return {
    id: String(item?.id || `editorial-${idx + 1}`),
    title: String(item?.title || ''),
    deck: String(item?.deck || ''),
    body: String(item?.body || ''),
    source: String(item?.source || 'DOUHA CLUB'),
    issue: String(item?.issue || ''),
    category: String(item?.category || ''),
    coverUrl: String(item?.coverUrl || ''),
    date: String(item?.date || item?.publishedAt || ''),
    publishedAt: item?.publishedAt || null,
    isPublished: item?.isPublished !== false,
    position: Number.isFinite(Number(item?.position)) ? Number(item.position) : idx,
  };
}

function mapDbEditorialPostToItem(row, idx = 0) {
  const publishedAtRaw = row?.published_at ? String(row.published_at) : '';
  return normalizeEditorialItem(
    {
      id: row?.id,
      title: row?.title,
      deck: row?.deck,
      body: row?.body,
      source: row?.source,
      issue: row?.issue,
      category: row?.category,
      coverUrl: row?.cover_url,
      publishedAt: publishedAtRaw || null,
      date: publishedAtRaw ? publishedAtRaw.slice(0, 10) : '',
      isPublished: row?.is_published,
      position: row?.position,
    },
    idx,
  );
}

function mapEditorialItemToDbPost(item) {
  const publishRaw = String(item?.publishedAt || item?.date || '').trim();
  return {
    id: String(item.id),
    title: String(item.title || ''),
    deck: String(item.deck || ''),
    body: String(item.body || ''),
    source: String(item.source || 'DOUHA CLUB'),
    issue: String(item.issue || ''),
    category: String(item.category || ''),
    cover_url: String(item.coverUrl || ''),
    published_at: publishRaw ? publishRaw : null,
    is_published: item.isPublished !== false,
    position: Number.isFinite(Number(item.position)) ? Number(item.position) : 0,
  };
}

/** Garante todos os campos (ex.: experienceHero) mesmo se o estado vier incompleto. */
function mergeSiteContentWithDefaults(partial) {
  const base = { ...defaultSiteContent };
  if (!partial || typeof partial !== 'object') return base;
  const out = { ...base, ...partial };
  for (const key of Object.keys(base)) {
    if (out[key] === undefined) out[key] = base[key];
  }
  return out;
}

function loadStoredSiteContent() {
  try {
    const raw = localStorage.getItem(SITE_CONTENT_STORAGE_KEY);
    if (!raw) return { ...defaultSiteContent };
    const parsed = JSON.parse(raw);
    return {
      whoWeAreText: String(parsed?.whoWeAreText || defaultSiteContent.whoWeAreText),
      whoWeAreInstagram: String(parsed?.whoWeAreInstagram || defaultSiteContent.whoWeAreInstagram),
      contactEmail: String(parsed?.contactEmail || defaultSiteContent.contactEmail),
      contactWhatsApp: String(parsed?.contactWhatsApp || defaultSiteContent.contactWhatsApp),
      communityNewsletterLabel: String(parsed?.communityNewsletterLabel || defaultSiteContent.communityNewsletterLabel),
      communityNewsletterUrl: String(parsed?.communityNewsletterUrl || defaultSiteContent.communityNewsletterUrl),
      communityWhatsAppLabel: String(parsed?.communityWhatsAppLabel || defaultSiteContent.communityWhatsAppLabel),
      communityWhatsAppUrl: String(parsed?.communityWhatsAppUrl || defaultSiteContent.communityWhatsAppUrl),
      communityInstagramLabel: String(parsed?.communityInstagramLabel || defaultSiteContent.communityInstagramLabel),
      communityInstagramUrl: String(parsed?.communityInstagramUrl || defaultSiteContent.communityInstagramUrl),
      socialInstagramHandle: String(parsed?.socialInstagramHandle || defaultSiteContent.socialInstagramHandle),
      socialInstagramUrl: String(parsed?.socialInstagramUrl || defaultSiteContent.socialInstagramUrl),
      socialTikTokHandle: String(parsed?.socialTikTokHandle || defaultSiteContent.socialTikTokHandle),
      socialTikTokUrl: String(parsed?.socialTikTokUrl || defaultSiteContent.socialTikTokUrl),
      socialSoundCloudHandle: String(parsed?.socialSoundCloudHandle || defaultSiteContent.socialSoundCloudHandle),
      socialSoundCloudUrl: String(parsed?.socialSoundCloudUrl || defaultSiteContent.socialSoundCloudUrl),
      socialYouTubeHandle: String(parsed?.socialYouTubeHandle || defaultSiteContent.socialYouTubeHandle),
      socialYouTubeUrl: String(parsed?.socialYouTubeUrl || defaultSiteContent.socialYouTubeUrl),
      experienceHeroImageUrl: String(
        parsed?.experienceHeroImageUrl ?? defaultSiteContent.experienceHeroImageUrl,
      ),
    };
  } catch {
    return { ...defaultSiteContent };
  }
}

function parseAgendaDateParts(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
      return {
        year: y,
        monthIndex: Math.max(0, Math.min(11, mo - 1)),
        day: Math.max(1, Math.min(31, d)),
      };
    }
  }

  const upper = raw.toUpperCase();
  let monthIndex = -1;
  for (let i = 0; i < MONTH_LABELS.length; i += 1) {
    if (upper.includes(MONTH_LABELS[i])) {
      monthIndex = i;
      break;
    }
  }

  if (monthIndex < 0) {
    const numeric = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
    if (numeric) {
      monthIndex = Math.max(0, Math.min(11, Number(numeric[2]) - 1));
      const yy = Number(numeric[3] || new Date().getFullYear());
      const year = yy < 100 ? 2000 + yy : yy;
      const day = Math.max(1, Math.min(31, Number(numeric[1])));
      return { monthIndex, year, day };
    }
  }

  if (monthIndex < 0) {
    const ptMonths = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    for (let i = 0; i < ptMonths.length; i += 1) {
      if (upper.includes(ptMonths[i])) {
        monthIndex = i;
        break;
      }
    }
  }

  const yearHit = upper.match(/\b(20\d{2})\b/);
  if (monthIndex >= 0) {
    const dayHit = upper.match(/\b([0-2]?\d|3[01])\b/);
    return {
      monthIndex,
      year: yearHit ? Number(yearHit[1]) : new Date().getFullYear(),
      day: dayHit ? Number(dayHit[1]) : 1,
    };
  }

  return null;
}

function getRollingCalendarYears(now = new Date()) {
  const currentYear = now.getFullYear();
  return [currentYear - 1, currentYear];
}

/** Anos no calendario/admin: janela fixa + qualquer ano que ja exista nos eventos (evita sumir mes com dados). */
function getCalendarYearOptions(agendaEvents, now = new Date()) {
  const years = new Set(getRollingCalendarYears(now));
  (agendaEvents || []).forEach((item) => {
    const parsed = parseAgendaDateParts(item?.date);
    if (parsed && Number.isFinite(parsed.year)) years.add(parsed.year);
  });
  return Array.from(years).sort((a, b) => a - b);
}

function formatAgendaDate(day, monthIndex, year) {
  const d = String(day).padStart(2, '0');
  const m = String(monthIndex + 1).padStart(2, '0');
  const y = String(year).slice(-2);
  return `${d}.${m}.${y}`;
}

function getEventEndOfDay(value) {
  const parsed = parseAgendaDateParts(value);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.monthIndex, parsed.day || 1, 23, 59, 59, 999);
}

/** True quando ja passou o "carencia" pos-evento: ai o site prioriza o link do Drive. */
function shouldUseEventPhotosLink(eventDateValue, now = new Date()) {
  const end = getEventEndOfDay(eventDateValue);
  if (!end) return false;
  const unlockAt = end.getTime() + EVENT_PHOTOS_LINK_DELAY_MS;
  return now.getTime() >= unlockAt;
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Falha ao salvar ${key} no localStorage:`, error);
    return false;
  }
}

function safeRemoveLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Falha ao remover ${key} do localStorage:`, error);
    return false;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

function compressDataUrlImage(dataUrl, { maxWidth = 1280, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Falha ao preparar compressao da imagem.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Falha ao processar a imagem.'));
    img.src = String(dataUrl);
  });
}

function estimateDataUrlBytes(dataUrl) {
  const value = String(dataUrl || '');
  const marker = 'base64,';
  const idx = value.indexOf(marker);
  if (idx < 0) return value.length;
  const base64 = value.slice(idx + marker.length);
  return Math.floor((base64.length * 3) / 4);
}

function sanitizeFileName(name) {
  return String(name || 'poster')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

async function uploadPosterToSupabaseStorage(file) {
  if (!supabase) throw new Error('Supabase indisponivel para upload.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = sanitizeFileName(file.name || `poster.${safeExt}`);
  const path = `events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { error: uploadError } = await supabase
    .storage
    .from(SUPABASE_POSTERS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || `image/${safeExt}` });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(SUPABASE_POSTERS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Falha ao gerar URL publica do poster.');
  return data.publicUrl;
}

async function uploadGalleryImageToSupabaseStorage(file) {
  if (!supabase) throw new Error('Supabase indisponivel para upload da galeria.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = sanitizeFileName(file.name || `gallery.${safeExt}`);
  const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { error: uploadError } = await supabase
    .storage
    .from(SUPABASE_GALLERY_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || `image/${safeExt}` });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(SUPABASE_GALLERY_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Falha ao gerar URL publica da galeria.');
  return data.publicUrl;
}

async function uploadRolePhotoToSupabaseStorage(file) {
  if (!supabase) throw new Error('Supabase indisponivel para upload das fotos do role.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = sanitizeFileName(file.name || `role.${safeExt}`);
  const path = `role-photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { error: uploadError } = await supabase
    .storage
    .from(SUPABASE_ROLE_PHOTOS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || `image/${safeExt}` });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(SUPABASE_ROLE_PHOTOS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Falha ao gerar URL publica da foto do role.');
  return data.publicUrl;
}

function getStoragePathFromPublicUrl(publicUrl, bucketId) {
  const value = String(publicUrl || '').trim();
  if (!value) return '';
  const marker = `/storage/v1/object/public/${bucketId}/`;
  const idx = value.indexOf(marker);
  if (idx < 0) return '';
  const rawPath = value.slice(idx + marker.length);
  if (!rawPath) return '';
  return rawPath.split('?')[0];
}

async function removeRolePhotoFromStorage(publicUrl) {
  if (!supabase) return;
  const path = getStoragePathFromPublicUrl(publicUrl, SUPABASE_ROLE_PHOTOS_BUCKET);
  if (!path) return;
  const { error } = await supabase.storage.from(SUPABASE_ROLE_PHOTOS_BUCKET).remove([path]);
  if (error) throw error;
}

async function withTimeout(promise, ms, timeoutMessage) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

function AppShell({ children, isAdminLoggedIn, onAdminLogout, siteContent }) {
  const [prints, setPrints] = useState([]);
  const [isCursorFine, setIsCursorFine] = useState(true);
  const printIdRef = useRef(0);
  const throttleRef = useRef(0);
  const lastPointRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia('(pointer: fine)');
    const applyPointer = () => setIsCursorFine(media.matches);
    applyPointer();
    media.addEventListener('change', applyPointer);
    return () => media.removeEventListener('change', applyPointer);
  }, []);

  useEffect(() => {
    if (!isCursorFine) return undefined;

    const onMove = (event) => {
      const now = Date.now();
      if (now - throttleRef.current < 115) return;
      throttleRef.current = now;
      printIdRef.current += 1;
      const currentPoint = { x: event.clientX, y: event.clientY };
      const previousPoint = lastPointRef.current;
      lastPointRef.current = currentPoint;

      let offsetX = 0;
      let offsetY = 0;
      if (previousPoint) {
        const dx = currentPoint.x - previousPoint.x;
        const dy = currentPoint.y - previousPoint.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const side = printIdRef.current % 2 === 0 ? 1 : -1;
        offsetX = nx * side * 7;
        offsetY = ny * side * 7;
      }

      const next = {
        id: printIdRef.current,
        x: event.clientX + offsetX,
        y: event.clientY + offsetY,
        rotate: printIdRef.current % 2 === 0 ? -18 : 18,
      };
      setPrints((prev) => [...prev.slice(-20), next]);
      window.setTimeout(() => {
        setPrints((prev) => prev.filter((item) => item.id !== next.id));
      }, 900);
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isCursorFine]);

  const socialItems = [
    {
      id: 'instagram',
      name: 'Instagram',
      handle: siteContent.socialInstagramHandle,
      url: siteContent.socialInstagramUrl,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      handle: siteContent.socialTikTokHandle,
      url: siteContent.socialTikTokUrl,
    },
    {
      id: 'soundcloud',
      name: 'SoundCloud',
      handle: siteContent.socialSoundCloudHandle,
      url: siteContent.socialSoundCloudUrl,
    },
    {
      id: 'youtube',
      name: 'YouTube',
      handle: siteContent.socialYouTubeHandle,
      url: siteContent.socialYouTubeUrl,
    },
  ];

  const renderSocialIcon = (id) => {
    if (id === 'instagram') {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="4.5" width="15" height="15" rx="4.2" fill="none" />
          <circle cx="12" cy="12" r="3.5" fill="none" />
          <circle cx="16.9" cy="7.1" r="1.1" />
        </svg>
      );
    }
    if (id === 'tiktok') {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.1 4.6v7.5a3.5 3.5 0 1 1-2.3-3.25V7.2a5.5 5.5 0 1 0 4 5.2V9.35a5.2 5.2 0 0 0 3.6 1.45V8.5a3.95 3.95 0 0 1-3.9-3.9h-1.4z" />
        </svg>
      );
    }
    if (id === 'soundcloud') {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.3 17.9h8.9a3.5 3.5 0 0 0 .55-6.95 5.35 5.35 0 0 0-10.35-1.45A3.35 3.35 0 0 0 8.3 17.9z" fill="none" />
          <rect x="4.2" y="10.1" width="1.1" height="7.8" rx=".55" fill="none" />
          <rect x="5.8" y="9.2" width="1.1" height="8.7" rx=".55" fill="none" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.6" y="6" width="16.8" height="12" rx="2.8" fill="none" />
        <polygon points="10.2,9.3 15.6,12 10.2,14.7" fill="none" />
      </svg>
    );
  };

  const renderContactIcon = (id) => {
    if (id === 'email') {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="6.3" width="17" height="11.4" rx="2.1" fill="none" />
          <path d="M4.6 7.7 12 13l7.4-5.3" fill="none" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.2a7.9 7.9 0 0 0-6.8 12l-1 3.6 3.7-1A7.9 7.9 0 1 0 12 4.2Z" fill="none" />
        <path d="M9.1 9.2c.15-.35.3-.36.56-.36h.48c.15 0 .38-.06.59.43.2.49.68 1.68.74 1.8.06.12.1.27 0 .44-.1.16-.15.26-.3.4-.15.14-.3.31-.42.42-.14.14-.29.29-.12.57.17.28.77 1.27 1.66 2.06 1.15 1.01 2.12 1.33 2.4 1.48.28.15.44.13.6-.08.17-.21.71-.83.9-1.12.18-.29.37-.24.62-.15.25.09 1.6.76 1.87.9.27.13.45.2.52.32.07.12.07.71-.17 1.4-.24.69-1.4 1.32-1.93 1.4-.5.08-1.14.12-1.84-.11-.43-.14-.98-.32-1.7-.63-2.98-1.29-4.92-4.45-5.07-4.65-.15-.2-1.2-1.6-1.2-3.06 0-1.46.77-2.17 1.04-2.47Z" />
      </svg>
    );
  };

  return (
    <div className="page">
      {isCursorFine && (
        <div className="paw-layer" aria-hidden="true">
          {prints.map((print) => (
            <span
              key={print.id}
              className="paw-print"
              style={{
                left: `${print.x}px`,
                top: `${print.y}px`,
                transform: `translate(-50%, -50%) rotate(${print.rotate}deg)`,
              }}
            >
              🐾
            </span>
          ))}
        </div>
      )}

      <header className="header">
        <div className="container row">
          <Link to="/" className="logo-wrap" aria-label="Douha Club home">
            <img src="/brand/logos/v8.svg" className="logo-image" alt="Douha Club" />
          </Link>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'is-active' : '')}>HOME</NavLink>
            <NavLink to="/quem-somos" className={({ isActive }) => (isActive ? 'is-active' : '')}>QUEM SOMOS</NavLink>
            <NavLink to="/calendario" className={({ isActive }) => (isActive ? 'is-active' : '')}>CALENDARIO</NavLink>
            <NavLink to="/tickets" className={({ isActive }) => (isActive ? 'is-active' : '')}>INGRESSOS</NavLink>
            <NavLink to="/fotos" className={({ isActive }) => (isActive ? 'is-active' : '')}>FOTOS</NavLink>
            <NavLink to="/sets" className={({ isActive }) => (isActive ? 'is-active' : '')}>SETS</NavLink>
            <NavLink to="/editorial" className={({ isActive }) => (isActive ? 'is-active' : '')}>EDITORIAL</NavLink>
            <NavLink to="/contato" className={({ isActive }) => (isActive ? 'is-active' : '')}>CONTATO</NavLink>
          </nav>
        </div>
      </header>
      {isAdminLoggedIn && (
        <div className="admin-quickbar">
          <Link to="/admin" className="pill">Abrir painel</Link>
          <button type="button" className="pill pill-light" onClick={onAdminLogout}>Sair admin</button>
        </div>
      )}
      {children}

      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-col footer-col-social">
            <p className="eyebrow">SOCIAL</p>
            <ul className="footer-link-list">
              {socialItems.map((item) => (
                <li key={item.id} className="footer-link-item">
                  <a href={item.url} target="_blank" rel="noreferrer" className="footer-social-link">
                    <span className={`footer-social-icon footer-social-icon-${item.id}`} aria-hidden="true">{renderSocialIcon(item.id)}</span>
                    <span className="footer-social-name">{item.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-col footer-col-contact">
            <p className="eyebrow">CONTATO</p>
            <ul className="footer-contact-list">
              <li>
                <a href={`mailto:${siteContent.contactEmail}`} className="footer-contact-link">
                  <span className="footer-social-icon footer-contact-icon" aria-hidden="true">{renderContactIcon('email')}</span>
                  <span className="footer-social-name">Email</span>
                </a>
              </li>
              <li>
                <a href={siteContent.contactWhatsApp} target="_blank" rel="noreferrer" className="footer-contact-link">
                  <span className="footer-social-icon footer-contact-icon" aria-hidden="true">{renderContactIcon('whatsapp')}</span>
                  <span className="footer-social-name">WhatsApp</span>
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-col footer-col-community">
            <p className="eyebrow">PARTICIPE DA NOSSA COMUNIDADE</p>
            <div className="footer-community-stack">
              <a
                className="footer-community-newsletter"
                href={siteContent.communityNewsletterUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>{siteContent.communityNewsletterLabel}</span>
              </a>
              <a
                className="footer-community-line"
                href={siteContent.communityInstagramUrl}
                target="_blank"
                rel="noreferrer"
              >
                {siteContent.communityInstagramLabel}
              </a>
              <a
                className="footer-community-line"
                href={siteContent.communityWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
              >
                {siteContent.communityWhatsAppLabel}
              </a>
            </div>
          </div>
          <div className="footer-col footer-col-faq">
            <p className="eyebrow">FAQ</p>
            <a className="footer-faq-link" href="#faq">Acessar FAQ</a>
          </div>
          <div className="footer-col footer-col-brand">
            <p className="eyebrow">DOUHA CLUB</p>
            <p>ALL RIGHTS RESERVED 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AgendaEventBlock({ night }) {
  const hasPoster = Boolean(night.poster?.trim());
  const isPhotosPhase = shouldUseEventPhotosLink(night.date);
  const actionUrl = isPhotosPhase ? String(night.photosUrl || '').trim() : String(night.ticketUrl || '').trim();
  const hasActionUrl = Boolean(actionUrl);
  const ctaLabel = isPhotosPhase ? 'Ver fotos do role' : 'Comprar ingressos';
  const missingLabel = isPhotosPhase ? 'Sem link de fotos ainda' : 'Evento sem link ainda';
  const missingHint = isPhotosPhase
    ? 'Adicione o link do Drive no /admin'
    : 'Adicione o link do ingresso no /admin';
  const label = `Abrir detalhes — ${night.date}`;
  const posterInner = (
    <div className="agenda-poster">
      {hasPoster ? (
        <img
          src={night.poster}
          alt={`Poster do evento — ${night.lineup}`}
          title={IMAGE_SPEC.agendaPoster}
        />
      ) : (
        <div className="agenda-poster-placeholder">
          <span>Poster do line</span>
          <small>Substitua pela arte oficial</small>
          <small className="poster-spec-hint">{IMAGE_SPEC.agendaPoster}</small>
        </div>
      )}
      <div className="agenda-poster-overlay" aria-hidden="true">
        <span className="agenda-poster-cta">{hasActionUrl ? ctaLabel : missingLabel}</span>
        <span className="agenda-poster-hint">
          {hasActionUrl ? actionUrl.replace(/^https?:\/\//, '') : missingHint}
        </span>
      </div>
    </div>
  );

  return (
    <article className="agenda-event">
      {hasActionUrl ? (
        <a
          href={actionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="agenda-poster-link"
          aria-label={label}
        >
          {posterInner}
        </a>
      ) : (
        <div className="agenda-poster-link agenda-poster-link-disabled" aria-label={label}>
          {posterInner}
        </div>
      )}
      <div className="agenda-event-details">
        <p className="event-date">
          {night.date}
          <span>{night.time}</span>
        </p>
        <p className="event-lineup">{night.lineup}</p>
      </div>
    </article>
  );
}

function AgendaCalendarSection({
  agendaEvents,
  title = 'CALENDARIO',
  ctaLabel,
  ctaTo,
  showEmptySlots = false,
  adminMode = false,
  onEditEvent,
  onDeleteEvent,
  onCreateEvent,
  embedded = false,
  applySavedFocus = false,
  focusTarget,
  onFocusConsumed,
}) {
  const now = useMemo(() => new Date(), []);
  const currentMonth = now.getMonth();
  const monthBuckets = useMemo(() => {
    const buckets = {};
    agendaEvents.forEach((item) => {
      const parsed = parseAgendaDateParts(item.date);
      if (!parsed) return;
      const yearKey = String(parsed.year);
      if (!buckets[yearKey]) buckets[yearKey] = {};
      if (!buckets[yearKey][parsed.monthIndex]) buckets[yearKey][parsed.monthIndex] = [];
      buckets[yearKey][parsed.monthIndex].push(item);
    });
    return buckets;
  }, [agendaEvents]);
  const yearOptions = useMemo(() => getCalendarYearOptions(agendaEvents).map(String), [agendaEvents]);
  const [selectedYear, setSelectedYear] = useState(() => {
    const years = getRollingCalendarYears().map(String);
    const current = String(new Date().getFullYear());
    return years.includes(current) ? current : years[0];
  });
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    if (!applySavedFocus) return;
    try {
      const raw = localStorage.getItem(CALENDAR_FOCUS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const y = String(parsed?.year || '');
      const m = Number(parsed?.monthIndex);
      if (yearOptions.includes(y) && Number.isInteger(m) && m >= 0 && m <= 11) {
        queueMicrotask(() => {
          setSelectedYear(y);
          setSelectedMonth(m);
        });
      }
      localStorage.removeItem(CALENDAR_FOCUS_KEY);
    } catch {
      localStorage.removeItem(CALENDAR_FOCUS_KEY);
    }
  }, [applySavedFocus, yearOptions]);

  useEffect(() => {
    if (!focusTarget) return;
    const y = String(focusTarget.year || '');
    const m = Number(focusTarget.monthIndex);
    if (yearOptions.includes(y) && Number.isInteger(m) && m >= 0 && m <= 11) {
      queueMicrotask(() => {
        setSelectedYear(y);
        setSelectedMonth(m);
        onFocusConsumed?.();
      });
    }
  }, [focusTarget, onFocusConsumed, yearOptions]);

  const monthEvents = useMemo(() => {
    if (!selectedYear) return [];
    const rows = monthBuckets[selectedYear]?.[selectedMonth] || [];
    return rows.slice(0, MAX_EVENTS_PER_MONTH);
  }, [monthBuckets, selectedMonth, selectedYear]);
  const emptySlots = Math.max(0, MAX_EVENTS_PER_MONTH - monthEvents.length);

  const WrapperTag = embedded ? 'div' : 'section';
  const InnerTag = 'div';

  return (
    <WrapperTag className={`agenda-calendar-section${embedded ? ' is-embedded' : ' section'}`}>
      <InnerTag className={`calendar-content${embedded ? '' : ' container'}`}>
        <div className="section-head">
          <h2>{title}</h2>
          {ctaLabel && ctaTo ? <Link className="pill pill-light" to={ctaTo}>{ctaLabel}</Link> : null}
        </div>
        <div className="calendar-toolbar">
          <div className="calendar-year-tabs" role="tablist" aria-label="Selecionar ano da agenda">
            {yearOptions.length ? yearOptions.map((year) => (
              <button
                key={`calendar-year-${year}`}
                type="button"
                className={`calendar-year-tab${selectedYear === year ? ' is-active' : ''}`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            )) : <span className="calendar-empty-note">Sem anos cadastrados ainda.</span>}
          </div>

          <div className="calendar-month-tabs" role="tablist" aria-label="Selecionar mes da agenda">
            {MONTH_LABELS.map((monthLabel, idx) => {
              return (
                <button
                  key={`calendar-month-${monthLabel}`}
                  type="button"
                  className={`calendar-month-tab${selectedMonth === idx ? ' is-active' : ''}`}
                  onClick={() => setSelectedMonth(idx)}
                >
                  {monthLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="calendar-event-grid">
          {monthEvents.length ? monthEvents.map((night) => (
            adminMode ? (
              <article key={`calendar-${night.id}`} className="admin-calendar-slot">
                <p><strong>{night.date}</strong> · {night.time || 'Sem horario'}</p>
                <p>{night.lineup}</p>
                <p className="admin-url">
                  Ingresso: {night.ticketUrl || 'Sem link'}
                  <br />
                  Fotos (Drive): {night.photosUrl || 'Sem link'}
                </p>
                <div className="admin-actions">
                  <button type="button" className="pill" onClick={() => onEditEvent?.(night)}>Editar</button>
                  <button type="button" className="pill" onClick={() => onDeleteEvent?.(night.id)}>Excluir</button>
                </div>
              </article>
            ) : <AgendaEventBlock key={`calendar-${night.id}`} night={night} />
          )) : (
            <p className="calendar-empty-note">Nenhum evento nesse mes.</p>
          )}
          {showEmptySlots ? Array.from({ length: emptySlots }).map((_, idx) => (
            <article key={`empty-slot-${selectedYear}-${selectedMonth}-${idx}`} className="admin-calendar-slot admin-calendar-slot-empty">
              <p><strong>Slot livre</strong></p>
              <p>Disponivel para criar evento neste mes.</p>
              {adminMode ? (
                <button
                  type="button"
                  className="pill"
                  onClick={() => onCreateEvent?.({
                    year: Number(selectedYear),
                    monthIndex: selectedMonth,
                    slotIndex: idx,
                  })}
                >
                  Criar evento
                </button>
              ) : null}
            </article>
          )) : null}
        </div>
      </InnerTag>
    </WrapperTag>
  );
}

/** Metade da faixa duplicada em loop (mais lento que a animacao CSS antiga de 48s). */
const HERO_MARQUEE_HALF_LOOP_SEC = 72;

/** Faixa pos-experiencia: cards em colunas (repetimos URLs pra preencher). */
const ROLE_STRIP_LANES = 12;
const ROLE_STRIP_MIN_CARDS = 24;
const ROLE_STRIP_MAX_CARDS = 100;

function shuffleRolePhotosDeterministic(urls) {
  const arr = [...urls];
  let seed = 2166136261;
  const key = arr.join('|');
  for (let i = 0; i < key.length; i += 1) {
    seed ^= key.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  let state = seed >>> 0;
  const rnd = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRoleStripCardCount(photoCount) {
  if (!photoCount) return ROLE_STRIP_MIN_CARDS;
  return Math.min(ROLE_STRIP_MAX_CARDS, Math.max(ROLE_STRIP_MIN_CARDS, Math.round(photoCount * 2.8)));
}

function HomePage({ agendaEvents, sitePhotos, rolePhotos, editorialPosts, calendarFocus, onFocusConsumed, siteContent }) {
  const photos = sitePhotos.length ? sitePhotos : gallery;
  const parsedHeroPhotos = useMemo(
    () => photos.map(parsePhotoEntry).filter((item) => item.primary),
    [photos],
  );
  const heroPhotoStrip = useMemo(
    () => [...parsedHeroPhotos, ...parsedHeroPhotos, ...parsedHeroPhotos, ...parsedHeroPhotos],
    [parsedHeroPhotos],
  );
  const heroShellRef = useRef(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });
  const heroDragCleanupRef = useRef(null);
  const [heroDragging, setHeroDragging] = useState(false);
  const [videoCards, setVideoCards] = useState(() => tracks.slice(0, YOUTUBE_FETCH_COUNT));
  const rolePhotoPlaceholders = useMemo(
    () => {
      const lanes = ROLE_STRIP_LANES;
      const total = ROLE_STRIP_MIN_CARDS;
      return Array.from({ length: total }, (_, idx) => {
        const lane = idx % lanes;
        const wave = Math.floor(idx / lanes);
        return {
          id: `role-placeholder-${idx}`,
          shape: lane % 3 === 0 ? 'is-tall' : lane % 3 === 1 ? 'is-medium' : 'is-thin',
          style: {
            '--role-lane': `${lane}`,
            '--role-delay': `${-(wave * 11 + lane * 0.55)}s`,
            '--role-duration': `${36 + (lane % 3) * 3}s`,
            '--role-drift': `${4 + lane * 0.35}px`,
          },
        };
      });
    },
    [],
  );
  const rolePhotoCards = useMemo(() => {
    if (!rolePhotos.length) return rolePhotoPlaceholders.map((item) => ({ ...item, url: '' }));
    const lanes = ROLE_STRIP_LANES;
    const total = getRoleStripCardCount(rolePhotos.length);
    const shuffled = shuffleRolePhotosDeterministic(rolePhotos);
    return Array.from({ length: total }, (_, idx) => {
      const lane = idx % lanes;
      const wave = Math.floor(idx / lanes);
      return {
        id: `role-photo-${idx}`,
        url: shuffled[idx % shuffled.length],
        shape: lane % 3 === 0 ? 'is-tall' : lane % 3 === 1 ? 'is-medium' : 'is-thin',
        style: {
          '--role-lane': `${lane}`,
          '--role-delay': `${-(wave * 11 + lane * 0.55)}s`,
          '--role-duration': `${36 + (lane % 3) * 3}s`,
          '--role-drift': `${4 + lane * 0.35}px`,
        },
      };
    });
  }, [rolePhotos, rolePhotoPlaceholders]);

  const detachHeroDragListeners = () => {
    const fn = heroDragCleanupRef.current;
    if (fn) {
      fn();
      heroDragCleanupRef.current = null;
    }
    draggingRef.current = false;
    setHeroDragging(false);
  };

  useEffect(() => {
    const el = heroShellRef.current;
    if (!el) return;

    let rafId = 0;
    let last = performance.now();

    const normalizeScroll = () => {
      const half = el.scrollWidth / 2;
      if (half <= 0) return;
      if (el.scrollLeft >= half - 1) el.scrollLeft -= half;
      else if (el.scrollLeft < 1) el.scrollLeft += half;
    };

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!draggingRef.current && el.scrollWidth > el.clientWidth) {
        const half = el.scrollWidth / 2;
        const speed = half / HERO_MARQUEE_HALF_LOOP_SEC;
        el.scrollLeft += speed * dt;
        normalizeScroll();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      const fn = heroDragCleanupRef.current;
      if (fn) {
        fn();
        heroDragCleanupRef.current = null;
      }
      draggingRef.current = false;
    };
  }, [heroPhotoStrip]);

  useEffect(() => {
    if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID) return undefined;
    let active = true;
    const loadYouTube = async () => {
      try {
        const latest = await fetchLatestYouTubeVideos({
          apiKey: YOUTUBE_API_KEY,
          channelId: YOUTUBE_CHANNEL_ID,
          maxResults: YOUTUBE_FETCH_COUNT,
        });
        if (!active) return;
        setVideoCards(latest);
      } catch (err) {
        if (!active) return;
        if (import.meta.env.DEV) {
          console.warn('[Douha] YouTube API (usando placeholders):', err?.message || err);
        }
        setVideoCards(tracks.slice(0, YOUTUBE_FETCH_COUNT));
      }
    };
    loadYouTube();
    return () => {
      active = false;
    };
  }, []);

  const onHeroPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const shell = heroShellRef.current;
    if (!shell) return;

    detachHeroDragListeners();

    e.preventDefault();
    draggingRef.current = true;
    setHeroDragging(true);
    dragStartRef.current = { x: e.clientX, scrollLeft: shell.scrollLeft };

    const pointerId = e.pointerId;

    const normalizeShellScroll = (node) => {
      const half = node.scrollWidth / 2;
      if (half <= 0) return;
      if (node.scrollLeft >= half - 1) node.scrollLeft -= half;
      else if (node.scrollLeft < 1) node.scrollLeft += half;
    };

    const move = (ev) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const node = heroShellRef.current;
      if (!node || !draggingRef.current) return;
      const { x, scrollLeft } = dragStartRef.current;
      node.scrollLeft = scrollLeft - (ev.clientX - x);
      normalizeShellScroll(node);
    };

    const up = (ev) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      detachHeroDragListeners();
    };

    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);

    heroDragCleanupRef.current = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  };

  return (
    <main>
      <section className="hero hero-fotos">
        <div
          className="hero-fotos-marquee-outer"
          aria-label={`Carrossel de fotos do Douha Club. ${IMAGE_SPEC.heroStrip}`}
        >
          <div
            ref={heroShellRef}
            className={`carousel-shell hero-fotos-shell${heroDragging ? ' hero-fotos-shell--dragging' : ''}`}
            onPointerDown={onHeroPointerDown}
          >
            <div className="photo-carousel hero-photo-carousel">
              {heroPhotoStrip.map((photo, idx) => (
                photo.mode === 'wide' ? (
                  <figure className="photo-frame hero-photo-frame hero-photo-frame-wide" key={`hero-photo-wide-${photo.primary}-${idx}`}>
                    <img
                      src={photo.primary}
                      alt=""
                      title={IMAGE_SPEC.heroStrip}
                      draggable={false}
                      onDragStart={(ev) => ev.preventDefault()}
                    />
                  </figure>
                ) : photo.mode === 'double' ? (
                  <figure className="photo-frame hero-photo-frame hero-photo-frame-double" key={`hero-photo-double-${photo.primary}-${photo.secondary}-${idx}`}>
                    <div className="hero-double-slot">
                      <img
                        src={photo.primary}
                        alt=""
                        title={IMAGE_SPEC.heroStrip}
                        draggable={false}
                        onDragStart={(ev) => ev.preventDefault()}
                      />
                    </div>
                    <div className="hero-double-slot">
                      <img
                        src={photo.secondary}
                        alt=""
                        title={IMAGE_SPEC.heroStrip}
                        draggable={false}
                        onDragStart={(ev) => ev.preventDefault()}
                      />
                    </div>
                  </figure>
                ) : (
                  <figure className="photo-frame hero-photo-frame" key={`hero-photo-${photo.primary}-${idx}`}>
                    <img
                      src={photo.primary}
                      alt=""
                      title={IMAGE_SPEC.heroStrip}
                      draggable={false}
                      onDragStart={(ev) => ev.preventDefault()}
                    />
                  </figure>
                )
              ))}
            </div>
          </div>
        </div>
      </section>

      <AgendaCalendarSection
        agendaEvents={agendaEvents}
        ctaLabel="Abrir pagina"
        ctaTo="/calendario"
        applySavedFocus
        focusTarget={calendarFocus}
        onFocusConsumed={onFocusConsumed}
      />

      <section className="experience-highlight">
        <div
          className={`experience-highlight-image${String(siteContent?.experienceHeroImageUrl || '').trim() ? ' experience-highlight-image--photo' : ''}`}
        >
          {String(siteContent?.experienceHeroImageUrl || '').trim() ? (
            <>
              <img
                className="experience-highlight-img"
                src={String(siteContent.experienceHeroImageUrl).trim()}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <div className="experience-highlight-scrim" aria-hidden="true" />
            </>
          ) : null}
        </div>
        <div className="experience-highlight-copy">
          <div className="container">
            <h2>
              <span>CONHECA A EXPERIENCIA DOUHA</span>
            </h2>
            <p>
              <span>Uma imersao entre curadoria sonora, visual impactante e energia de pista</span>{' '}
              <strong>pensada para marcar cada noite.</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="people-role-photos" aria-label="Espaco reservado para fotos do role">
        <div className="people-role-photos-stage">
          <div className="people-role-photos-diagonal" aria-hidden="true">
            {rolePhotoCards.map((item) => (
              <figure
                key={item.id}
                className={`role-photo-card ${item.shape}`}
                style={item.style}
              >
                {item.url ? <img src={item.url} alt="" draggable={false} onDragStart={(ev) => ev.preventDefault()} /> : <span>FOTO</span>}
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="sets-banner">
        <div className="container">
          <p className="sets-banner-copy">
            <span>Sinta o Douha alem das paredes do club.</span>{' '}
            <strong>Mergulhe na nossa curadoria sonora</strong>{' '}
            <span>e reviva a energia das pistas com</span>{' '}
            <strong>sets unicos e conteudos exclusivos.</strong>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container music-block">
          <div className="sets-feed-header">
            <div className="sets-feed-channel">
              <span className="sets-feed-avatar" aria-hidden="true">⬤</span>
              <strong>Douha Club</strong>
            </div>
            <a className="sets-channel-link" href={youtubeChannelUrl} target="_blank" rel="noreferrer">
              <span className="sets-channel-icon" aria-hidden="true">▶</span>
              <span>YouTube</span>
            </a>
          </div>
          <div className="sets-video-grid">
            {videoCards.slice(0, YOUTUBE_FEED_CARDS).map((track) => (
              <a key={track.videoId} className="sets-video-card" href={track.videoUrl} target="_blank" rel="noreferrer">
                <div className="sets-video-thumb">
                  <img src={track.thumb} alt={`Thumb do set ${track.title}`} />
                  <span className="sets-play-badge" aria-hidden="true">▶</span>
                </div>
                <p>{track.title}</p>
              </a>
            ))}
          </div>

          <div className="sets-topics-block">
            <div className="section-head">
              <h2><Link to="/sets">Sets Unicos</Link></h2>
            </div>
            <div className="sets-topic-list">
              {videoCards.slice(0, YOUTUBE_TOPICS_ROWS).map((track) => (
                <a key={`home-topic-${track.videoId}`} className="sets-topic-row" href={track.videoUrl} target="_blank" rel="noreferrer">
                  <span className="sets-topic-play" aria-hidden="true">▶</span>
                  <p>{track.title}</p>
                  <span className="sets-topic-platform">{track.platform || 'YOUTUBE'}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section editorial-news-section">
        <div className="container">
          <div className="section-head editorial-news-head">
            <h2>Editorial</h2>
            <Link className="pill" to="/editorial">Abrir pagina</Link>
          </div>
          <div className="editorial-news-grid">
            {(editorialPosts.filter((item) => item.isPublished !== false).length
              ? editorialPosts.filter((item) => item.isPublished !== false)
              : defaultEditorialPosts).slice(0, 4).map((post) => (
              <article key={`${post.id}-${post.title}`} className="editorial-news-card">
                <div className="editorial-news-kicker">
                  <small>{post.source}</small>
                  <small>{post.issue} · {post.date || ''}</small>
                </div>
                <h3>{post.title}</h3>
                <p>{post.deck}</p>
                <a href="#top">Read more</a>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function QuemSomosPage({ siteContent }) {
  return (
    <main>
      <section className="section">
        <div className="container">
          <h2>Quem Somos</h2>
          <p className="about-copy">
            {siteContent.whoWeAreText}
          </p>
          <p className="about-copy">
            Instagram de referencia editorial:{' '}
            <a href={siteContent.whoWeAreInstagram} target="_blank" rel="noreferrer">
              @douha.club
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

function AgendaPage({ agendaEvents, calendarFocus, onFocusConsumed }) {
  return (
    <main>
      <AgendaCalendarSection
        agendaEvents={agendaEvents}
        title="CALENDARIO"
        ctaLabel="Ver ingressos"
        ctaTo="/tickets"
        applySavedFocus
        focusTarget={calendarFocus}
        onFocusConsumed={onFocusConsumed}
      />
      <section className="section">
        <div className="container">
          <h2>Worldwide</h2>
          <div className="cities">
            {cities.map((item) => (
              <article key={item.city} className="city-card">
                <h3>{item.city}</h3>
                <p>{item.date}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function TicketsPage() {
  return (
    <main>
      <section className="section">
        <div className="container">
          <h2>Ingressos</h2>
          <div className="ticket-grid">
            <a className="ticket-card" href="#top"><h3>PRE-SALE SAO PAULO</h3><p>Redirecionamento para plataforma oficial.</p></a>
            <a className="ticket-card" href="#top"><h3>GENERAL SALE RIO</h3><p>Compra de ingresso por lote e data.</p></a>
            <a className="ticket-card" href="#top"><h3>LISTA VIP / EARLY ACCESS</h3><p>Cadastro para abertura de lote.</p></a>
          </div>
        </div>
      </section>
    </main>
  );
}

function FotosPage({ sitePhotos, setSitePhotos, isAdminLoggedIn }) {
  const uploadedPhotos = sitePhotos.length ? sitePhotos : gallery;
  const parsedUploadedPhotos = useMemo(() => uploadedPhotos.map(parsePhotoEntry), [uploadedPhotos]);

  const onFilesChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const mapped = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
    setSitePhotos((prev) => [...mapped.map((item) => item.url), ...prev].slice(0, 60));
  };

  return (
    <main>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Nossas Fotos</h2>
          </div>
          <p className="about-copy">
            Espaco para subir as fotos de cada dia. Neste esboco, as imagens aparecem localmente no navegador.
          </p>
          <p className="about-copy image-spec-note">{IMAGE_SPEC.gallery}</p>
          <label className="upload-box" htmlFor="daily-photo-upload">
            <span>Selecionar fotos do dia</span>
            <small>JPG, PNG, WEBP - multiplos arquivos</small>
          </label>
          <input
            id="daily-photo-upload"
            type="file"
            accept="image/*"
            multiple
            className="file-input"
            onChange={onFilesChange}
          />

          <div className="uploaded-gallery">
            {parsedUploadedPhotos.map((photo, idx) => (
              <figure
                key={`photo-${idx}-${photo.primary.slice(0, 24)}`}
                className={`uploaded-card${photo.mode === 'wide' ? ' uploaded-card-wide' : ''}`}
              >
                <img src={photo.primary} alt="Foto do Douha Club" title={IMAGE_SPEC.gallery} />
                <figcaption>
                  {isAdminLoggedIn ? (
                    <button
                      type="button"
                      className="pill"
                      onClick={() => setSitePhotos((prev) => prev.filter((_, photoIdx) => photoIdx !== idx))}
                    >
                      Remover foto
                    </button>
                  ) : 'Foto da galeria'}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SetsPage() {
  const [videoCards, setVideoCards] = useState(() => tracks.slice(0, YOUTUBE_FETCH_COUNT));

  useEffect(() => {
    if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID) return undefined;
    let active = true;
    const loadYouTube = async () => {
      try {
        const latest = await fetchLatestYouTubeVideos({
          apiKey: YOUTUBE_API_KEY,
          channelId: YOUTUBE_CHANNEL_ID,
          maxResults: YOUTUBE_FETCH_COUNT,
        });
        if (!active) return;
        setVideoCards(latest);
      } catch (err) {
        if (!active) return;
        if (import.meta.env.DEV) {
          console.warn('[Douha] YouTube API (usando placeholders):', err?.message || err);
        }
        setVideoCards(tracks.slice(0, YOUTUBE_FETCH_COUNT));
      }
    };
    loadYouTube();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <section className="sets-banner">
        <div className="container">
          <p className="sets-banner-copy">
            <span>Sinta o Douha alem das paredes do club.</span>{' '}
            <strong>Mergulhe na nossa curadoria sonora</strong>{' '}
            <span>e reviva a energia das pistas com</span>{' '}
            <strong>sets unicos e conteudos exclusivos.</strong>
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container music-block">
          <div className="sets-feed-header">
            <div className="sets-feed-channel">
              <span className="sets-feed-avatar" aria-hidden="true">⬤</span>
              <strong>Douha Club</strong>
            </div>
            <a className="sets-channel-link" href={youtubeChannelUrl} target="_blank" rel="noreferrer">
              <span className="sets-channel-icon" aria-hidden="true">▶</span>
              <span>YouTube</span>
            </a>
          </div>
          <div className="sets-video-grid">
            {videoCards.slice(0, YOUTUBE_FEED_CARDS).map((track) => (
              <a key={track.videoId} className="sets-video-card" href={track.videoUrl} target="_blank" rel="noreferrer">
                <div className="sets-video-thumb">
                  <img src={track.thumb} alt={`Thumb do set ${track.title}`} />
                  <span className="sets-play-badge" aria-hidden="true">▶</span>
                </div>
                <p>{track.title}</p>
              </a>
            ))}
          </div>
          <div className="sets-topics-block">
            <div className="section-head">
              <h2>Sets Unicos</h2>
            </div>
            <div className="sets-topic-list">
              {videoCards.slice(0, YOUTUBE_TOPICS_ROWS).map((track) => (
                <a key={`sets-topic-${track.videoId}`} className="sets-topic-row" href={track.videoUrl} target="_blank" rel="noreferrer">
                  <span className="sets-topic-play" aria-hidden="true">▶</span>
                  <p>{track.title}</p>
                  <span className="sets-topic-platform">{track.platform || 'YOUTUBE'}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function EditorialPage({ editorialPosts }) {
  const sourcePosts = editorialPosts.length ? editorialPosts : defaultEditorialPosts;
  const published = sourcePosts.filter((item) => item.isPublished !== false);
  const posts = published.length ? published : defaultEditorialPosts;
  const lead = posts[0];
  const side = posts.slice(1, 3);
  const latest = [
    ...posts,
    {
      source: 'AGENDA',
      issue: 'FLASH',
      date: 'MAI 2026',
      title: 'Cenas da semana: bastidores, crowd e highlights da pista',
      deck: 'Recorte rapido dos momentos que definiram o ritmo da semana no ecossistema Douha.',
    },
    {
      source: 'ENTREVISTA',
      issue: 'ED. 04',
      date: 'MAI 2026',
      title: 'Resident talks: curadoria, narrativa sonora e tensao de pista',
      deck: 'Conversa sobre selecao musical, leitura de publico e construcao de atmosfera.',
    },
  ];

  return (
    <main>
      <section className="section">
        <div className="container editorial-newsroom">
          <div className="editorial-newsroom-head">
            <h2>Editorial</h2>
            <p className="about-copy">
              Cobertura em linguagem de portal: manchetes, leitura de cena, entrevistas e atualizacoes do universo Douha.
            </p>
          </div>

          <div className="editorial-newsroom-hero">
            <article className="editorial-lead-story">
              <small>{lead?.source} · {lead?.issue} · {lead?.date}</small>
              <h3>{lead?.title}</h3>
              <p>{lead?.deck}</p>
              <a href="#top">Ler materia completa</a>
            </article>

            <div className="editorial-side-stories">
              {side.map((post) => (
                <article key={`side-${post.issue}-${post.title}`} className="editorial-side-story">
                  <small>{post.source} · {post.date}</small>
                  <h4>{post.title}</h4>
                  <a href="#top">Abrir</a>
                </article>
              ))}
            </div>
          </div>

          <section className="editorial-latest-block">
            <div className="section-head">
              <h3>Ultimas publicacoes</h3>
            </div>
            <div className="editorial-latest-list">
              {latest.map((post, idx) => (
                <article key={`latest-${post.issue}-${post.title}-${idx}`} className="editorial-latest-item">
                  <small>{post.source} · {post.issue} · {post.date}</small>
                  <h4>{post.title}</h4>
                  <p>{post.deck}</p>
                  <a href="#top">Ler agora</a>
                </article>
              ))}
            </div>
          </section>
          <section className="editorial-note">
            <p>
              Em breve: pagina dedicada para cada materia com texto completo, galeria e embeds de audio/video.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function ContactPage({ siteContent }) {
  return (
    <main>
      <section className="section">
        <div className="container">
          <h2>Comercial / Contato</h2>
          <div className="contact-grid">
            <a className="contact-card" href={`mailto:${siteContent.contactEmail}`}><h3>EMAIL COMERCIAL</h3><p>{siteContent.contactEmail}</p></a>
            <a className="contact-card" href={siteContent.contactWhatsApp} target="_blank" rel="noreferrer"><h3>WHATSAPP BUSINESS</h3><p>Canal direto para parcerias.</p></a>
            <a className="contact-card" href="#top"><h3>MEDIA KIT</h3><p>Solicitacao de material institucional.</p></a>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <h2>FAQ</h2>
          <div className="faq-list">
            {faq.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function AdminPage({
  agendaEvents,
  setAgendaEvents,
  onResetAgenda,
  isAdminLoggedIn,
  setIsAdminLoggedIn,
  sitePhotos,
  setSitePhotos,
  siteContent,
  setSiteContent,
  editorialPosts,
  setEditorialPosts,
  rolePhotos,
  setRolePhotos,
  onEventSavedFocus,
  agendaSyncError,
  supabaseSetupError,
}) {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState({ date: '', time: '', lineup: '', ticketUrl: '', photosUrl: '', poster: '' });
  const [posterUrlInput, setPosterUrlInput] = useState('');
  const [draftSiteContent, setDraftSiteContent] = useState(() => mergeSiteContentWithDefaults(siteContent));
  const [draftPhotos, setDraftPhotos] = useState(() => [...sitePhotos]);
  const [draftRolePhotos, setDraftRolePhotos] = useState(() => [...rolePhotos]);
  const [draftEditorial, setDraftEditorial] = useState(() => ({
    id: '',
    title: '',
    deck: '',
    body: '',
    source: 'DOUHA CLUB',
    issue: '',
    category: '',
    coverUrl: '',
    date: '',
    isPublished: true,
  }));
  const [editingEditorialId, setEditingEditorialId] = useState('');
  const [saveHint, setSaveHint] = useState('');
  const [agendaSaveError, setAgendaSaveError] = useState('');
  const [editorialError, setEditorialError] = useState('');
  const [rolePhotosError, setRolePhotosError] = useState('');
  const adminYearOptions = useMemo(() => getCalendarYearOptions(agendaEvents), [agendaEvents]);
  const currentYear = new Date().getFullYear();
  const [draftDay, setDraftDay] = useState(1);
  const [draftMonthIndex, setDraftMonthIndex] = useState(new Date().getMonth());
  const [draftYear, setDraftYear] = useState(
    adminYearOptions.includes(currentYear) ? currentYear : adminYearOptions[0],
  );
  const [showEventForm, setShowEventForm] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [isUploadingExperienceHero, setIsUploadingExperienceHero] = useState(false);
  const [experienceHeroUploadError, setExperienceHeroUploadError] = useState('');
  const [experienceHeroPreviewFailed, setExperienceHeroPreviewFailed] = useState(false);
  const [isSavingGallery, setIsSavingGallery] = useState(false);
  const [isSavingEditorial, setIsSavingEditorial] = useState(false);
  const [isSavingRolePhotos, setIsSavingRolePhotos] = useState(false);
  const [posterUploadError, setPosterUploadError] = useState('');
  const [posterUploadInfo, setPosterUploadInfo] = useState('');
  const formRef = useRef(null);
  const galleryUploadWideRef = useRef(false);
  const [galleryUploadWide, setGalleryUploadWide] = useState(false);
  const sortedAgenda = useMemo(() => [...agendaEvents], [agendaEvents]);
  const adminStats = useMemo(() => {
    const total = sortedAgenda.length;
    const withTicket = sortedAgenda.filter((item) => String(item.ticketUrl || '').trim()).length;
    const withPhotos = sortedAgenda.filter((item) => String(item.photosUrl || '').trim()).length;
    return { total, withTicket, withPhotos, totalPhotos: draftPhotos.length };
  }, [sortedAgenda, draftPhotos.length]);
  const timeOptions = useMemo(() => {
    const existing = sortedAgenda
      .map((item) => String(item.time || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...DEFAULT_TIME_OPTIONS, ...existing]));
  }, [sortedAgenda]);

  const flashSaved = () => {
    setSaveHint('Alteracoes salvas no site.');
    window.setTimeout(() => setSaveHint(''), 2800);
    window.alert('Salvo com sucesso.');
  };

  // Mantem rascunhos do admin sincronizados com o estado principal quando logado.
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    setDraftSiteContent(mergeSiteContentWithDefaults(siteContent));
    setDraftPhotos([...sitePhotos]);
    setDraftRolePhotos([...rolePhotos]);
  }, [isAdminLoggedIn, siteContent, sitePhotos, rolePhotos]);

  const onLogin = (event) => {
    event.preventDefault();
    if (usernameInput !== ADMIN_USERNAME || passwordInput !== ADMIN_PASSWORD) {
      setAuthError('Login ou senha invalidos.');
      return;
    }
    safeSetLocalStorage(ADMIN_AUTH_KEY, 'ok');
    setIsAdminLoggedIn(true);
    setUsernameInput('');
    setPasswordInput('');
    setAuthError('');
  };

  const onLogout = () => {
    safeRemoveLocalStorage(ADMIN_AUTH_KEY);
    setIsAdminLoggedIn(false);
  };

  const onEdit = (item) => {
    const parsed = parseAgendaDateParts(item.date);
    if (parsed) {
      setDraftDay(parsed.day || 1);
      setDraftMonthIndex(parsed.monthIndex);
      setDraftYear(parsed.year);
    }
    setEditingId(item.id);
    setDraft({
      date: item.date || '',
      time: item.time || '',
      lineup: item.lineup || '',
      ticketUrl: item.ticketUrl || '',
      photosUrl: item.photosUrl || '',
      poster: item.poster || '',
    });
    setPosterUrlInput(item.poster || '');
    setShowEventForm(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const onCreateFromCalendar = ({ year, monthIndex }) => {
    setEditingId('');
    setDraft({ date: '', time: '', lineup: '', ticketUrl: '', photosUrl: '', poster: '' });
    setPosterUrlInput('');
    setDraftDay(1);
    setDraftMonthIndex(monthIndex);
    setDraftYear(year);
    setAgendaSaveError('');
    setPosterUploadError('');
    setPosterUploadInfo('');
    setShowEventForm(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const resetDraft = () => {
    setEditingId('');
    setDraft({ date: '', time: '', lineup: '', ticketUrl: '', photosUrl: '', poster: '' });
    setPosterUrlInput('');
    setDraftDay(1);
    setDraftMonthIndex(new Date().getMonth());
    setDraftYear(adminYearOptions.includes(currentYear) ? currentYear : adminYearOptions[0]);
    setPosterUploadError('');
    setPosterUploadInfo('');
  };

  const onDelete = async (id) => {
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase nao configurado');
      }
      const { error } = await supabase.from(SUPABASE_EVENTS_TABLE).delete().eq('id', id);
      if (error) throw error;
      const nextAgenda = agendaEvents.filter((item) => item.id !== id);
      setAgendaEvents(nextAgenda);
      if (editingId === id) resetDraft();
      setAgendaSaveError('');
    } catch (error) {
      setAgendaSaveError(`Nao foi possivel excluir no Supabase: ${error.message || 'erro desconhecido'}`);
    }
  };

  const onPosterUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase nao configurado para upload do poster.');
      }
      setIsUploadingPoster(true);
      setPosterUploadError('');
      setPosterUploadInfo('Processando poster...');
      const rawDataUrl = await readFileAsDataUrl(file);
      if (typeof rawDataUrl !== 'string') throw new Error('Arquivo invalido.');
      const compressed = await compressDataUrlImage(rawDataUrl, { maxWidth: 1280, quality: 0.82 });
      const bytes = estimateDataUrlBytes(compressed);
      const tooLargeForRecommendation = bytes > POSTER_MAX_BYTES;
      const compressedBlob = await (await fetch(String(compressed))).blob();
      const fileForUpload = new File([compressedBlob], file.name || `poster.jpg`, {
        type: 'image/jpeg',
      });
      const publicUrl = await withTimeout(
        uploadPosterToSupabaseStorage(fileForUpload),
        15000,
        'Timeout ao enviar poster para o Supabase Storage (15s).',
      );
      setDraft((prev) => ({ ...prev, poster: String(publicUrl) }));
      setPosterUrlInput(String(publicUrl));
      setAgendaSaveError('');
      setPosterUploadInfo(
        tooLargeForRecommendation
          ? `Poster enviado, mas ficou acima do recomendado (${POSTER_MAX_LABEL}).`
          : 'Poster enviado com sucesso.',
      );
    } catch (error) {
      const msg = error.message || 'Nao foi possivel preparar o poster.';
      setAgendaSaveError(msg);
      setPosterUploadError(msg);
      setPosterUploadInfo('');
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const onExperienceHeroUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase nao configurado para upload.');
      }
      setIsUploadingExperienceHero(true);
      setExperienceHeroUploadError('');
      const rawDataUrl = await readFileAsDataUrl(file);
      if (typeof rawDataUrl !== 'string') throw new Error('Arquivo invalido.');
      const compressed = await compressDataUrlImage(rawDataUrl, { maxWidth: 1920, quality: 0.84 });
      const compressedBlob = await (await fetch(String(compressed))).blob();
      const fileForUpload = new File([compressedBlob], file.name || 'experiencia-douha.jpg', {
        type: 'image/jpeg',
      });
      const publicUrl = await withTimeout(
        uploadGalleryImageToSupabaseStorage(fileForUpload),
        20000,
        'Timeout ao enviar imagem da experiencia (20s).',
      );
      setExperienceHeroPreviewFailed(false);
      setDraftSiteContent((prev) =>
        mergeSiteContentWithDefaults({ ...prev, experienceHeroImageUrl: String(publicUrl) }),
      );
    } catch (error) {
      setExperienceHeroUploadError(error.message || 'Nao foi possivel enviar a imagem.');
    } finally {
      setIsUploadingExperienceHero(false);
    }
  };

  const onUsePosterUrl = () => {
    setDraft((prev) => ({ ...prev, poster: posterUrlInput.trim() }));
    setPosterUploadError('');
    setPosterUploadInfo(posterUrlInput.trim() ? 'Poster por URL aplicado.' : '');
  };

  const onClearPoster = () => {
    setDraft((prev) => ({ ...prev, poster: '' }));
    setPosterUrlInput('');
    setPosterUploadError('');
    setPosterUploadInfo('');
  };

  const onSave = async (event) => {
    event.preventDefault();
    if (isSavingEvent || isUploadingPoster) return;
    setAgendaSaveError('');
    if (posterUploadError) {
      setAgendaSaveError(`Corrija o poster antes de salvar: ${posterUploadError}`);
      return;
    }
    setIsSavingEvent(true);
    const normalizedDate = formatAgendaDate(draftDay, draftMonthIndex, draftYear);
    const nextItem = {
      id: editingId || `event-${Date.now()}`,
      date: normalizedDate,
      time: draft.time.trim(),
      lineup: draft.lineup.trim(),
      ticketUrl: draft.ticketUrl.trim(),
      photosUrl: draft.photosUrl.trim(),
      poster: draft.poster.trim(),
    };
    if (!nextItem.date || !nextItem.lineup) {
      setAgendaSaveError('Preencha data e lineup para salvar o evento.');
      setIsSavingEvent(false);
      return;
    }

    try {
      const nextAgenda = editingId
        ? agendaEvents.map((item) => (item.id === editingId ? nextItem : item))
        : [nextItem, ...agendaEvents];

      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase nao configurado');
      }
      const payload = mapAgendaItemToDbEvent(nextItem);
      const saveResult = await withTimeout(
        supabase
          .from(SUPABASE_EVENTS_TABLE)
          .upsert(payload, { onConflict: 'id' }),
        12000,
        'Timeout ao salvar no Supabase (12s).',
      );
      if (saveResult.error && isMissingPhotosUrlColumnError(saveResult.error.message)) {
        const legacyPayload = { ...payload };
        delete legacyPayload.photos_url;
        const retry = await withTimeout(
          supabase
            .from(SUPABASE_EVENTS_TABLE)
            .upsert(legacyPayload, { onConflict: 'id' }),
          12000,
          'Timeout ao salvar no Supabase (12s).',
        );
        if (retry.error) throw retry.error;
      } else if (saveResult.error) {
        throw saveResult.error;
      }

      setAgendaEvents(nextAgenda);
    } catch (error) {
      const msg = formatSupabaseAgendaSaveError(error);
      console.error(msg, error);
      setAgendaSaveError(msg);
      window.alert(msg);
      setIsSavingEvent(false);
      return;
    }
    safeSetLocalStorage(CALENDAR_FOCUS_KEY, JSON.stringify({ year: draftYear, monthIndex: draftMonthIndex }));
    onEventSavedFocus?.({ year: draftYear, monthIndex: draftMonthIndex });
    resetDraft();
    flashSaved();
    setIsSavingEvent(false);
  };

  const onResetSiteContentDraft = () => {
    setDraftSiteContent({ ...defaultSiteContent });
    setExperienceHeroPreviewFailed(false);
  };

  const onSaveSiteContent = () => {
    setSiteContent(mergeSiteContentWithDefaults(draftSiteContent));
    flashSaved();
  };

  const onSaveGallery = async () => {
    setAgendaSaveError('');
    setIsSavingGallery(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase nao configurado');
      }

      const normalized = [];
      for (const src of [...draftPhotos].slice(0, 80)) {
        const value = String(src || '').trim();
        if (!value) continue;
        if (value.startsWith(WIDE_PHOTO_PREFIX)) {
          const parsed = parsePhotoEntry(value);
          const urlBody = parsed.primary;
          if (!urlBody) continue;
          if (urlBody.startsWith('data:')) {
            const blob = await (await fetch(urlBody)).blob();
            const file = new File([blob], `gallery-${Date.now()}-wide.jpg`, { type: 'image/jpeg' });
            const uploadedUrl = await uploadGalleryImageToSupabaseStorage(file);
            normalized.push(buildWidePhotoEntry(uploadedUrl));
          } else {
            normalized.push(buildWidePhotoEntry(urlBody));
          }
          continue;
        }
        if (value.startsWith(DOUBLE_PHOTO_PREFIX)) {
          const parsed = parsePhotoEntry(value);
          const nextPrimary = parsed.primary.startsWith('data:')
            ? await uploadGalleryImageToSupabaseStorage(
              new File([await (await fetch(parsed.primary)).blob()], `gallery-${Date.now()}-a.jpg`, { type: 'image/jpeg' }),
            )
            : parsed.primary;
          const nextSecondary = parsed.secondary.startsWith('data:')
            ? await uploadGalleryImageToSupabaseStorage(
              new File([await (await fetch(parsed.secondary)).blob()], `gallery-${Date.now()}-b.jpg`, { type: 'image/jpeg' }),
            )
            : parsed.secondary;
          normalized.push(buildDoublePhotoEntry(nextPrimary, nextSecondary));
          continue;
        }
        if (value.startsWith('data:')) {
          const blob = await (await fetch(value)).blob();
          const file = new File([blob], `gallery-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const uploadedUrl = await uploadGalleryImageToSupabaseStorage(file);
          normalized.push(uploadedUrl);
        } else {
          normalized.push(value);
        }
      }

      const { error: deleteError } = await supabase.from(SUPABASE_GALLERY_TABLE).delete().neq('id', '');
      if (deleteError) throw deleteError;
      if (normalized.length) {
        const rows = normalized.map((url, idx) => ({
          id: `photo-${idx + 1}`,
          photo_url: url,
          position: idx,
        }));
        const { error: insertError } = await supabase.from(SUPABASE_GALLERY_TABLE).upsert(rows, { onConflict: 'id' });
        if (insertError) throw insertError;
      }

      setDraftPhotos(normalized);
      setSitePhotos(normalized);
      safeSetLocalStorage(PHOTOS_STORAGE_KEY, JSON.stringify(normalized));
      flashSaved();
    } catch (error) {
      const msg = isMissingGalleryTableError(error.message)
        ? 'Nao foi possivel salvar galeria: tabela douha_site_photos ausente no Supabase. Rode o SQL de setup novamente no projeto novo.'
        : `Nao foi possivel salvar galeria no Supabase: ${error.message || 'erro desconhecido'}`;
      setAgendaSaveError(msg);
      window.alert(msg);
    } finally {
      setIsSavingGallery(false);
    }
  };

  const resetEditorialDraft = () => {
    setEditingEditorialId('');
    setDraftEditorial({
      id: '',
      title: '',
      deck: '',
      body: '',
      source: 'DOUHA CLUB',
      issue: '',
      category: '',
      coverUrl: '',
      date: '',
      isPublished: true,
    });
  };

  const onEditEditorial = (post) => {
    setEditingEditorialId(post.id);
    setDraftEditorial({
      id: post.id,
      title: post.title || '',
      deck: post.deck || '',
      body: post.body || '',
      source: post.source || 'DOUHA CLUB',
      issue: post.issue || '',
      category: post.category || '',
      coverUrl: post.coverUrl || '',
      date: post.date || '',
      isPublished: post.isPublished !== false,
    });
    setEditorialError('');
  };

  const onSaveEditorial = async (event) => {
    event.preventDefault();
    if (isSavingEditorial) return;
    setEditorialError('');
    const title = String(draftEditorial.title || '').trim();
    const deck = String(draftEditorial.deck || '').trim();
    if (!title || !deck) {
      setEditorialError('Preencha pelo menos titulo e deck para salvar a materia.');
      return;
    }
    setIsSavingEditorial(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase nao configurado');
      }
      const nextItem = normalizeEditorialItem(
        {
          ...draftEditorial,
          id: editingEditorialId || `editorial-${Date.now()}`,
          title,
          deck,
        },
        editorialPosts.length,
      );
      const payload = mapEditorialItemToDbPost(nextItem);
      const { error } = await supabase.from(SUPABASE_EDITORIAL_TABLE).upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      const nextPosts = editingEditorialId
        ? editorialPosts.map((item) => (item.id === editingEditorialId ? nextItem : item))
        : [nextItem, ...editorialPosts];
      setEditorialPosts(nextPosts);
      resetEditorialDraft();
      flashSaved();
    } catch (error) {
      const msg = isMissingEditorialTableError(error.message)
        ? 'Tabela douha_editorial_posts ausente no Supabase. Rode a migration 002.'
        : `Nao foi possivel salvar materia no Supabase: ${error.message || 'erro desconhecido'}`;
      setEditorialError(msg);
    } finally {
      setIsSavingEditorial(false);
    }
  };

  const onDeleteEditorial = async (id) => {
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase nao configurado');
      }
      const { error } = await supabase.from(SUPABASE_EDITORIAL_TABLE).delete().eq('id', id);
      if (error) throw error;
      setEditorialPosts((prev) => prev.filter((item) => item.id !== id));
      if (editingEditorialId === id) resetEditorialDraft();
    } catch (error) {
      const msg = isMissingEditorialTableError(error.message)
        ? 'Tabela douha_editorial_posts ausente no Supabase. Rode a migration 002.'
        : `Nao foi possivel remover materia: ${error.message || 'erro desconhecido'}`;
      setEditorialError(msg);
    }
  };

  const onRolePhotoUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setDraftRolePhotos((prev) => [reader.result, ...prev].slice(0, 120));
        }
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const onSaveRolePhotos = async () => {
    if (isSavingRolePhotos) return;
    setRolePhotosError('');
    setIsSavingRolePhotos(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase nao configurado');
      }
      const normalized = [];
      for (const src of draftRolePhotos) {
        const value = String(src || '').trim();
        if (!value) continue;
        if (value.startsWith('data:')) {
          const blob = await (await fetch(value)).blob();
          const file = new File([blob], `role-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const uploadedUrl = await uploadRolePhotoToSupabaseStorage(file);
          normalized.push(uploadedUrl);
        } else {
          normalized.push(value);
        }
      }

      const removed = rolePhotos.filter((url) => !normalized.includes(url));
      for (const url of removed) {
        try {
          await removeRolePhotoFromStorage(url);
        } catch (error) {
          console.warn(`Falha ao remover arquivo antigo do role: ${error.message || error}`);
        }
      }

      const { error: deleteError } = await supabase.from(SUPABASE_ROLE_PHOTOS_TABLE).delete().neq('id', '');
      if (deleteError) throw deleteError;
      if (normalized.length) {
        const rows = normalized.map((url, idx) => ({
          id: `role-photo-${idx + 1}`,
          photo_url: url,
          position: idx,
        }));
        const { error: insertError } = await supabase.from(SUPABASE_ROLE_PHOTOS_TABLE).upsert(rows, { onConflict: 'id' });
        if (insertError) throw insertError;
      }

      setDraftRolePhotos(normalized);
      setRolePhotos(normalized);
      safeSetLocalStorage(ROLE_PHOTOS_STORAGE_KEY, JSON.stringify(normalized));
      flashSaved();
    } catch (error) {
      const msg = isMissingRolePhotosTableError(error.message)
        ? 'Tabela douha_role_photos ausente no Supabase. Rode a migration 002.'
        : `Nao foi possivel salvar fotos do role no Supabase: ${error.message || 'erro desconhecido'}`;
      setRolePhotosError(msg);
    } finally {
      setIsSavingRolePhotos(false);
    }
  };

  const onAdminPhotoUpload = (event) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const useWide = galleryUploadWideRef.current;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const raw = reader.result;
          const entry = useWide ? buildWidePhotoEntry(raw) : raw;
          setDraftPhotos((prev) => [entry, ...prev].slice(0, 80));
        }
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const onMakePhotoSingleCard = (index) => {
    setDraftPhotos((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const item = parsePhotoEntry(prev[index]);
      if (item.mode !== 'wide') return prev;
      const next = [...prev];
      next[index] = item.primary;
      return next;
    });
  };

  const onSplitPhotoDouble = (index) => {
    setDraftPhotos((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const item = parsePhotoEntry(prev[index]);
      if (item.mode !== 'double') return prev;
      const next = [...prev];
      next.splice(index, 1, item.primary, item.secondary);
      return next;
    });
  };

  if (!isAdminLoggedIn) {
    return (
      <main>
        <section className="section">
          <div className="container admin-box">
            <h2>Admin</h2>
            <p className="about-copy">
              Login rapido para gerenciar agenda sem mexer em codigo.
            </p>
            <form className="admin-login-form" onSubmit={onLogin}>
              <label htmlFor="admin-username">Login</label>
              <input
                id="admin-username"
                type="text"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                placeholder="Digite o login"
                autoComplete="username"
              />
              <label htmlFor="admin-password">Senha</label>
              <input
                id="admin-password"
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="Digite a senha do admin"
                autoComplete="current-password"
              />
              {authError && <p className="admin-error">{authError}</p>}
              <button type="submit" className="pill pill-light">Entrar no painel</button>
            </form>
            <p className="admin-warning">
              Ambiente de desenvolvimento: essa senha e no front-end e nao substitui seguranca de servidor.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="section">
        <div className="container admin-box">
          <div className="section-head">
            <h2>Admin · Agenda</h2>
            <div className="admin-actions">
              <button type="button" className="pill" onClick={onResetAgenda}>Restaurar padrao</button>
              <button type="button" className="pill pill-light" onClick={onLogout}>Sair</button>
            </div>
          </div>
          <p className="admin-warning">
            Painel central de conteudo: tudo que impacta Home/Calendario/Fotos deve ser ajustado aqui.
          </p>

          <nav className="admin-nav">
            <a className="pill" href="#admin-overview">Visao geral</a>
            <a className="pill" href="#admin-experience-hero">Faixa experiencia</a>
            <a className="pill" href="#admin-site-content">Conteudo do site</a>
            <a className="pill" href="#admin-gallery">Galeria</a>
            <a className="pill" href="#admin-role-photos">Fotos do role</a>
            <a className="pill" href="#admin-editorial">Materias</a>
            <a className="pill" href="#admin-calendar">Calendario</a>
            <a className="pill" href="#admin-event-form">Formulario de evento</a>
          </nav>

          {saveHint && <p className="admin-save-hint" role="status">{saveHint}</p>}
          {supabaseSetupError && <p className="admin-error">{supabaseSetupError}</p>}
          {agendaSyncError && <p className="admin-error">{agendaSyncError}</p>}

          <article id="admin-overview" className="admin-panel-card admin-panel-card-highlight">
            <h3>Visao geral rapida</h3>
            <div className="admin-kpi-grid">
              <div className="admin-kpi-item"><strong>{adminStats.total}</strong><span>Eventos cadastrados</span></div>
              <div className="admin-kpi-item"><strong>{adminStats.withTicket}</strong><span>Com link de ingresso</span></div>
              <div className="admin-kpi-item"><strong>{adminStats.withPhotos}</strong><span>Com link de fotos</span></div>
              <div className="admin-kpi-item"><strong>{adminStats.totalPhotos}</strong><span>Fotos na galeria</span></div>
            </div>
          </article>

          <article id="admin-site-content" className="admin-panel-card">
            <h3>Conteudo geral do site</h3>
            <p className="about-copy">Edite os campos e clique em Salvar alteracoes para publicar no site.</p>
            <div className="admin-form">
              <div id="admin-experience-hero" className="admin-experience-hero-block">
                <h4 className="admin-subheading">Faixa acima de &quot;Conheca a experiencia Douha&quot; (Home)</h4>
                <p className="about-copy">
                  Imagem larga que fica <strong>no topo</strong> dessa secao, acima do titulo. Deixe vazio para o fundo
                  escuro padrao. Cole uma URL publica ou envie um arquivo (vai para a galeria no Supabase).
                </p>
                <label htmlFor="admin-experience-hero-url">URL da imagem</label>
                <input
                  id="admin-experience-hero-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://..."
                  value={draftSiteContent.experienceHeroImageUrl ?? ''}
                  onChange={(event) => {
                    setExperienceHeroPreviewFailed(false);
                    setDraftSiteContent((prev) => ({
                      ...mergeSiteContentWithDefaults(prev),
                      experienceHeroImageUrl: event.target.value,
                    }));
                  }}
                />
                <label htmlFor="admin-experience-hero-file">Enviar imagem do computador</label>
                <input
                  id="admin-experience-hero-file"
                  type="file"
                  accept="image/*"
                  onChange={onExperienceHeroUpload}
                  disabled={isUploadingExperienceHero}
                />
                {isUploadingExperienceHero && <p className="admin-save-hint" role="status">Enviando imagem...</p>}
                {experienceHeroUploadError && <p className="admin-error">{experienceHeroUploadError}</p>}
                {String(draftSiteContent.experienceHeroImageUrl || '').trim() ? (
                  <div className="admin-experience-hero-preview">
                    <p className="about-copy admin-preview-label">Preview (como na Home)</p>
                    {!experienceHeroPreviewFailed ? (
                      <img
                        src={String(draftSiteContent.experienceHeroImageUrl).trim()}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onLoad={() => setExperienceHeroPreviewFailed(false)}
                        onError={() => setExperienceHeroPreviewFailed(true)}
                      />
                    ) : (
                      <p className="admin-error">
                        Nao foi possivel carregar esta URL. Confira o link, tente outro endereco ou use o upload.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="about-copy admin-muted">Sem imagem: a Home mostra so o fundo escuro nessa faixa.</p>
                )}
              </div>
              <label>Texto principal de Quem Somos</label>
              <textarea
                value={draftSiteContent.whoWeAreText}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, whoWeAreText: event.target.value }))}
              />
              <label>Instagram (Quem Somos)</label>
              <input
                value={draftSiteContent.whoWeAreInstagram}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, whoWeAreInstagram: event.target.value }))}
              />
              <label>Email comercial</label>
              <input
                value={draftSiteContent.contactEmail}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, contactEmail: event.target.value }))}
              />
              <label>WhatsApp comercial (link completo)</label>
              <input
                value={draftSiteContent.contactWhatsApp}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, contactWhatsApp: event.target.value }))}
              />
              <label>Newsletter (titulo)</label>
              <input
                value={draftSiteContent.communityNewsletterLabel}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityNewsletterLabel: event.target.value }))}
              />
              <label>Newsletter (link)</label>
              <input
                value={draftSiteContent.communityNewsletterUrl}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityNewsletterUrl: event.target.value }))}
                placeholder="https://..."
              />
              <label>Comunidade WhatsApp (titulo)</label>
              <input
                value={draftSiteContent.communityWhatsAppLabel}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityWhatsAppLabel: event.target.value }))}
              />
              <label>Comunidade WhatsApp (link)</label>
              <input
                value={draftSiteContent.communityWhatsAppUrl}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityWhatsAppUrl: event.target.value }))}
                placeholder="https://..."
              />
              <label>Comunidade Instagram (titulo)</label>
              <input
                value={draftSiteContent.communityInstagramLabel}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityInstagramLabel: event.target.value }))}
              />
              <label>Comunidade Instagram (link)</label>
              <input
                value={draftSiteContent.communityInstagramUrl}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityInstagramUrl: event.target.value }))}
                placeholder="https://..."
              />
              <label>Instagram (perfil @)</label>
              <input
                value={draftSiteContent.socialInstagramHandle}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialInstagramHandle: event.target.value }))}
              />
              <label>Instagram (link)</label>
              <input
                value={draftSiteContent.socialInstagramUrl}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialInstagramUrl: event.target.value }))}
                placeholder="https://..."
              />
              <label>TikTok (perfil @)</label>
              <input
                value={draftSiteContent.socialTikTokHandle}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialTikTokHandle: event.target.value }))}
              />
              <label>TikTok (link)</label>
              <input
                value={draftSiteContent.socialTikTokUrl}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialTikTokUrl: event.target.value }))}
                placeholder="https://..."
              />
              <label>SoundCloud (perfil @)</label>
              <input
                value={draftSiteContent.socialSoundCloudHandle}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialSoundCloudHandle: event.target.value }))}
              />
              <label>SoundCloud (link)</label>
              <input
                value={draftSiteContent.socialSoundCloudUrl}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialSoundCloudUrl: event.target.value }))}
                placeholder="https://..."
              />
              <label>YouTube (perfil @)</label>
              <input
                value={draftSiteContent.socialYouTubeHandle}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialYouTubeHandle: event.target.value }))}
              />
              <label>YouTube (link)</label>
              <input
                value={draftSiteContent.socialYouTubeUrl}
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialYouTubeUrl: event.target.value }))}
                placeholder="https://..."
              />
              <div className="admin-actions">
                <button type="button" className="pill pill-light" onClick={onSaveSiteContent}>Salvar alteracoes</button>
                <button type="button" className="pill" onClick={onResetSiteContentDraft}>Restaurar textos padrao</button>
              </div>
            </div>
          </article>

          <article id="admin-gallery" className="admin-panel-card">
            <h3>Galeria principal (carrossel do topo + pagina Fotos)</h3>
            <p className="about-copy">
              As fotos daqui alimentam o carrossel inicial do site (topo) e a pagina de Fotos. Esta secao NAO altera a faixa de fotos do bloco pos
              &quot;Conheca a Experiencia Douha&quot;.
            </p>
            <p className="about-copy image-spec-note">{IMAGE_SPEC.gallery}</p>
            <label className="admin-checkbox-row">
              <input
                type="checkbox"
                checked={galleryUploadWide}
                onChange={(e) => {
                  const next = e.target.checked;
                  setGalleryUploadWide(next);
                  galleryUploadWideRef.current = next;
                }}
              />
              <span>
                Proximo envio: <strong>foto larga</strong> (uma imagem ocupa 2 cards no carrossel da home).
              </span>
            </label>
            <input type="file" accept="image/*" multiple onChange={onAdminPhotoUpload} />
            <div className="admin-photo-grid">
              {draftPhotos.map((src, idx) => {
                const parsed = parsePhotoEntry(src);
                const itemClass = `admin-photo-item${
                  parsed.mode === 'double' ? ' admin-photo-item-double' : ''
                }${parsed.mode === 'wide' ? ' admin-photo-item-wide' : ''}`;
                return (
                <figure key={`admin-photo-${idx}-${parsed.primary.slice(0, 16)}`} className={itemClass}>
                  {parsed.mode === 'double' ? (
                    <div className="admin-photo-double-preview">
                      <img src={parsed.primary} alt="" title={IMAGE_SPEC.gallery} />
                      <img src={parsed.secondary} alt="" title={IMAGE_SPEC.gallery} />
                    </div>
                  ) : (
                    <img src={parsed.primary} alt="" title={IMAGE_SPEC.gallery} />
                  )}
                  <figcaption>
                    <button
                      type="button"
                      className="pill"
                      onClick={() => setDraftPhotos((prev) => prev.filter((_, photoIdx) => photoIdx !== idx))}
                    >
                      Remover
                    </button>
                    {parsed.mode === 'wide' ? (
                      <button
                        type="button"
                        className="pill"
                        onClick={() => onMakePhotoSingleCard(idx)}
                      >
                        Usar 1 card
                      </button>
                    ) : null}
                    {parsed.mode === 'double' ? (
                      <button
                        type="button"
                        className="pill"
                        onClick={() => onSplitPhotoDouble(idx)}
                      >
                        Desfazer dupla (legado)
                      </button>
                    ) : null}
                  </figcaption>
                </figure>
                );
              })}
            </div>
            <div className="admin-actions">
              <button type="button" className="pill pill-light" onClick={onSaveGallery} disabled={isSavingGallery}>
                {isSavingGallery ? 'Salvando galeria...' : 'Salvar galeria'}
              </button>
            </div>
          </article>

          <article id="admin-role-photos" className="admin-panel-card">
            <h3>Fotos do role (faixa da home)</h3>
            <p className="about-copy">
              Fluxo simples nesta fase: upload e remocao. Estas fotos aparecem somente na faixa apos &quot;Conheca a Experiencia Douha&quot; e NAO mexem no
              carrossel inicial do topo.
            </p>
            {rolePhotosError ? <p className="admin-error">{rolePhotosError}</p> : null}
            <input type="file" accept="image/*" multiple onChange={onRolePhotoUpload} />
            <div className="admin-photo-grid">
              {draftRolePhotos.map((src, idx) => (
                <figure key={`admin-role-photo-${idx}`} className="admin-photo-item">
                  <img src={src} alt="" />
                  <figcaption>
                    <button
                      type="button"
                      className="pill"
                      onClick={() => setDraftRolePhotos((prev) => prev.filter((_, photoIdx) => photoIdx !== idx))}
                    >
                      Remover
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="admin-actions">
              <button type="button" className="pill pill-light" onClick={onSaveRolePhotos} disabled={isSavingRolePhotos}>
                {isSavingRolePhotos ? 'Salvando fotos do role...' : 'Salvar fotos do role'}
              </button>
            </div>
          </article>

          <article id="admin-editorial" className="admin-panel-card">
            <h3>Materias / Editorial</h3>
            <p className="about-copy">Crie e atualize materias para aparecer no Home e na pagina Editorial.</p>
            {editorialError ? <p className="admin-error">{editorialError}</p> : null}
            <form className="admin-form" onSubmit={onSaveEditorial}>
              <label>Titulo</label>
              <input
                value={draftEditorial.title}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Manchete da materia"
              />
              <label>Deck (resumo curto)</label>
              <textarea
                value={draftEditorial.deck}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, deck: event.target.value }))}
                placeholder="Resumo que aparece nos cards"
              />
              <label>Texto completo (opcional)</label>
              <textarea
                value={draftEditorial.body}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, body: event.target.value }))}
                placeholder="Corpo da materia"
              />
              <label>Fonte</label>
              <input
                value={draftEditorial.source}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, source: event.target.value }))}
                placeholder="Ex: BOLETIM DOUHA"
              />
              <label>Edicao / issue</label>
              <input
                value={draftEditorial.issue}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, issue: event.target.value }))}
                placeholder="Ex: ED. 05"
              />
              <label>Categoria</label>
              <input
                value={draftEditorial.category}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Ex: CULTURA"
              />
              <label>Data (YYYY-MM-DD)</label>
              <input
                value={draftEditorial.date}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, date: event.target.value }))}
                placeholder="2026-05-20"
              />
              <label>URL da imagem de capa (opcional)</label>
              <input
                value={draftEditorial.coverUrl}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, coverUrl: event.target.value }))}
                placeholder="https://..."
              />
              <label className="admin-checkbox-row">
                <input
                  type="checkbox"
                  checked={draftEditorial.isPublished}
                  onChange={(event) => setDraftEditorial((prev) => ({ ...prev, isPublished: event.target.checked }))}
                />
                <span>Publicado no site</span>
              </label>
              <div className="admin-actions">
                <button type="submit" className="pill pill-light" disabled={isSavingEditorial}>
                  {isSavingEditorial ? 'Salvando materia...' : (editingEditorialId ? 'Salvar alteracoes da materia' : 'Adicionar materia')}
                </button>
                <button type="button" className="pill" onClick={resetEditorialDraft}>Limpar formulario</button>
              </div>
            </form>
            <div className="admin-list">
              {(editorialPosts.length ? editorialPosts : defaultEditorialPosts).map((post) => (
                <article key={`admin-editorial-${post.id}`} className="admin-list-item">
                  <div>
                    <strong>{post.title}</strong>
                    <p>{post.source} · {post.issue} · {post.date || 'SEM DATA'}</p>
                  </div>
                  <div className="admin-actions">
                    <button type="button" className="pill" onClick={() => onEditEditorial(post)}>Editar</button>
                    <button type="button" className="pill" onClick={() => onDeleteEditorial(post.id)}>Remover</button>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article id="admin-calendar" className="admin-panel-card">
            <h3>Calendario do Admin</h3>
            <p className="about-copy">Aqui todos os meses ficam ativos. Clique em "Criar evento" no slot livre ou em "Editar" num evento existente.</p>
            <AgendaCalendarSection
              agendaEvents={sortedAgenda}
              title="CALENDARIO INTERNO"
              adminMode
              showEmptySlots
              onEditEvent={onEdit}
              onDeleteEvent={onDelete}
              onCreateEvent={onCreateFromCalendar}
              embedded
            />
          </article>

          <div className="admin-actions">
            <button type="button" className="pill pill-light" onClick={() => onCreateFromCalendar({ year: draftYear, monthIndex: draftMonthIndex })}>
              Novo evento manual
            </button>
            {showEventForm ? (
              <button type="button" className="pill" onClick={() => setShowEventForm(false)}>Fechar formulario</button>
            ) : null}
          </div>

          {showEventForm ? (
            <form id="admin-event-form" ref={formRef} className="admin-form" onSubmit={onSave}>
              <h3>Formulario de evento</h3>
              {agendaSaveError && <p className="admin-error">{agendaSaveError}</p>}
              <label>Data</label>
              <div className="admin-inline admin-date-row">
                <select value={draftDay} onChange={(event) => setDraftDay(Number(event.target.value))}>
                  {Array.from({ length: 31 }).map((_, idx) => {
                    const day = idx + 1;
                    return <option key={`day-${day}`} value={day}>{String(day).padStart(2, '0')}</option>;
                  })}
                </select>
                <select value={draftMonthIndex} onChange={(event) => setDraftMonthIndex(Number(event.target.value))}>
                  {MONTH_LABELS.map((month, idx) => (
                    <option key={`month-${month}`} value={idx}>{month}</option>
                  ))}
                </select>
                <select value={draftYear} onChange={(event) => setDraftYear(Number(event.target.value))}>
                  {adminYearOptions.map((year) => (
                    <option key={`year-${year}`} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <small>Data final que sera salva: {formatAgendaDate(draftDay, draftMonthIndex, draftYear)}</small>
              <label>Horario</label>
              <select value={draft.time || 'A CONFIRMAR'} onChange={(event) => setDraft((prev) => ({ ...prev, time: event.target.value }))}>
                {timeOptions.map((timeOption) => (
                  <option key={`time-option-${timeOption}`} value={timeOption}>{timeOption}</option>
                ))}
              </select>
              <label>Lineup / Artistas</label>
              <textarea value={draft.lineup} onChange={(event) => setDraft((prev) => ({ ...prev, lineup: event.target.value }))} placeholder="Ex: SYON TRIO, CONVIDADO X" />
              <label>Link do ingresso</label>
              <input value={draft.ticketUrl} onChange={(event) => setDraft((prev) => ({ ...prev, ticketUrl: event.target.value }))} placeholder="https://..." />
              <label>Link das fotos (Drive)</label>
              <small className="about-copy image-spec-note">
                No site publico, esse link so aparece 48 horas depois do fim do dia do evento (ate la continua o link de ingresso).
              </small>
              <input value={draft.photosUrl} onChange={(event) => setDraft((prev) => ({ ...prev, photosUrl: event.target.value }))} placeholder="https://drive.google.com/..." />

              <label>Poster (upload local)</label>
              <p className="about-copy image-spec-note">{IMAGE_SPEC.agendaPoster}</p>
              <input type="file" accept="image/*" onChange={onPosterUpload} />
              <label>Ou URL da imagem</label>
              <div className="admin-inline">
                <input value={posterUrlInput} onChange={(event) => setPosterUrlInput(event.target.value)} placeholder="/events/meu-poster.png ou https://..." />
                <button type="button" className="pill" onClick={onUsePosterUrl}>Usar URL</button>
                <button type="button" className="pill" onClick={onClearPoster}>Remover poster</button>
              </div>
              {isUploadingPoster ? <small>Enviando poster para o Supabase Storage...</small> : null}
              {posterUploadInfo ? <small>{posterUploadInfo}</small> : null}
              {posterUploadError ? <p className="admin-error">{posterUploadError}</p> : null}

              {draft.poster && (
                <figure className="admin-poster-preview">
                  <img src={draft.poster} alt="Preview do poster no admin" title={IMAGE_SPEC.agendaPoster} />
                </figure>
              )}

              <div className="admin-actions">
                <button type="submit" className="pill pill-light" disabled={isSavingEvent || isUploadingPoster}>
                  {isUploadingPoster
                    ? 'Aguardando upload do poster...'
                    : isSavingEvent
                      ? 'Salvando...'
                      : (editingId ? 'Salvar alteracoes' : 'Adicionar evento')}
                </button>
                <button type="button" className="pill" onClick={resetDraft}>Limpar formulario</button>
              </div>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [agendaEvents, setAgendaEvents] = useState(() => [...defaultAgenda]);
  const [sitePhotos, setSitePhotos] = useState(() => loadStoredPhotos());
  const [rolePhotos, setRolePhotos] = useState(() => loadStoredRolePhotos());
  const [editorialPosts, setEditorialPosts] = useState(() => [...defaultEditorialPosts]);
  const [siteContent, setSiteContent] = useState(() => mergeSiteContentWithDefaults(loadStoredSiteContent()));
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => localStorage.getItem(ADMIN_AUTH_KEY) === 'ok');
  const [calendarFocus, setCalendarFocus] = useState(null);
  const [agendaSyncError, setAgendaSyncError] = useState('');

  useEffect(() => {
    let active = true;

    const loadAgendaFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setAgendaSyncError(
          supabaseConfigError
            ? `Configuracao Supabase invalida: ${supabaseConfigError}`
            : 'Supabase nao configurado. Usando agenda padrao.',
        );
        return;
      }
      try {
        const firstAttempt = await supabase
          .from(SUPABASE_EVENTS_TABLE)
          .select('id, date, time, lineup, poster, ticket_url, photos_url, created_at')
          .order('created_at', { ascending: true });
        let rowsData = firstAttempt.data;
        if (firstAttempt.error && isMissingPhotosUrlColumnError(firstAttempt.error.message)) {
          const fallback = await supabase
            .from(SUPABASE_EVENTS_TABLE)
            .select('id, date, time, lineup, poster, ticket_url, created_at')
            .order('created_at', { ascending: true });
          if (fallback.error) throw fallback.error;
          rowsData = (fallback.data || []).map((row) => ({ ...row, photos_url: '' }));
          if (active) {
            setAgendaSyncError(
              'Banco sem coluna photos_url. Agenda carregada em modo compatibilidade. Rode: supabase/migrations/001_douha_events_photos_url.sql',
            );
          }
        } else if (firstAttempt.error) {
          throw firstAttempt.error;
        }
        if (!active) return;
        const mapped = Array.isArray(rowsData) ? rowsData.map((row, idx) => mapDbEventToAgendaItem(row, idx)) : [];
        setAgendaEvents(mapped.length ? mapped : [...defaultAgenda]);
        if (!firstAttempt.error) setAgendaSyncError('');
      } catch (error) {
        if (!active) return;
        setAgendaSyncError(`Supabase indisponivel agora. Exibindo agenda padrao temporaria. Detalhe: ${error.message || 'erro desconhecido'}`);
      }
    };

    loadAgendaFromSupabase();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    const loadEditorialFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const { data, error } = await supabase
          .from(SUPABASE_EDITORIAL_TABLE)
          .select('id, title, deck, body, source, issue, category, cover_url, published_at, is_published, position')
          .order('position', { ascending: true });
        if (error) throw error;
        if (!active) return;
        const mapped = Array.isArray(data) ? data.map((row, idx) => mapDbEditorialPostToItem(row, idx)) : [];
        if (mapped.length) setEditorialPosts(mapped);
      } catch (error) {
        if (!active) return;
        const msg = isMissingEditorialTableError(error.message)
          ? 'Tabela douha_editorial_posts ausente no Supabase (rode a migration 002).'
          : `Nao foi possivel carregar materias do Supabase: ${error.message || error}`;
        console.warn(msg);
      }
    };

    loadEditorialFromSupabase();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    const loadRolePhotosFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const { data, error } = await supabase
          .from(SUPABASE_ROLE_PHOTOS_TABLE)
          .select('photo_url, position')
          .order('position', { ascending: true });
        if (error) throw error;
        if (!active) return;
        const rows = Array.isArray(data) ? data : [];
        const normalized = rows
          .map((row) => String(row.photo_url || '').trim())
          .filter(Boolean);
        if (!normalized.length) return;
        setRolePhotos(normalized);
        safeSetLocalStorage(ROLE_PHOTOS_STORAGE_KEY, JSON.stringify(normalized));
      } catch (error) {
        if (!active) return;
        const msg = isMissingRolePhotosTableError(error.message)
          ? 'Tabela douha_role_photos ausente no Supabase (rode a migration 002).'
          : `Nao foi possivel carregar fotos do role no Supabase: ${error.message || error}`;
        console.warn(msg);
      }
    };

    loadRolePhotosFromSupabase();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    const loadGalleryFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const { data, error } = await supabase
          .from(SUPABASE_GALLERY_TABLE)
          .select('photo_url, position')
          .order('position', { ascending: true });
        if (error) throw error;
        if (!active) return;
        const rows = Array.isArray(data) ? data : [];
        if (!rows.length) return;
        const normalized = rows
          .map((row) => String(row.photo_url || '').trim())
          .filter(Boolean);
        setSitePhotos(normalized);
        safeSetLocalStorage(PHOTOS_STORAGE_KEY, JSON.stringify(normalized));
      } catch (error) {
        if (!active) return;
        const msg = isMissingGalleryTableError(error.message)
          ? 'Tabela douha_site_photos ausente no Supabase (rode o SQL de setup).'
          : `Nao foi possivel carregar galeria do Supabase: ${error.message || error}`;
        console.warn(msg);
      }
    };

    loadGalleryFromSupabase();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    safeSetLocalStorage(PHOTOS_STORAGE_KEY, JSON.stringify(sitePhotos));
  }, [sitePhotos]);

  useEffect(() => {
    safeSetLocalStorage(ROLE_PHOTOS_STORAGE_KEY, JSON.stringify(rolePhotos));
  }, [rolePhotos]);

  useEffect(() => {
    safeSetLocalStorage(SITE_CONTENT_STORAGE_KEY, JSON.stringify(siteContent));
  }, [siteContent]);

  useEffect(() => {
    if (isAdminLoggedIn) safeSetLocalStorage(ADMIN_AUTH_KEY, 'ok');
    else safeRemoveLocalStorage(ADMIN_AUTH_KEY);
  }, [isAdminLoggedIn]);

  const onResetAgenda = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: deleteError } = await supabase.from(SUPABASE_EVENTS_TABLE).delete().neq('id', '');
        if (deleteError) throw deleteError;
        const payload = defaultAgenda.map((item) => mapAgendaItemToDbEvent(item));
        const insertAttempt = await supabase.from(SUPABASE_EVENTS_TABLE).upsert(payload, { onConflict: 'id' });
        if (insertAttempt.error && isMissingPhotosUrlColumnError(insertAttempt.error.message)) {
          const legacyPayload = payload.map((item) => {
            const copy = { ...item };
            delete copy.photos_url;
            return copy;
          });
          const retry = await supabase.from(SUPABASE_EVENTS_TABLE).upsert(legacyPayload, { onConflict: 'id' });
          if (retry.error) throw retry.error;
        } else if (insertAttempt.error) {
          throw insertAttempt.error;
        }
      }
      setAgendaEvents(defaultAgenda);
      setAgendaSyncError('');
    } catch (error) {
      setAgendaSyncError(`Nao foi possivel restaurar no Supabase: ${error.message || 'erro desconhecido'}`);
    }
  };

  const onAdminLogout = () => {
    setIsAdminLoggedIn(false);
  };

  return (
    <BrowserRouter>
      <AppShell isAdminLoggedIn={isAdminLoggedIn} onAdminLogout={onAdminLogout} siteContent={siteContent}>
        <Routes>
          <Route
            path="/"
            element={(
              <HomePage
                agendaEvents={agendaEvents}
                sitePhotos={sitePhotos}
                rolePhotos={rolePhotos}
                editorialPosts={editorialPosts}
                calendarFocus={calendarFocus}
                onFocusConsumed={() => setCalendarFocus(null)}
                siteContent={siteContent}
              />
            )}
          />
          <Route path="/quem-somos" element={<QuemSomosPage siteContent={siteContent} />} />
          <Route
            path="/agenda"
            element={<AgendaPage agendaEvents={agendaEvents} calendarFocus={calendarFocus} onFocusConsumed={() => setCalendarFocus(null)} />}
          />
          <Route
            path="/calendario"
            element={<AgendaPage agendaEvents={agendaEvents} calendarFocus={calendarFocus} onFocusConsumed={() => setCalendarFocus(null)} />}
          />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/fotos" element={<FotosPage sitePhotos={sitePhotos} setSitePhotos={setSitePhotos} isAdminLoggedIn={isAdminLoggedIn} />} />
          <Route path="/sets" element={<SetsPage />} />
          <Route path="/editorial" element={<EditorialPage editorialPosts={editorialPosts} />} />
          <Route path="/contato" element={<ContactPage siteContent={siteContent} />} />
          <Route
            path="/admin"
            element={(
              <AdminPage
                agendaEvents={agendaEvents}
                setAgendaEvents={setAgendaEvents}
                onResetAgenda={onResetAgenda}
                isAdminLoggedIn={isAdminLoggedIn}
                setIsAdminLoggedIn={setIsAdminLoggedIn}
                sitePhotos={sitePhotos}
                setSitePhotos={setSitePhotos}
                rolePhotos={rolePhotos}
                setRolePhotos={setRolePhotos}
                editorialPosts={editorialPosts}
                setEditorialPosts={setEditorialPosts}
                siteContent={siteContent}
                setSiteContent={setSiteContent}
                onEventSavedFocus={(focus) => setCalendarFocus(focus)}
                agendaSyncError={agendaSyncError}
                supabaseSetupError={
                  !isSupabaseConfigured && supabaseConfigError
                    ? `Revise o .env do Douha: ${supabaseConfigError}`
                    : ''
                }
              />
            )}
          />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

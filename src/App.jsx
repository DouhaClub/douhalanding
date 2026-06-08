import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, NavLink, Routes, Route, Link, Navigate, useParams, useLocation } from 'react-router-dom';
import {
  formatSupabaseStorageUploadError,
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from './lib/supabaseClient';
import {
  fetchLatestYouTubeVideosResilient,
  fetchYoutubeChannelBrandingResilient,
  isLikelyYoutubeChannelId,
  normalizeYoutubeApiKey,
  normalizeYoutubeChannelEnv,
  resolveYoutubeChannelWebUrl,
} from './lib/youtubeApi';
import { Analytics } from './components/Analytics';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { DocumentMeta } from './components/DocumentMeta';
import { SiteFavicon } from './components/SiteFavicon';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { ReservasPage } from './pages/ReservasPage';
import { AdminReservasPanel } from './components/AdminReservasPanel';
import {
  isMissingReservationColumnsError,
  mapAgendaReservationFieldsToDb,
  mapDbEventReservationFields,
  normalizeReservationLayout,
} from './lib/reservations';
import {
  formatAdminAuthError,
  getAdminSession,
  signInDouhaAdmin,
  signOutDouhaAdmin,
  subscribeAdminAuth,
} from './lib/adminAuth';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { buildEditorialArticleMeta } from './lib/siteMeta';
import {
  editorialAuthorInitial,
  estimateEditorialReadingMinutes,
  formatEditorialArticleDate,
  formatEditorialReadingLabel,
  formatEditorialRelativeUpdate,
  buildEditorialBylinePreview,
} from './lib/editorialReading';
import { hasAcceptedOptionalStorage } from './lib/consentStorage';
import { registerServiceWorkerIfAccepted } from './lib/registerServiceWorker';

const CALENDAR_FOCUS_KEY = 'douha_calendar_focus_v1';
const PHOTOS_STORAGE_KEY = 'douha_site_photos_v1';
const ROLE_PHOTOS_STORAGE_KEY = 'douha_role_photos_v2';
const ROLE_PHOTOS_LEGACY_KEY = 'douha_role_photos_v1';
const SITE_CONTENT_STORAGE_KEY = 'douha_site_content_v1';

/** Fotos do role: so URL; no site todas em celula 3:4 (uploads 3:4 ou 4:3 com object-fit cover). */
function normalizeRolePhotoEntry(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const url = raw.trim();
    return url ? { url } : null;
  }
  if (typeof raw === 'object') {
    const url = String(raw.url || '').trim();
    return url ? { url } : null;
  }
  return null;
}

function rolePhotoEntryUrl(entry) {
  const n = normalizeRolePhotoEntry(entry);
  return n ? n.url : '';
}
/** Agenda vem do Supabase; sem fallback fake no codigo. */
const defaultAgenda = [];

const editorial = [
  {
    source: 'BOLETIM DOUHA',
    issue: 'ED. 01',
    date: 'ABR 2026',
    category: 'AGENDA',
    coverUrl: '/brand/elements/01.png',
    title: 'Abertura oficial da temporada e nova fase editorial do clube',
    deck: 'Resumo semanal com agenda, bastidores e curadoria para quem acompanha o movimento desde o início.',
  },
  {
    source: 'REPORTAGEM',
    issue: 'ED. 02',
    date: 'ABR 2026',
    category: 'CENA',
    coverUrl: '/brand/elements/02.png',
    title: 'Como a pista conversa com moda, arte e comportamento noturno',
    deck: 'Leitura de cena com foco em artistas residentes, convidados e referências que moldam a experiência Douha.',
  },
  {
    source: 'NEWSLETTER',
    issue: 'ED. 03',
    date: 'MAI 2026',
    category: 'GUIA',
    coverUrl: '/brand/elements/03.png',
    title: 'Guia de próximas datas, links oficiais e cobertura pós-evento',
    deck: 'O que abre, o que muda e onde acessar ingressos, fotos e conteúdo completo em um único lugar.',
  },
  {
    source: 'CULTURA',
    issue: 'ED. 04',
    date: 'MAI 2026',
    category: 'CULTURA',
    coverUrl: '/brand/elements/04.png',
    title: 'Rockstar, label culture e o novo ciclo criativo das pistas',
    deck: 'Panorama rápido sobre referências globais que influenciam a narrativa visual e sonora do clube.',
  },
];

/** Subtexto (deck) nos cards da Home — limite para caber inteiro no bloco. */
const EDITORIAL_HOME_DECK_MAX_LENGTH = 90;

function clampEditorialDeck(value) {
  return String(value ?? '').slice(0, EDITORIAL_HOME_DECK_MAX_LENGTH);
}

const defaultEditorialPosts = editorial.map((item, idx) => ({
  id: `editorial-${idx + 1}`,
  source: String(item.source || 'DOUHA CLUB'),
  issue: String(item.issue || ''),
  date: String(item.daté || ''),
  title: String(item.title || ''),
  deck: clampEditorialDeck(item.deck),
  body: '',
  category: String(item.category || ''),
  coverUrl: String(item.coverUrl || ''),
  sources: [],
  authorName: '',
  authorAvatarUrl: '',
  updatedAt: null,
  publishedAt: null,
  isPublished: true,
  position: idx,
}));

/** Canal oficial no YouTube (sem @ publico — so /channel/UC...). */
const youtubeChannelUrl = 'https://www.youtube.com/channel/UCOzUfp-FC2acGvWiCijckbA';
const YOUTUBE_API_KEY = normalizeYoutubeApiKey(import.meta.env.VITE_YOUTUBE_API_KEY);
const YOUTUBE_CHANNEL_ID = normalizeYoutubeChannelEnv(import.meta.env.VITE_YOUTUBE_CHANNEL_ID);
/** Videos: API + canal, ou so ID UC... (RSS no dev via proxy Vite). */
const CAN_LOAD_YOUTUBE_FEED = Boolean(YOUTUBE_CHANNEL_ID)
  && (Boolean(YOUTUBE_API_KEY) || isLikelyYoutubeChannelId(YOUTUBE_CHANNEL_ID));
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

/** Vindos do canal primeiro; `tracks` so completa a lista se faltar item (sem chamadas extras a API). */
function mergeYoutubeFeedWithPlaceholders(live, placeholders, maxCount) {
  const cap = Math.min(50, Math.max(1, Number(maxCount) || 12));
  const seen = new Set();
  const out = [];
  const add = (item) => {
    const id = item?.videoId;
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(item);
  };
  for (const item of live || []) {
    add(item);
    if (out.length >= cap) return out;
  }
  for (const item of placeholders || []) {
    add(item);
    if (out.length >= cap) break;
  }
  return out;
}

const gallery = ['/brand/elements/01.png', '/brand/elements/02.png', '/brand/elements/03.png', '/brand/elements/05.png'];
const MONTH_LABELS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const CALENDAR_CARDS_PER_ROW = 4;
const MAX_EVENTS_PER_MONTH = 8;

function countAgendaEventsInMonth(agendaEvents, year, monthIndex, excludeId = '') {
  const yearKey = String(year);
  return agendaEvents.filter((item) => {
    if (excludeId && item.id === excludeId) return false;
    const parsed = parseAgendaDateParts(item.date);
    return parsed && String(parsed.year) === yearKey && parsed.monthIndex === monthIndex;
  }).length;
}

function describeCalendarSlot(slotIndex) {
  const slotNum = slotIndex + 1;
  const row = slotIndex < CALENDAR_CARDS_PER_ROW ? 1 : 2;
  return { slotNum, row };
}
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
const SUPABASE_SITE_CONTENT_TABLE = 'douha_site_content';
const SUPABASE_SITE_CONTENT_ROW_ID = 'default';
const DOUBLE_PHOTO_PREFIX = 'double::';
/** Uma imagem so, largura de 2 cards no carrossel (marcado no upload no admin) */
const WIDE_PHOTO_PREFIX = 'wide::';
const POSTER_MAX_BYTES = 2 * 1024 * 1024;
const POSTER_MAX_LABEL = '2 MB';

const WHO_WE_ARE_TEXT =
  'O Douha Club é o ponto de encontro onde a curadoria musical refinada encontra a natureza. Localizado em Maringá no Paraná, somos um espaço criado por quem realmente se conecta com a música para entregar noites que fogem do óbvio. Muito além de um club, somos um refúgio para quem busca conexão real, intensidade e momentos memoráveis ao som dos melhores DJs do Brasil e do mundo. Aqui, cada batida é uma experiência.';

const LEGACY_WHO_WE_ARE_MARKERS = [
  'inspirado no estilo',
  'tropical noir',
  'narrativa editorial para criar experiências de pista',
];

function resolveWhoWeAreText(value) {
  const text = String(value || '').trim();
  if (!text) return WHO_WE_ARE_TEXT;
  const lower = text.toLowerCase();
  if (LEGACY_WHO_WE_ARE_MARKERS.some((marker) => lower.includes(marker))) return WHO_WE_ARE_TEXT;
  return text;
}

const defaultSiteContent = {
  whoWeAreText: WHO_WE_ARE_TEXT,
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
  socialYouTubeHandle: 'Douha',
  socialYouTubeUrl: 'https://www.youtube.com/channel/UCOzUfp-FC2acGvWiCijckbA',
  /** URL da faixa visual acima de "Conheça a experiência Douha" na Home (vazio = fundo padrão) */
  experienceHeroImageUrl: '',
  /** Textura/fundo da faixa amarela "Conheça a experiência" (2º plano; texto por cima) */
  experienceCopyBannerBgUrl: '',
  /** Textura/fundo da faixa amarela Sets (2º plano; texto por cima) */
  setsBannerBgUrl: '',
  /** Textura/fundo da faixa diagonal de fotos do role (2º plano; cards FOTO por cima) */
  rolePhotosStageBgUrl: '',
  /** Logo centralizada no rodapé (vazio = sem bloco extra no footer) */
  footerLogoUrl: '',
  /** Mosaico fixo da página /editorial — IDs de douha_editorial_posts */
  editorialMosaicLeadId: '',
  editorialMosaicSide1Id: '',
  editorialMosaicSide2Id: '',
};

/** Medidas de exportacao das faixas amarelas (largura x altura em px). */
const YELLOW_BANNER_PX = {
  experienceCopy: { width: 1920, height: 220 },
  sets: { width: 1920, height: 150 },
};

/** Faixa diagonal de fotos do role (fundo atras dos cards). */
const ROLE_PHOTOS_STAGE_PX = { width: 1920, height: 760 };

/** Logo do rodapé (emblema circular). */
const FOOTER_LOGO_PX = { size: 400 };

function footerLogoImageClassName(url) {
  const value = String(url || '').trim();
  if (/\.jpe?g($|[?#])/i.test(value)) return 'footer-logo-img footer-logo-img--lift-black';
  return 'footer-logo-img';
}

/** Camada de arte da faixa (proporção fixa; não usa cover para não esticar/cortar). */
function YellowStripBg({ imageUrl }) {
  const url = String(imageUrl || '').trim();
  if (!url) return null;
  return (
    <img
      className="douha-yellow-strip__bg"
      src={url}
      alt=""
      aria-hidden="true"
      decoding="async"
      loading="lazy"
      draggable={false}
    />
  );
}

function yellowStripClassName(baseClassName, imageUrl) {
  const url = String(imageUrl || '').trim();
  return url ? `${baseClassName} douha-yellow-strip douha-yellow-strip--has-bg` : `${baseClassName} douha-yellow-strip`;
}

function buildRoleStageBgProps(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url) return { className: 'people-role-photos-stage' };
  const safe = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return {
    className: 'people-role-photos-stage role-stage--has-bg',
    style: { '--role-stage-bg-url': `url("${safe}")` },
  };
}

const DOUHA_GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/douha+club/data=!4m2!3m1!1s0x94ecd3004c83b51d:0x5e4a68fcd0274d1?sa=X&ved=1t:242&ictx=111';

const faq = [
  {
    q: 'Como compro ingresso para um evento?',
    a: 'Vá em Calendário, selecione o mês e clique no poster do role. Se houver venda aberta, aparece a opção de ingresso e você é levado para a plataforma oficial daquele evento (Sympla, Ingresso Nacional, etc.).',
  },
  {
    q: 'Como funciona o Members Club?',
    paragraphs: [
      'O Members Club é o espaço exclusivo do Douha para quem quer viver a experiência antes de todo mundo.',
      'Participando, você recebe acesso antecipado a line-up e as novidades, pode fazer reservas de mesas e camarotes um dia antes da abertura geral, participa de enquetes que ajudam a definir o role, além de concorrer a sorteios e receber descontos exclusivos.',
      'Ou seja: sua opinião entra no jogo, e você fica sempre um passo à frente.',
    ],
  },
  {
    q: 'Onde estamos localizados?',
    a: 'Estamos localizados na Rodovia Deputado Silvio Barros, 6175.',
    link: { href: DOUHA_GOOGLE_MAPS_URL, label: 'Ver no Google Maps' },
  },
  {
    q: 'Vocês possuem estacionamento?',
    a: 'Sim, temos estacionamento (pago) e pontos de retirada de uber, taxis e afins.',
  },
  {
    q: 'O que é proibido no dress code?',
    a: 'Itens não permitidos:',
    list: [
      'Correntes muito grossas',
      'Camiseta de Time',
      'Camiseta Polo',
      'Bermuda Tactel',
      'Chinelo/Crocs',
      'Regata',
    ],
  },
  {
    q: 'Bar e Cozinha',
    paragraphs: [
      'Garantimos um bar completo, pronto para agradar qualquer paladar.',
      'E se bater aquela fome, fique à vontade e aproveite o Douha Pub! Temos diversos sabores de pizzas pra te salvar da larica.',
    ],
  },
  {
    q: 'Como exercer meus direitos na LGPD?',
    a: 'Mande um e-mail para o contato comercial dizendo o que precisa: saber se tratamos seus dados, corrigir informação, pedir exclusão ou revogar consentimento de cache/analytics. Respondemos em prazo razoável, conforme a lei.',
  },
];

/** Referencia de tamanho para exportar arquivos (alinha com o layout do site) */
const IMAGE_SPEC = {
  agendaPoster: `Tamanho sugerido para poster na agenda: 1080×1620 px (proporção 2:3, retrato). Tamanho máximo recomendado: ${POSTER_MAX_LABEL}.`,
  gallery:
    'Tamanho sugerido para galeria: largura mínima 1200 px; proporção livre (imagem inteira). Foto larga: panoramas ou banners largos ocupam 2 colunas no carrossel.',
  experienceCopyBanner: `Faixa amarela "Conheça a experiência": ${YELLOW_BANNER_PX.experienceCopy.width}×${YELLOW_BANNER_PX.experienceCopy.height} px (paisagem). Exporte nessa proporção; o texto vai na própria imagem.`,
  setsBanner: `Faixa amarela Sets: ${YELLOW_BANNER_PX.sets.width}×${YELLOW_BANNER_PX.sets.height} px (paisagem). Exporte com o texto já na imagem (o site não sobrepõe copy HTML).`,
  rolePhotosStage: `Fundo da faixa de fotos do role: ${ROLE_PHOTOS_STAGE_PX.width}×${ROLE_PHOTOS_STAGE_PX.height} px (paisagem). Exporte nessa proporção; cards FOTO ficam por cima.`,
  footerLogo: `Logo do rodapé: ${FOOTER_LOGO_PX.size}×${FOOTER_LOGO_PX.size} px (quadrado 1:1). Use PNG com fundo transparente (obrigatório para não aparecer quadrado preto).`,
  editorialCover:
    'Capa editorial (mosaico): 1600×1200 px ou maior, paisagem (4:3). Aparece no site somente nas 3 posições do mosaico; acervo fica sem imagem até a página da matéria.',
};

function normalizeAgendaItem(item, idx = 0) {
  return {
    id: String(item?.id || `event-${idx + 1}`),
    date: String(item?.daté || ''),
    time: String(item?.time || ''),
    lineup: String(item?.lineup || ''),
    poster: String(item?.poster || ''),
    ticketUrl: String(item?.ticketUrl || ''),
    photosUrl: String(item?.photosUrl || ''),
    reservationsEnabled: Boolean(item?.reservationsEnabled),
    reservationLayout: normalizeReservationLayout(item?.reservationLayout),
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
      ...mapDbEventReservationFields(row),
    },
    idx,
  );
}

function mapAgendaItemToDbEvent(item) {
  return {
    id: String(item.id),
    date: String(item.daté || ''),
    time: String(item.time || ''),
    lineup: String(item.lineup || ''),
    poster: String(item.poster || ''),
    ticket_url: String(item.ticketUrl || ''),
    photos_url: String(item.photosUrl || ''),
    ...mapAgendaReservationFieldsToDb(item),
  };
}

function isMissingPhotosUrlColumnError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('photos_url') && text.includes('does not exist');
}

function formatSupabaseAgendaSaveError(error) {
  const detail = String(error?.message || 'erro desconhecido');
  let msg = `Não foi possível salvar no Supabase: ${detail}`;
  if (/photos_url/i.test(detail)) {
    msg += ' Rode no SQL Editor o arquivo supabase/migrations/001_douha_events_photos_url.sql (adiciona a coluna no banco que já existia).';
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
    const parseList = (raw) => {
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const list = parsed.map(normalizeRolePhotoEntry).filter(Boolean);
      return list.length ? list : null;
    };
    const v2 = parseList(localStorage.getItem(ROLE_PHOTOS_STORAGE_KEY));
    if (v2) return v2;
    const legacy = parseList(localStorage.getItem(ROLE_PHOTOS_LEGACY_KEY));
    return legacy || [];
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

function isMissingEditorialSourcesColumnError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('sources') && (text.includes('column') || text.includes('schema cache'));
}

function isMissingRolePhotosTableError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes("could not find the table 'public.douha_role_photos'")
    || text.includes('douha_role_photos')
    || text.includes('schema cache');
}

function isMissingSiteContentTableError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes("could not find the table 'public.douha_site_content'")
    || text.includes('douha_site_content')
    || text.includes('schema cache');
}

function parseEditorialSourcesBulk(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const items = [];
  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s<>"']+/i);
    if (!urlMatch) {
      if (line) items.push({ label: line, url: '' });
      continue;
    }
    const url = urlMatch[0].replace(/[.,;:!?)]+$/, '');
    let label = line.replace(urlMatch[0], '').trim();
    label = label.replace(/^[-–—|•]\s*/, '').replace(/\s*[-–—|]\s*$/, '').trim();
    items.push({ label: label || url, url });
  }
  return items;
}

function normalizeEditorialSourcesList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => ({
        label: String(item?.label || '').trim(),
        url: String(item?.url || '').trim(),
      }))
      .filter((item) => item.label || item.url);
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return [];
    if (value.startsWith('[')) {
      try {
        return normalizeEditorialSourcesList(JSON.parse(value));
      } catch {
        return parseEditorialSourcesBulk(value);
      }
    }
    return parseEditorialSourcesBulk(value);
  }
  return [];
}

function serializeEditorialSourcesForDb(sources) {
  return JSON.stringify(normalizeEditorialSourcesList(sources));
}

function normalizeEditorialItem(item, idx = 0) {
  return {
    id: String(item?.id || `editorial-${idx + 1}`),
    title: String(item?.title || ''),
    deck: clampEditorialDeck(item?.deck),
    body: String(item?.body || ''),
    sources: normalizeEditorialSourcesList(item?.sources),
    source: String(item?.source || 'DOUHA CLUB'),
    issue: String(item?.issue || ''),
    category: String(item?.category || ''),
    coverUrl: String(item?.coverUrl || ''),
    date: String(item?.daté || item?.publishedAt || ''),
    publishedAt: item?.publishedAt || null,
    authorName: String(item?.authorName || item?.author_name || ''),
    authorAvatarUrl: String(item?.authorAvatarUrl || item?.author_avatar_url || ''),
    updatedAt: item?.updatedAt || item?.updated_at || null,
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
      sources: row?.sources,
      source: row?.source,
      issue: row?.issue,
      category: row?.category,
      coverUrl: row?.cover_url,
      publishedAt: publishedAtRaw || null,
      date: publishedAtRaw ? publishedAtRaw.slice(0, 10) : '',
      authorName: row?.author_name,
      authorAvatarUrl: row?.author_avatar_url,
      updatedAt: row?.updated_at ? String(row.updated_at) : null,
      isPublished: row?.is_published,
      position: row?.position,
    },
    idx,
  );
}

function mapEditorialItemToDbPost(item) {
  const publishRaw = String(item?.publishedAt || item?.daté || '').trim();
  return {
    id: String(item.id),
    title: String(item.title || ''),
    deck: String(item.deck || ''),
    body: String(item.body || ''),
    sources: serializeEditorialSourcesForDb(item.sources),
    source: String(item.source || 'DOUHA CLUB'),
    issue: String(item.issue || ''),
    category: String(item.category || ''),
    cover_url: String(item.coverUrl || ''),
    published_at: publishRaw ? publishRaw : null,
    author_name: String(item.authorName || ''),
    author_avatar_url: String(item.authorAvatarUrl || ''),
    updated_at: new Date().toISOString(),
    is_published: item.isPublished !== false,
    position: Number.isFinite(Number(item.position)) ? Number(item.position) : 0,
  };
}

/**
 * Garante link absoluto do WhatsApp (wa.me). Valores como "whatsapp", "/wpp" ou "5511..."
 * viram path no próprio site e geram 404 — aqui sempre https://wa.me/...
 */
function normalizeWhatsAppUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    const https = raw.replace(/^http:\/\//i, 'https://');
    if (/wa\.me|api\.whatsapp\.com/i.test(https)) return https;
  }

  const withoutScheme = raw.replace(/^https?:\/\//i, '');
  if (/^(wa\.me|api\.whatsapp\.com)\//i.test(withoutScheme)) {
    return `https://${withoutScheme}`;
  }

  const waInText = withoutScheme.match(/wa\.me\/(\d{10,15})/i);
  if (waInText) return `https://wa.me/${waInText[1]}`;

  const digits = raw.replace(/\D/g, '');
  const looksLikePhone = /^[\d\s()+\-./]+$/.test(raw) && digits.length >= 10 && digits.length <= 15;
  if (looksLikePhone) return `https://wa.me/${digits}`;

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    if (digits.length >= 10) return `https://wa.me/${digits}`;
    return '';
  }

  if (!raw.includes('.') && !raw.includes(':')) {
    if (digits.length >= 10) return `https://wa.me/${digits}`;
    return '';
  }

  return '';
}

/** Garante todos os campos (ex.: experienceHero) mesmo se o estado vier incompleto. */
function mergeSiteContentWithDefaults(partial) {
  const base = { ...defaultSiteContent };
  if (!partial || typeof partial !== 'object') return base;
  const out = { ...base, ...partial };
  for (const key of Object.keys(base)) {
    if (out[key] === undefined) out[key] = base[key];
  }
  out.contactWhatsApp = normalizeWhatsAppUrl(out.contactWhatsApp) || base.contactWhatsApp;
  out.communityWhatsAppUrl = normalizeWhatsAppUrl(out.communityWhatsAppUrl) || base.communityWhatsAppUrl;
  out.whoWeAreText = resolveWhoWeAreText(out.whoWeAreText);
  return out;
}

function loadStoredSiteContent() {
  try {
    const raw = localStorage.getItem(SITE_CONTENT_STORAGE_KEY);
    if (!raw) return { ...defaultSiteContent };
    const parsed = JSON.parse(raw);
    return mergeSiteContentWithDefaults(parsed && typeof parsed === 'object' ? parsed : {});
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

/** Mes/ano do calendário mais perto de hoje que tenha eventos (prioriza mês atual). */
function findDefaultCalendarMonthWithEvents(agendaEvents, now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayIndex = currentYear * 12 + currentMonth;

  const monthsWithEvents = new Map();
  for (const item of agendaEvents) {
    const parsed = parseAgendaDateParts(item.date);
    if (!parsed) continue;
    const key = `${parsed.year}-${parsed.monthIndex}`;
    if (!monthsWithEvents.has(key)) monthsWithEvents.set(key, parsed);
  }
  if (!monthsWithEvents.size) return null;

  if (monthsWithEvents.has(`${currentYear}-${currentMonth}`)) {
    return { year: String(currentYear), monthIndex: currentMonth };
  }

  let best = null;
  let bestScore = Infinity;
  for (const parsed of monthsWithEvents.values()) {
    const monthIndexLinear = parsed.year * 12 + parsed.monthIndex;
    const distance = Math.abs(monthIndexLinear - todayIndex);
    const pastPenalty = monthIndexLinear < todayIndex ? 0.45 : 0;
    const score = distance + pastPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = { year: String(parsed.year), monthIndex: parsed.monthIndex };
    }
  }
  return best;
}

/** Ordem do calendario: dia do evento (crescente), depois horário. */
function compareAgendaEventsByDate(a, b) {
  const pa = parseAgendaDateParts(a?.date);
  const pb = parseAgendaDateParts(b?.date);
  if (!pa && !pb) return String(a?.id || '').localeCompare(String(b?.id || ''));
  if (!pa) return 1;
  if (!pb) return -1;
  if (pa.year !== pb.year) return pa.year - pb.year;
  if (pa.monthIndex !== pb.monthIndex) return pa.monthIndex - pb.monthIndex;
  if (pa.day !== pb.day) return pa.day - pb.day;
  return String(a?.time || '').trim().localeCompare(String(b?.time || '').trim(), 'pt-BR');
}

function getRollingCalendarYears(now = new Date()) {
  const currentYear = now.getFullYear();
  return [currentYear - 1, currentYear];
}

/** Anos no calendario/admin: janela fixa + qualquer ano que já exista nos eventos (evita sumir mês com dados). */
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

/** True quando já passou o "carência" pós-evento: ai o site prioriza o link do Drive. */
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

function compressDataUrlImage(dataUrl, { maxWidth = 1280, quality = 0.82, format = 'jpeg' } = {}) {
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
      if (format === 'png') {
        ctx.clearRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = format === 'png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality);
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
  if (!supabase) throw new Error('Supabase indisponível para upload.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = sanitizeFileName(file.name || `poster.${safeExt}`);
  const path = `events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { error: uploadError } = await supabase
    .storage
    .from(SUPABASE_POSTERS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || `image/${safeExt}` });
  if (uploadError) throw new Error(formatSupabaseStorageUploadError(uploadError));
  const { data } = supabase.storage.from(SUPABASE_POSTERS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Falha ao gerar URL pública do poster.');
  return data.publicUrl;
}

async function uploadGalleryImageToSupabaseStorage(file) {
  if (!supabase) throw new Error('Supabase indisponível para upload da galeria.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = sanitizeFileName(file.name || `gallery.${safeExt}`);
  const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { error: uploadError } = await supabase
    .storage
    .from(SUPABASE_GALLERY_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || `image/${safeExt}` });
  if (uploadError) throw new Error(formatSupabaseStorageUploadError(uploadError));
  const { data } = supabase.storage.from(SUPABASE_GALLERY_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Falha ao gerar URL pública da galeria.');
  return data.publicUrl;
}

async function uploadEditorialCoverToSupabaseStorage(file) {
  if (!supabase) throw new Error('Supabase indisponível para upload da capa editorial.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = sanitizeFileName(file.name || `editorial-cover.${safeExt}`);
  const path = `editorial/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { error: uploadError } = await supabase
    .storage
    .from(SUPABASE_POSTERS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || `image/${safeExt}` });
  if (uploadError) throw new Error(formatSupabaseStorageUploadError(uploadError));
  const { data } = supabase.storage.from(SUPABASE_POSTERS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Falha ao gerar URL pública da capa editorial.');
  return data.publicUrl;
}

async function uploadRolePhotoToSupabaseStorage(file) {
  if (!supabase) throw new Error('Supabase indisponível para upload das fotos do role.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = sanitizeFileName(file.name || `role.${safeExt}`);
  const path = `role-photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { error: uploadError } = await supabase
    .storage
    .from(SUPABASE_ROLE_PHOTOS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || `image/${safeExt}` });
  if (uploadError) throw new Error(formatSupabaseStorageUploadError(uploadError));
  const { data } = supabase.storage.from(SUPABASE_ROLE_PHOTOS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Falha ao gerar URL pública da foto do role.');
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

/** Link publico do canal: URL no conteúdo do site ou canal padrão acima. */
function resolvePublicYoutubeChannelUrl(siteContent) {
  const u = String(siteContent?.socialYouTubeUrl || '').trim();
  if (
    u.startsWith('http')
    && u.length > 28
    && !/^https?:\/\/(www\.)?youtube\.com\/?$/i.test(u)
  ) {
    return u;
  }
  return youtubeChannelUrl;
}

/** Faixa 2 (Sets): so arte de fundo; copy fica na imagem exportada pelo design. */
function SetsBannerSection({ siteContent }) {
  const bgUrl = String(siteContent?.setsBannerBgUrl || '').trim();
  return (
    <section className={yellowStripClassName('sets-banner', bgUrl)}>
      <YellowStripBg imageUrl={bgUrl} />
    </section>
  );
}

/** SVG do logo YouTube — só na faixa de sets (Home /sets), não no header global global. */
function SetsYoutubeIcon() {
  return (
    <svg className="sets-youtube-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
      />
    </svg>
  );
}

/** Bloco YouTube (API): avatar + nome do canal + CTA; independente do header do site. */
function SetsFeedHeaderRow({ branding, channelHref }) {
  const avatarUrl = branding?.avatarUrl;
  const title = branding?.title;
  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);
  const showAvatarImg = Boolean(avatarUrl) && !avatarBroken;
  return (
    <div className="sets-feed-header">
      <div className="sets-feed-channel">
        {showAvatarImg ? (
          <img
            className="sets-feed-avatar-img"
            src={avatarUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setAvatarBroken(true)}
          />
        ) : (
          <span className="sets-feed-avatar-img sets-feed-avatar-img--placeholder" aria-hidden="true" />
        )}
        <strong>{title || 'Douha Club'}</strong>
      </div>
      <a
        className="sets-youtube-cta sets-feed-youtube-cta"
        href={channelHref}
        target="_blank"
        rel="noopener noreferrer"
        title={title ? `Canal ${title} no YouTube` : 'Canal Douha Club no YouTube'}
      >
        <SetsYoutubeIcon />
        <span className="sets-youtube-label">YouTube</span>
      </a>
    </div>
  );
}

function AppShell({
  children,
  isAdminLoggedIn,
  onAdminLogout,
  siteContent,
}) {
  const location = useLocation();
  const [prints, setPrints] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCursorFine, setIsCursorFine] = useState(true);
  const printIdRef = useRef(0);
  const throttleRef = useRef(0);
  const lastPointRef = useRef(null);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('site-mobile-nav-open', mobileNavOpen);
    return () => document.body.classList.remove('site-mobile-nav-open');
  }, [mobileNavOpen]);

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

      <header className={`header header--overlay${mobileNavOpen ? ' header--nav-open' : ''}`}>
        <div className="header-inner">
          <Link to="/" className="header-brand" aria-label="Douha Club home">
            <img className="header-logo-img" src="/brand/logos/header-v9.svg" alt="" />
          </Link>
          <button
            type="button"
            className="header-menu-toggle"
            aria-expanded={mobileNavOpen}
            aria-controls="site-header-nav"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span className="visually-hidden">{mobileNavOpen ? 'Fechar menu' : 'Abrir menu'}</span>
            <span className="header-menu-toggle__bar" aria-hidden="true" />
            <span className="header-menu-toggle__bar" aria-hidden="true" />
            <span className="header-menu-toggle__bar" aria-hidden="true" />
          </button>
          <nav id="site-header-nav" className={`nav nav--header${mobileNavOpen ? ' is-open' : ''}`}>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setMobileNavOpen(false)}>HOME</NavLink>
            <NavLink to="/quem-somos" className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setMobileNavOpen(false)}>QUEM SOMOS</NavLink>
            <NavLink to="/calendario" className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setMobileNavOpen(false)}>CALENDÁRIO</NavLink>
            <NavLink to="/reservas" className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setMobileNavOpen(false)}>RESERVAS</NavLink>
            <NavLink to="/sets" className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setMobileNavOpen(false)}>SETS</NavLink>
            <NavLink to="/editorial" className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setMobileNavOpen(false)}>EDITORIAL</NavLink>
            <NavLink to="/contato" className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setMobileNavOpen(false)}>CONTATO</NavLink>
          </nav>
        </div>
        {mobileNavOpen ? (
          <button
            type="button"
            className="header-nav-backdrop"
            aria-label="Fechar menu"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
      </header>
      {isAdminLoggedIn && (
        <div className="admin-quickbar">
          <Link to="/admin" className="pill">Abrir painel</Link>
          <button type="button" className="pill pill-light" onClick={onAdminLogout}>Sair admin</button>
        </div>
      )}
      {children}

      <footer className="footer">
        <div className={`container footer-shell${String(siteContent.footerLogoUrl || '').trim() ? ' footer-shell--has-logo' : ''}`}>
          <div className="footer-grid">
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
                <a href={normalizeWhatsAppUrl(siteContent.contactWhatsApp) || siteContent.contactWhatsApp} target="_blank" rel="noreferrer" className="footer-contact-link">
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
                href={normalizeWhatsAppUrl(siteContent.communityWhatsAppUrl) || siteContent.communityWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
              >
                {siteContent.communityWhatsAppLabel}
              </a>
            </div>
          </div>
          <div className="footer-col footer-col-faq">
            <p className="eyebrow">FAQ</p>
            <a className="footer-faq-link" href="/contato#faq">Acessar FAQ</a>
            <a className="footer-faq-link footer-privacy-link" href="/privacidade">Política de privacidade</a>
          </div>
          </div>
          <div className="footer-rule" aria-hidden="true" />
          <div className={`footer-bottom${String(siteContent.footerLogoUrl || '').trim() ? ' footer-bottom--with-logo' : ''}`}>
            <div className="footer-col footer-col-brand">
              <p className="eyebrow">DOUHA CLUB</p>
              <p>ALL RIGHTS RESERVED 2026</p>
            </div>
            {String(siteContent.footerLogoUrl || '').trim() ? (
              <div className="footer-logo-slot" aria-hidden="true">
                <div className="footer-logo-mark">
                  <img
                    className={footerLogoImageClassName(siteContent.footerLogoUrl)}
                    src={String(siteContent.footerLogoUrl).trim()}
                    alt=""
                    width={FOOTER_LOGO_PX.size}
                    height={FOOTER_LOGO_PX.size}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            ) : null}
            <div className="footer-bottom__spacer" aria-hidden="true" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function AgendaEventBlock({ night }) {
  const hasPoster = Boolean(night.poster?.trim());
  const isPhotosPhase = shouldUseEventPhotosLink(night.date);
  const ticketUrl = String(night.ticketUrl || '').trim();
  const photosUrl = String(night.photosUrl || '').trim();
  const hasTicketUrl = Boolean(ticketUrl);
  const hasPhotosUrl = Boolean(photosUrl);
  /** Antes do evento: so ingresso. Depois: so fotos (se tiver link). */
  const isClickable = isPhotosPhase ? hasPhotosUrl : hasTicketUrl;
  const actionUrl = isPhotosPhase ? photosUrl : ticketUrl;
  const ctaLabel = isPhotosPhase ? 'Ver fotos do role' : 'Comprar ingressos';
  const ariaLabel = isClickable ? `${ctaLabel} — ${night.lineup}` : `${night.lineup} — ${night.date}`;
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
      {isClickable ? (
        <div className="agenda-poster-overlay" aria-hidden="true">
          <span className="agenda-poster-cta">{ctaLabel}</span>
        </div>
      ) : null}
    </div>
  );

  return (
    <article className="agenda-event">
      {isClickable ? (
        <a
          href={actionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="agenda-poster-link"
          aria-label={ariaLabel}
        >
          {posterInner}
        </a>
      ) : (
        <div className="agenda-poster-link agenda-poster-link-disabled" aria-label={ariaLabel}>
          {posterInner}
        </div>
      )}
      <div className="agenda-event-details">
        <p className="event-date">
          {night.date}
          <span>{night.time}</span>
        </p>
        <p className="event-lineup">{night.lineup}</p>
        {night.reservationsEnabled && !isPhotosPhase ? (
          <Link to={`/reservas/${night.id}`} className="pill agenda-reserve-link">
            Pré-reservar mesa
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function AgendaCalendarSection({
  agendaEvents,
  title = 'CALENDÁRIO',
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
    Object.keys(buckets).forEach((yearKey) => {
      Object.keys(buckets[yearKey]).forEach((monthKey) => {
        buckets[yearKey][monthKey].sort(compareAgendaEventsByDate);
      });
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
  const calendarAutoFocusedRef = useRef(false);

  /** Abre no mês mais próximo de hoje que tenha eventos (ex.: junho/2026 se estamos em junho). */
  useEffect(() => {
    if (calendarAutoFocusedRef.current || focusTarget) return;
    if (applySavedFocus) {
      try {
        if (localStorage.getItem(CALENDAR_FOCUS_KEY)) return;
      } catch {
        /* segue para foco padrão */
      }
    }
    if (!agendaEvents.length) return;
    const focus = findDefaultCalendarMonthWithEvents(agendaEvents, now);
    if (focus && yearOptions.includes(focus.year)) {
      setSelectedYear(focus.year);
      setSelectedMonth(focus.monthIndex);
    }
    calendarAutoFocusedRef.current = true;
  }, [agendaEvents, now, focusTarget, applySavedFocus, yearOptions]);

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
  /** 1–3 eventos na 1ª linha: centraliza (mesmo tamanho de card que com 4). */
  const centerCalendarEvents =
    monthEvents.length > 0
    && monthEvents.length < CALENDAR_CARDS_PER_ROW
    && !(adminMode && showEmptySlots);
  const calendarHasSecondRow = monthEvents.length > CALENDAR_CARDS_PER_ROW;

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

          <div className="calendar-month-tabs" role="tablist" aria-label="Selecionar mês da agenda">
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

        {adminMode ? (
          <p className="calendar-admin-limit-note" role="status">
            <strong>{monthEvents.length}/{MAX_EVENTS_PER_MONTH}</strong> eventos em{' '}
            {MONTH_LABELS[selectedMonth]} {selectedYear}. Grade: até {CALENDAR_CARDS_PER_ROW} na 1ª linha;
            do {CALENDAR_CARDS_PER_ROW + 1}º ao {MAX_EVENTS_PER_MONTH}º na 2ª linha (esquerda → direita). Ordem por data do evento.
          </p>
        ) : null}

        <div
          className={`calendar-event-grid${centerCalendarEvents ? ' calendar-event-grid--centered' : ''}${calendarHasSecondRow ? ' calendar-event-grid--two-rows' : ''}${adminMode && showEmptySlots ? ' calendar-event-grid--admin-slots' : ''}`}
        >
          {monthEvents.length ? monthEvents.map((night) => (
            adminMode ? (
              <article key={`calendar-${night.id}`} className="admin-calendar-slot">
                <p><strong>{night.date}</strong> · {night.time || 'Sem horário'}</p>
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
          )) : null}
          {showEmptySlots ? Array.from({ length: emptySlots }).map((_, idx) => {
            const slotIndex = monthEvents.length + idx;
            const { slotNum, row } = describeCalendarSlot(slotIndex);
            return (
            <article
              key={`empty-slot-${selectedYear}-${selectedMonth}-${idx}`}
              className="admin-calendar-slot admin-calendar-slot-empty"
            >
              <p><strong>Slot {slotNum} livre</strong></p>
              <p>Linha {row} · max. {MAX_EVENTS_PER_MONTH} por mês ({CALENDAR_CARDS_PER_ROW}+{MAX_EVENTS_PER_MONTH - CALENDAR_CARDS_PER_ROW}).</p>
              {adminMode ? (
                <button
                  type="button"
                  className="pill"
                  onClick={() => onCreateEvent?.({
                    year: Number(selectedYear),
                    monthIndex: selectedMonth,
                    slotIndex,
                  })}
                >
                  Criar evento
                </button>
              ) : null}
            </article>
            );
          }) : null}
        </div>
      </InnerTag>
    </WrapperTag>
  );
}

/** Metade da faixa duplicada em loop (mais lento que a animacao CSS antiga de 48s). */
const HERO_MARQUEE_HALF_LOOP_SEC = 130;

/** Carrossel: prioriza primeiras imagens; demais lazy para aliviar rede e decode. */
function heroCarouselImageProps(index) {
  const eager = index < 6;
  return {
    loading: eager ? 'eager' : 'lazy',
    fetchPriority: index < 2 ? 'high' : 'low',
    decoding: 'async',
  };
}

/** Faixa pós-experiência: mosaico denso em "trilhos"; repetimos entradas pra preencher o loop. */
const ROLE_STRIP_LANES = 7;
const ROLE_STRIP_LANES_MOBILE = 2;
const ROLE_STRIP_MIN_CARDS = 21;
const ROLE_STRIP_MAX_CARDS = 120;
/** Mobile: 1 foto por trilho (2 no total) — evita empilhar na vertical. */
const ROLE_LANE_X_MOBILE = [24, 76];
/** Mobile: queda 12s; 1.375s entre esq/dir; espacamento por trilho divide 12s (sem sobrepor). */
const ROLE_STRIP_MOBILE_FALL_SEC = 12;
const ROLE_STRIP_MOBILE_STAGGER_SEC = 1.375;
const ROLE_STRIP_MOBILE_CARD_COUNT = 8;

function roleMobileCardsInLane(lane, total = ROLE_STRIP_MOBILE_CARD_COUNT) {
  let count = 0;
  for (let i = lane; i < total; i += ROLE_STRIP_LANES_MOBILE) count += 1;
  return count;
}

/** Offset positivo no ciclo: trilhos com N fotos ficam a cada FALL_SEC/N (evita 2 no mesmo Y). */
function roleMobileCardOffsetSec(idx, total = ROLE_STRIP_MOBILE_CARD_COUNT) {
  const lane = idx % ROLE_STRIP_LANES_MOBILE;
  const slot = Math.floor(idx / ROLE_STRIP_LANES_MOBILE);
  const laneStart = lane === 1 ? ROLE_STRIP_MOBILE_STAGGER_SEC : 0;
  const laneGap = ROLE_STRIP_MOBILE_FALL_SEC / Math.max(1, roleMobileCardsInLane(lane, total));
  return laneStart + slot * laneGap;
}

function getRoleLaneDurationSec(lane, mobile = false) {
  if (mobile) return ROLE_STRIP_MOBILE_FALL_SEC;
  return 41 + (lane % 4) * 2.5;
}

/**
 * Distribui os cards de forma uniforme dentro de cada trilho.
 * Evita colisao por modulo de delay (quando o loop volta no mesmo ponto).
 */
function buildRoleCardStyle(lane, slot, cardsInLane, globalIdx, mobile = false) {
  const durationSec = getRoleLaneDurationSec(lane, mobile);
  const count = Math.max(1, cardsInLane);
  let roleDelay;
  if (mobile && count === 1) {
    /* Direita já cai enquanto esquerda ainda desce (cruzamento, nunca trilho vazio). */
    const staggerSec = ROLE_STRIP_MOBILE_STAGGER_SEC;
    roleDelay = lane === 0 ? '0s' : `${-staggerSec}s`;
  } else {
    const gapSec = durationSec / count;
    const laneOffset = (lane * 0.37) % durationSec;
    const idxPhase = (globalIdx * 0.173) % 1.9;
    roleDelay = `${-(laneOffset + slot * gapSec + idxPhase)}s`;
  }
  const style = {
    '--role-lane': `${lane}`,
    '--role-delay': roleDelay,
    '--role-duration': `${durationSec}s`,
    '--role-drift': mobile ? (lane % 2 === 0 ? '-8px' : '8px') : '0px',
    '--role-jitter': '0px',
  };
  if (mobile) {
    style['--role-lane-x'] = `${ROLE_LANE_X_MOBILE[lane % ROLE_LANE_X_MOBILE.length]}%`;
  }
  return style;
}

function buildRoleMobileStripCards(normalizedEntries) {
  const shuffled = shuffleRolePhotoEntriesDeterministic(normalizedEntries);
  const url = (i) => shuffled[i % shuffled.length]?.url || '';
  const total = ROLE_STRIP_MOBILE_CARD_COUNT;
  return Array.from({ length: total }, (_, idx) => {
    const lane = idx % ROLE_STRIP_LANES_MOBILE;
    const style = buildRoleCardStyle(lane, 0, 1, idx, true);
    const offsetSec = roleMobileCardOffsetSec(idx, total);
    style['--role-delay'] = offsetSec === 0 ? '0s' : `${-offsetSec}s`;
    return {
      id: `role-photo-m${idx}-${url(idx)}`,
      url: url(idx),
      style,
    };
  });
}

function shuffleRolePhotoEntriesDeterministic(entries) {
  const arr = entries.map((e) => ({ ...e }));
  let seed = 2166136261;
  const key = arr.map((e) => e.url).join('|');
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
  return Math.min(ROLE_STRIP_MAX_CARDS, Math.max(ROLE_STRIP_MIN_CARDS, Math.round(photoCount * 2.2)));
}

const HERO_STRIP_MIN_COPIES = 4;
const HERO_STRIP_MAX_COPIES = 20;

/** Repete a lista o suficiente para scrollWidth > viewport (monitores largos + poucas fotos). */
function buildHeroPhotoStrip(base, viewportWidth = 1280) {
  if (!base.length) return [];
  const vw = Math.max(320, viewportWidth);
  const frameW = Math.min(400, Math.max(220, vw * 0.32));
  const onePassW = base.reduce((sum, item) => {
    if (item.mode === 'wide' || item.mode === 'double') return sum + frameW * 2;
    return sum + frameW;
  }, 0);
  const needed = Math.ceil((vw * 2.2) / Math.max(onePassW, frameW));
  let copies = Math.min(HERO_STRIP_MAX_COPIES, Math.max(HERO_STRIP_MIN_COPIES, needed));
  if (copies % 2 !== 0) copies += 1;
  return Array.from({ length: copies }, () => base).flat();
}

function HomePage({
  agendaEvents,
  sitePhotos,
  rolePhotos,
  editorialPosts,
  calendarFocus,
  onFocusConsumed,
  siteContent,
  youtubeChannelBranding,
  youtubeChannelHref,
}) {
  const photos = sitePhotos.length ? sitePhotos : gallery;
  const parsedHeroPhotos = useMemo(
    () => photos.map(parsePhotoEntry).filter((item) => item.primary),
    [photos],
  );
  const [heroViewportWidth, setHeroViewportWidth] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth : 1280),
  );
  const heroPhotoStrip = useMemo(
    () => buildHeroPhotoStrip(parsedHeroPhotos, heroViewportWidth),
    [parsedHeroPhotos, heroViewportWidth],
  );
  const heroShellRef = useRef(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });
  const heroDragCleanupRef = useRef(null);
  const heroMarqueeOffscreenRef = useRef(false);
  const [heroDragging, setHeroDragging] = useState(false);
  const [videoCards, setVideoCards] = useState([]);
  const [roleStripMobile, setRoleStripMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );
  const rolePhotoPlaceholders = useMemo(
    () => {
      if (roleStripMobile) {
        const total = ROLE_STRIP_MOBILE_CARD_COUNT;
        return Array.from({ length: total }, (_, idx) => {
          const lane = idx % ROLE_STRIP_LANES_MOBILE;
          const style = buildRoleCardStyle(lane, 0, 1, idx, true);
          const offsetSec = roleMobileCardOffsetSec(idx, total);
          style['--role-delay'] = offsetSec === 0 ? '0s' : `${-offsetSec}s`;
          return { id: `role-placeholder-m${idx}`, style };
        });
      }
      const lanes = ROLE_STRIP_LANES;
      const total = ROLE_STRIP_MIN_CARDS;
      return Array.from({ length: total }, (_, idx) => {
        const lane = idx % lanes;
        const slot = Math.floor(idx / lanes);
        const cardsInLane = Math.max(1, Math.ceil((total - lane) / lanes));
        return {
          id: `role-placeholder-${idx}`,
          style: buildRoleCardStyle(lane, slot, cardsInLane, idx),
        };
      });
    },
    [roleStripMobile],
  );
  const rolePhotoCards = useMemo(() => {
    if (!rolePhotos.length) return rolePhotoPlaceholders.map((item) => ({ ...item, url: '' }));
    const normalized = rolePhotos.map(normalizeRolePhotoEntry).filter(Boolean);
    if (roleStripMobile) return buildRoleMobileStripCards(normalized);
    const lanes = ROLE_STRIP_LANES;
    const total = getRoleStripCardCount(rolePhotos.length);
    const shuffled = shuffleRolePhotoEntriesDeterministic(normalized);
    return Array.from({ length: total }, (_, idx) => {
      const lane = idx % lanes;
      const slot = Math.floor(idx / lanes);
      const cardsInLane = Math.max(1, Math.ceil((total - lane) / lanes));
      const pick = shuffled[idx % shuffled.length];
      return {
        id: `role-photo-${idx}`,
        url: pick.url,
        style: buildRoleCardStyle(lane, slot, cardsInLane, idx),
      };
    });
  }, [rolePhotos, rolePhotoPlaceholders, roleStripMobile]);

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
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 767px)');
    const onLayout = () => {
      setRoleStripMobile(mq.matches);
      setHeroViewportWidth(window.innerWidth);
    };
    onLayout();
    mq.addEventListener('change', onLayout);
    window.addEventListener('resize', onLayout);
    return () => {
      mq.removeEventListener('change', onLayout);
      window.removeEventListener('resize', onLayout);
    };
  }, []);

  useEffect(() => {
    const el = heroShellRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        /* So pausa quando o bloco sai totalmente da tela (ratio < 0.04 gerava falso positivo e travava o loop). */
        heroMarqueeOffscreenRef.current = !entry.isIntersecting;
      },
      { root: null, rootMargin: '80px 0px', threshold: [0, 0.01, 0.25, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [heroPhotoStrip]);

  useEffect(() => {
    const el = heroShellRef.current;
    if (!el) return undefined;

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
      const paused =
        draggingRef.current
        || document.visibilityState !== 'visible'
        || heroMarqueeOffscreenRef.current;
      if (!paused && el.scrollWidth > el.clientWidth + 1) {
        const half = el.scrollWidth / 2;
        const speed = half / HERO_MARQUEE_HALF_LOOP_SEC;
        el.scrollLeft = el.scrollLeft + speed * dt;
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
    if (!CAN_LOAD_YOUTUBE_FEED) return undefined;
    let active = true;
    const loadYouTube = async () => {
      try {
        const latest = await fetchLatestYouTubeVideosResilient({
          apiKey: YOUTUBE_API_KEY,
          channelId: YOUTUBE_CHANNEL_ID,
          maxResults: YOUTUBE_FETCH_COUNT,
        });
        if (!active) return;
        setVideoCards(latest.slice(0, YOUTUBE_FETCH_COUNT));
      } catch (err) {
        if (!active) return;
        if (import.meta.env.DEV) {
          console.warn('[Douha] YouTube (placeholders):', err?.message || err);
        }
        setVideoCards([]);
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
          aria-label="Carrossel de fotos do Douha Club"
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
                      draggable={false}
                      onDragStart={(ev) => ev.preventDefault()}
                      {...heroCarouselImageProps(idx)}
                    />
                  </figure>
                ) : photo.mode === 'double' ? (
                  <figure className="photo-frame hero-photo-frame hero-photo-frame-double" key={`hero-photo-double-${photo.primary}-${photo.secondary}-${idx}`}>
                    <div className="hero-double-slot">
                      <img
                        src={photo.primary}
                        alt=""
                        draggable={false}
                        onDragStart={(ev) => ev.preventDefault()}
                        {...heroCarouselImageProps(idx)}
                      />
                    </div>
                    <div className="hero-double-slot">
                      <img
                        src={photo.secondary}
                        alt=""
                        draggable={false}
                        onDragStart={(ev) => ev.preventDefault()}
                        {...heroCarouselImageProps(idx)}
                      />
                    </div>
                  </figure>
                ) : (
                  <figure className="photo-frame hero-photo-frame" key={`hero-photo-${photo.primary}-${idx}`}>
                    <img
                      src={photo.primary}
                      alt=""
                      draggable={false}
                      onDragStart={(ev) => ev.preventDefault()}
                      {...heroCarouselImageProps(idx)}
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
        ctaLabel="Abrir página"
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
        <div className={yellowStripClassName('experience-highlight-copy', siteContent?.experienceCopyBannerBgUrl)}>
          <YellowStripBg imageUrl={siteContent?.experienceCopyBannerBgUrl} />
        </div>
      </section>

      <section className="people-role-photos" aria-label="Espaco reservado para fotos do role">
        <div {...buildRoleStageBgProps(siteContent?.rolePhotosStageBgUrl)}>
          <div className="people-role-photos-diagonal" aria-hidden="true">
            {rolePhotoCards.map((item) => (
              <figure
                key={item.id}
                className="role-photo-card"
                style={item.style}
              >
                {item.url ? <img src={item.url} alt="" draggable={false} onDragStart={(ev) => ev.preventDefault()} /> : <span>FOTO</span>}
              </figure>
            ))}
          </div>
        </div>
      </section>

      <SetsBannerSection siteContent={siteContent} />

      <section className="section">
        <div className="container music-block">
          <SetsFeedHeaderRow branding={youtubeChannelBranding} channelHref={youtubeChannelHref} />
          <div className="sets-video-grid">
            {videoCards.slice(0, YOUTUBE_FEED_CARDS).map((track, thumbIdx) => (
              <a key={track.videoId} className="sets-video-card" href={track.videoUrl} target="_blank" rel="noreferrer">
                <div className="sets-video-thumb">
                  <img
                    src={track.thumb}
                    alt={`Thumb do set ${track.title}`}
                    loading="lazy"
                    decoding="async"
                    fetchPriority={thumbIdx < 2 ? 'high' : 'low'}
                  />
                  <span className="sets-play-badge" aria-hidden="true">▶</span>
                </div>
                <p>{track.title}</p>
              </a>
            ))}
          </div>

          <div className="sets-topics-block sets-topics-block--textured">
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

      <HomeEditorialSection editorialPosts={editorialPosts} />
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
            <a href={siteContent.whoWeAreInstagram} target="_blank" rel="noreferrer">
              @douha.club no Instagram
            </a>
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
        title="CALENDÁRIO"
        applySavedFocus
        focusTarget={calendarFocus}
        onFocusConsumed={onFocusConsumed}
      />
      <section className="section worldwide-section">
        <div className="container">
          <h2>Worldwide</h2>
        </div>
      </section>
    </main>
  );
}

function SetsPage({ siteContent, youtubeChannelBranding, youtubeChannelHref }) {
  const [videoCards, setVideoCards] = useState([]);

  useEffect(() => {
    if (!CAN_LOAD_YOUTUBE_FEED) return undefined;
    let active = true;
    const loadYouTube = async () => {
      try {
        const latest = await fetchLatestYouTubeVideosResilient({
          apiKey: YOUTUBE_API_KEY,
          channelId: YOUTUBE_CHANNEL_ID,
          maxResults: YOUTUBE_FETCH_COUNT,
        });
        if (!active) return;
        setVideoCards(latest.slice(0, YOUTUBE_FETCH_COUNT));
      } catch (err) {
        if (!active) return;
        if (import.meta.env.DEV) {
          console.warn('[Douha] YouTube (placeholders):', err?.message || err);
        }
        setVideoCards([]);
      }
    };
    loadYouTube();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <SetsBannerSection siteContent={siteContent} />
      <section className="section">
        <div className="container music-block">
          <SetsFeedHeaderRow branding={youtubeChannelBranding} channelHref={youtubeChannelHref} />
          <div className="sets-video-grid">
            {videoCards.slice(0, YOUTUBE_FEED_CARDS).map((track, thumbIdx) => (
              <a key={track.videoId} className="sets-video-card" href={track.videoUrl} target="_blank" rel="noreferrer">
                <div className="sets-video-thumb">
                  <img
                    src={track.thumb}
                    alt={`Thumb do set ${track.title}`}
                    loading="lazy"
                    decoding="async"
                    fetchPriority={thumbIdx < 2 ? 'high' : 'low'}
                  />
                  <span className="sets-play-badge" aria-hidden="true">▶</span>
                </div>
                <p>{track.title}</p>
              </a>
            ))}
          </div>
          <div className="sets-topics-block sets-topics-block--textured">
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

function getAllPublishedEditorialPosts(editorialPosts) {
  const source = editorialPosts.length ? editorialPosts : defaultEditorialPosts;
  return [...source]
    .filter((item) => item.isPublished !== false)
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
}

function getPublishedEditorialPosts(editorialPosts, limit = 4) {
  return getAllPublishedEditorialPosts(editorialPosts).slice(0, limit);
}

function resolveEditorialMosaic(editorialPosts, siteContent) {
  const published = getAllPublishedEditorialPosts(editorialPosts);
  if (!published.length) return { lead: null, side: [] };

  const slotIds = [
    String(siteContent?.editorialMosaicLeadId || '').trim(),
    String(siteContent?.editorialMosaicSide1Id || '').trim(),
    String(siteContent?.editorialMosaicSide2Id || '').trim(),
  ];
  const byId = new Map(published.map((post) => [post.id, post]));
  const used = new Set();

  const resolveSlot = (id) => {
    if (id && byId.has(id) && !used.has(id)) {
      used.add(id);
      return byId.get(id);
    }
    const fallback = published.find((post) => !used.has(post.id));
    if (fallback) used.add(fallback.id);
    return fallback || null;
  };

  const lead = resolveSlot(slotIds[0]);
  const side1 = resolveSlot(slotIds[1]);
  const side2 = resolveSlot(slotIds[2]);
  return { lead, side: [side1, side2].filter(Boolean) };
}

function getEditorialMosaicPostIds(mosaic) {
  const ids = new Set();
  if (mosaic?.lead?.id) ids.add(mosaic.lead.id);
  (mosaic?.side || []).forEach((post) => {
    if (post?.id) ids.add(post.id);
  });
  return ids;
}

function getEditorialArchivePosts(editorialPosts, siteContent) {
  const mosaic = resolveEditorialMosaic(editorialPosts, siteContent);
  const inMosaic = getEditorialMosaicPostIds(mosaic);
  return getAllPublishedEditorialPosts(editorialPosts).filter((post) => !inMosaic.has(post.id));
}

const EDITORIAL_MOSAIC_SLOT_FIELDS = {
  lead: 'leadId',
  side1: 'side1Id',
  side2: 'side2Id',
};

const EDITORIAL_MOSAIC_DRAG_MIME = 'application/x-douha-editorial-mosaic';

function parseEditorialMosaicDragPayload(event) {
  const raw = event.dataTransfer.getData(EDITORIAL_MOSAIC_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const postId = String(parsed?.postId || '').trim();
    if (!postId) return null;
    const fromSlot = String(parsed?.fromSlot || '').trim();
    return { postId, fromSlot: fromSlot || null };
  } catch {
    return null;
  }
}

function assignEditorialMosaicSlot(draft, targetSlot, postId, fromSlot = null) {
  const next = {
    leadId: String(draft.leadId || ''),
    side1Id: String(draft.side1Id || ''),
    side2Id: String(draft.side2Id || ''),
  };
  const targetField = EDITORIAL_MOSAIC_SLOT_FIELDS[targetSlot];
  if (!targetField) return next;

  const displacedId = String(next[targetField] || '');
  for (const field of Object.values(EDITORIAL_MOSAIC_SLOT_FIELDS)) {
    if (next[field] === postId) next[field] = '';
  }

  next[targetField] = postId;

  if (fromSlot && fromSlot !== targetSlot) {
    const fromField = EDITORIAL_MOSAIC_SLOT_FIELDS[fromSlot];
    if (fromField) next[fromField] = displacedId && displacedId !== postId ? displacedId : '';
  }

  return next;
}

function clearEditorialMosaicSlot(draft, slot) {
  const next = { ...draft };
  const field = EDITORIAL_MOSAIC_SLOT_FIELDS[slot];
  if (field) next[field] = '';
  return next;
}

function editorialMosaicCategoryLabel(post) {
  const category = String(post?.category || '').trim();
  if (category) return category;
  return String(post?.source || 'EDITORIAL').trim();
}

function editorialArticlePath(postId) {
  return `/editorial/${encodeURIComponent(String(postId || '').trim())}`;
}

function findEditorialPostById(editorialPosts, postId) {
  const id = String(postId || '').trim();
  if (!id) return null;
  const source = editorialPosts.length ? editorialPosts : defaultEditorialPosts;
  const post = source.find((item) => item.id === id);
  if (!post || post.isPublished === false) return null;
  return post;
}

function formatEditorialDisplayDate(post) {
  const raw = String(post?.daté || post?.publishedAt || '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  return raw;
}

function linkifyEditorialInlineText(text, keyPrefix) {
  const value = String(text || '');
  if (!value) return null;
  const urlPattern = /(https?:\/\/[^\s<>"']+)/gi;
  const parts = [];
  let lastIndex = 0;
  let match = urlPattern.exec(value);
  let partIdx = 0;
  while (match) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }
    const href = match[0].replace(/[.,;:!?)]+$/, '');
    parts.push(
      <a key={`${keyPrefix}-link-${partIdx}`} href={href} target="_blank" rel="noreferrer">
        {href}
      </a>,
    );
    partIdx += 1;
    lastIndex = match.index + match[0].length;
    match = urlPattern.exec(value);
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return parts.length ? parts : value;
}

function renderEditorialContentBlock(block, blockIdx) {
  const content = block.replace(/^\n+|\n+$/g, '');
  if (!content.trim() && !/\S/.test(content)) return null;

  const lines = content.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim());

  if (nonEmptyLines.length > 0 && nonEmptyLines.every((line) => line.trim().startsWith('- '))) {
    return (
      <ul key={`editorial-ul-${blockIdx}`} className="editorial-article__list">
        {nonEmptyLines.map((line, itemIdx) => (
          <li key={`editorial-ul-${blockIdx}-item-${itemIdx}`}>
            {linkifyEditorialInlineText(line.trim().slice(2), `editorial-ul-${blockIdx}-item-${itemIdx}`)}
          </li>
        ))}
      </ul>
    );
  }

  if (lines.length === 1) {
    const single = lines[0].trim();
    if (single.startsWith('### ')) {
      return (
        <h3 key={`editorial-h3-${blockIdx}`} className="editorial-article__h3">
          {single.slice(4)}
        </h3>
      );
    }
    if (single.startsWith('## ')) {
      return (
        <h2 key={`editorial-h2-${blockIdx}`} className="editorial-article__h2">
          {single.slice(3)}
        </h2>
      );
    }
  }

  return (
    <p key={`editorial-p-${blockIdx}`} className="editorial-article__paragraph">
      {linkifyEditorialInlineText(content, `editorial-p-${blockIdx}`)}
    </p>
  );
}

/** Preserva parágrafos e quebras de linha como no admin (linha em branco = espaço; Enter = quebra). */
function EditorialArticleBody({ body }) {
  const text = String(body ?? '');
  if (!text.trim()) {
    return <p className="editorial-article__placeholder">Texto completo em breve.</p>;
  }

  const segments = text.split(/(\n{2,})/);
  const nodes = [];

  segments.forEach((segment, idx) => {
    if (/^\n+$/.test(segment)) {
      nodes.push(
        <div key={`editorial-gap-${idx}`} className="editorial-article__whitespace" aria-hidden="true">
          {segment}
        </div>,
      );
      return;
    }
    const block = renderEditorialContentBlock(segment, idx);
    if (block) nodes.push(block);
  });

  if (!nodes.length) {
    return <p className="editorial-article__placeholder">Texto completo em breve.</p>;
  }
  return nodes;
}

function EditorialArticleByline({ post }) {
  const authorName = String(post?.authorName || '').trim() || 'Douha Club';
  const avatarUrl = String(post?.authorAvatarUrl || '').trim();
  const publishedLabel = formatEditorialArticleDate(post);
  const updatedLabel = formatEditorialRelativeUpdate(post);
  const readingMinutes = estimateEditorialReadingMinutes(post);
  const readingLabel = formatEditorialReadingLabel(readingMinutes);
  const initial = editorialAuthorInitial(authorName);

  return (
    <div className="editorial-article__byline" aria-label="Autoria e tempo de leitura">
      <div className="editorial-article__byline-segment editorial-article__byline-author">
        <span className="editorial-article__byline-avatar" aria-hidden="true">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="editorial-article__byline-avatar-fallback">{initial}</span>
          )}
        </span>
        <span className="editorial-article__byline-name">{authorName}</span>
      </div>

      <div className="editorial-article__byline-segment editorial-article__byline-dates">
        {publishedLabel ? (
          <span className="editorial-article__byline-date">{publishedLabel}</span>
        ) : (
          <span className="editorial-article__byline-daté editorial-article__byline-date--empty">Data a definir</span>
        )}
        {updatedLabel ? <span className="editorial-article__byline-updated">{updatedLabel}</span> : null}
      </div>

      <div className="editorial-article__byline-segment editorial-article__byline-reading">
        <svg className="editorial-article__byline-clock" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 7v5l3 2.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <span>{readingLabel}</span>
      </div>
    </div>
  );
}

function editorialReferenceTitle(item, idx) {
  const label = String(item?.label || '').trim();
  if (label) return label;
  try {
    const host = new URL(item.url).hostname.replace(/^www\./, '');
    return host || `Referência ${idx + 1}`;
  } catch {
    return `Referência ${idx + 1}`;
  }
}

function EditorialArticleReferences({ sources }) {
  const items = normalizeEditorialSourcesList(sources).filter((item) => item.url);
  if (!items.length) return null;

  return (
    <section className="editorial-article__references" aria-labelledby="editorial-article-references-title">
      <h2 id="editorial-article-references-title" className="editorial-article__references-title">
        Referências
      </h2>
      <ol className="editorial-article__references-list">
        {items.map((item, idx) => (
          <li key={`editorial-ref-${idx}-${item.url}`}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="editorial-article__reference-link"
            >
              {editorialReferenceTitle(item, idx)}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AdminEditorialBylineFields({ draft, onChange }) {
  const preview = useMemo(() => buildEditorialBylinePreview(draft), [draft]);

  return (
    <div className="admin-editorial-byline-block">
      <h4 className="admin-subheading">Autoria, data e tempo de leitura</h4>
      <p className="about-copy image-spec-note">
        Aparece na barra abaixo do título (autor · data · relógio + minutos). O tempo de leitura é calculado
        automaticamente pelo texto. &quot;Atualizado há…&quot; usa a data da última gravação no admin.
      </p>
      <div className="admin-editorial-byline-row">
        <div className="admin-form-field">
          <label htmlFor="admin-editorial-author">Autor(a)</label>
          <input
            id="admin-editorial-author"
            value={draft.authorName}
            onChange={(event) => onChange({ authorName: event.target.value })}
            placeholder="Ex: Clarissa Palácio"
          />
        </div>
        <div className="admin-form-field">
          <label htmlFor="admin-editorial-date">Data de publicação</label>
          <input
            id="admin-editorial-date"
            type="date"
            value={draft.date}
            onChange={(event) => onChange({ date: event.target.value })}
          />
        </div>
        <div className="admin-form-field admin-editorial-reading-estimate">
          <span className="admin-editorial-reading-estimate__label">Tempo de leitura (estimado)</span>
          <strong className="admin-editorial-reading-estimate__value">{preview.readingLabel}</strong>
        </div>
      </div>
      <div className="admin-form-field">
        <label htmlFor="admin-editorial-author-avatar">Foto do autor (URL opcional)</label>
        <input
          id="admin-editorial-author-avatar"
          type="url"
          inputMode="url"
          value={draft.authorAvatarUrl}
          onChange={(event) => onChange({ authorAvatarUrl: event.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="admin-editorial-byline-preview" aria-hidden="true">
        <span className="admin-editorial-byline-preview__author">{preview.authorName}</span>
        <span className="admin-editorial-byline-preview__sep" />
        <span className="admin-editorial-byline-preview__dates">
          {preview.publishedLabel || '—'}
          {preview.updatedLabel ? ` · ${preview.updatedLabel}` : ''}
        </span>
        <span className="admin-editorial-byline-preview__sep" />
        <span className="admin-editorial-byline-preview__reading">{preview.readingLabel}</span>
      </div>
    </div>
  );
}

function AdminEditorialSourcesFields({ sources, onChange }) {
  const [bulkPaste, setBulkPaste] = useState('');
  const list = normalizeEditorialSourcesList(sources);

  const updateSource = (index, field, value) => {
    onChange(list.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const removeSource = (index) => {
    onChange(list.filter((_, idx) => idx !== index));
  };

  const addSource = () => {
    onChange([...list, { label: '', url: '' }]);
  };

  const importBulkSources = () => {
    const parsed = parseEditorialSourcesBulk(bulkPaste);
    if (!parsed.length) return;
    onChange([...list, ...parsed]);
    setBulkPaste('');
  };

  return (
    <div className="admin-editorial-sources">
      <p className="about-copy">
        Adicione uma fonte por vez ou cole várias linhas (uma por linha). Formatos: <code>Nome — https://...</code>,{' '}
        <code>Nome | url</code> ou só o link.
      </p>
      {list.map((item, idx) => (
        <div key={`admin-editorial-source-${idx}`} className="admin-editorial-source-row">
          <div className="admin-form-field">
            <label htmlFor={`admin-source-label-${idx}`}>Título da referência</label>
            <input
              id={`admin-source-label-${idx}`}
              value={item.label}
              onChange={(event) => updateSource(idx, 'label', event.target.value)}
              placeholder="Ex: Instagram Douha Club"
            />
          </div>
          <div className="admin-form-field">
            <label htmlFor={`admin-source-url-${idx}`}>Link</label>
            <input
              id={`admin-source-url-${idx}`}
              type="url"
              inputMode="url"
              value={item.url}
              onChange={(event) => updateSource(idx, 'url', event.target.value)}
              placeholder="https://..."
            />
          </div>
          <button type="button" className="pill" onClick={() => removeSource(idx)}>
            Remover
          </button>
        </div>
      ))}
      <div className="admin-actions">
        <button type="button" className="pill pill-light" onClick={addSource}>
          + Adicionar fonte
        </button>
      </div>
      <div className="admin-form-field admin-editorial-sources-bulk">
        <label htmlFor="admin-editorial-sources-bulk">Colar várias fontes de uma vez</label>
        <textarea
          id="admin-editorial-sources-bulk"
          rows={4}
          value={bulkPaste}
          onChange={(event) => setBulkPaste(event.target.value)}
          placeholder={'Instagram — https://instagram.com/douha.club\nReportagem | https://...\nhttps://link-so-url.com'}
        />
        <button type="button" className="pill" onClick={importBulkSources} disabled={!bulkPaste.trim()}>
          Organizar e adicionar fontes coladas
        </button>
      </div>
    </div>
  );
}

function EditorialMosaicTile({ post, variant = 'side' }) {
  if (!post) return null;
  const coverUrl = String(post.coverUrl || '').trim();
  const meta = [post.issue, formatEditorialDisplayDate(post) || post.date].filter(Boolean).join(' · ');
  const showDeck = variant === 'lead' && String(post.deck || '').trim();

  return (
    <Link
      to={editorialArticlePath(post.id)}
      className={`editorial-mosaic-tile editorial-mosaic-tile--${variant}`}
    >
      <div className={`editorial-mosaic-tile__visual${coverUrl ? '' : ' editorial-mosaic-tile__visual--empty'}`}>
        {coverUrl ? (
          <img src={coverUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="editorial-mosaic-tile__visual-fallback" aria-hidden="true">
            <span>{String(post.issue || 'DOUHA').trim()}</span>
          </div>
        )}
        <div className="editorial-mosaic-tile__overlay">
          <div className="editorial-mosaic-tile__meta">
            <span className="editorial-mosaic-tile__category">{editorialMosaicCategoryLabel(post)}</span>
            {meta ? <span className="editorial-mosaic-tile__issue">{meta}</span> : null}
          </div>
          <h3 className="editorial-mosaic-tile__title">{post.title}</h3>
          {showDeck ? <p className="editorial-mosaic-tile__deck">{post.deck}</p> : null}
          <span className="editorial-mosaic-tile__cta">Leia mais</span>
        </div>
      </div>
    </Link>
  );
}

function EditorialArchiveCard({ post }) {
  if (!post) return null;

  return (
    <Link to={editorialArticlePath(post.id)} className="editorial-archive-card">
      <div className="editorial-archive-card__body">
        <span className="editorial-archive-card__category">{editorialMosaicCategoryLabel(post)}</span>
        <h4 className="editorial-archive-card__title">{post.title}</h4>
        <span className="editorial-archive-card__cta">Leia mais</span>
      </div>
    </Link>
  );
}

function EditorialArticlePage({ editorialPosts }) {
  const { postId } = useParams();
  const post = useMemo(
    () => findEditorialPostById(editorialPosts, postId),
    [editorialPosts, postId],
  );

  useDocumentMeta(
    post
      ? buildEditorialArticleMeta(post)
      : { title: `Matéria | Douha Club`, description: 'Matéria não encontrada.', canonicalPath: '/editorial' },
  );

  if (!post) {
    return (
      <main>
        <section className="section">
          <div className="container editorial-article">
            <p className="about-copy">Matéria não encontrada ou não publicada.</p>
            <Link className="pill" to="/editorial">Voltar ao Editorial</Link>
          </div>
        </section>
      </main>
    );
  }

  const coverUrl = String(post.coverUrl || '').trim();
  const issueMeta = [post.source, post.issue].filter(Boolean).join(' · ');

  return (
    <main>
      <article className="section editorial-article-section editorial-article-section--reading" lang="pt-BR">
        <div className="container editorial-article editorial-article--reading">
          <Link className="editorial-article__back" to="/editorial">
            ← Editorial
          </Link>

          <header className="editorial-article__head">
            <span className="editorial-article__category">{editorialMosaicCategoryLabel(post)}</span>
            {issueMeta ? <p className="editorial-article__meta">{issueMeta}</p> : null}
            <h1 className="editorial-article__title">{post.title}</h1>
            {String(post.deck || '').trim() ? (
              <p className="editorial-article__deck">{post.deck}</p>
            ) : null}
          </header>

          <EditorialArticleByline post={post} />

          {coverUrl ? (
            <figure className="editorial-article__hero">
              <img src={coverUrl} alt="" loading="eager" decoding="async" />
            </figure>
          ) : null}

          <div className="editorial-article__body">
            <EditorialArticleBody body={post.body} />
          </div>

          <EditorialArticleReferences sources={post.sources} />
        </div>
      </article>
    </main>
  );
}

function AdminEditorialMosaicBoard({ posts, draft, onChange }) {
  const [dragOverSlot, setDragOverSlot] = useState('');

  const slotPosts = useMemo(
    () => ({
      lead: posts.find((post) => post.id === draft.leadId) || null,
      side1: posts.find((post) => post.id === draft.side1Id) || null,
      side2: posts.find((post) => post.id === draft.side2Id) || null,
    }),
    [posts, draft.leadId, draft.side1Id, draft.side2Id],
  );

  const assignedIds = useMemo(
    () => new Set([draft.leadId, draft.side1Id, draft.side2Id].filter(Boolean)),
    [draft.leadId, draft.side1Id, draft.side2Id],
  );

  const onDragStartPost = (event, postId, fromSlot = null) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      EDITORIAL_MOSAIC_DRAG_MIME,
      JSON.stringify({ postId, fromSlot }),
    );
  };

  const onDropSlot = (event, slot) => {
    event.preventDefault();
    setDragOverSlot('');
    const payload = parseEditorialMosaicDragPayload(event);
    if (!payload?.postId) return;
    onChange(assignEditorialMosaicSlot(draft, slot, payload.postId, payload.fromSlot));
  };

  const onDropPool = (event) => {
    event.preventDefault();
    const payload = parseEditorialMosaicDragPayload(event);
    if (!payload?.fromSlot) return;
    onChange(clearEditorialMosaicSlot(draft, payload.fromSlot));
  };

  const renderSlot = (slot, label, variant) => {
    const post = slotPosts[slot];
    const isOver = dragOverSlot === slot;

    return (
      <div
        key={`admin-mosaic-slot-${slot}`}
        className={`admin-mosaic-slot admin-mosaic-slot--${variant}${isOver ? ' admin-mosaic-slot--over' : ''}${post ? ' admin-mosaic-slot--filled' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOverSlot(slot);
        }}
        onDragLeave={() => setDragOverSlot('')}
        onDrop={(event) => onDropSlot(event, slot)}
      >
        <p className="admin-mosaic-slot__label">{label}</p>
        {post ? (
          <div
            className="admin-mosaic-slot__card"
            draggable
            onDragStart={(event) => onDragStartPost(event, post.id, slot)}
          >
            <AdminMosaicDragThumb post={post} />
            <p className="admin-mosaic-slot__title">{post.title}</p>
            <button
              type="button"
              className="admin-mosaic-slot__clear"
              onClick={() => onChange(clearEditorialMosaicSlot(draft, slot))}
            >
              Remover
            </button>
          </div>
        ) : (
          <p className="admin-mosaic-slot__empty">Arraste uma matéria aqui</p>
        )}
      </div>
    );
  };

  return (
    <div className="admin-mosaic-board">
      <div className="admin-mosaic-board__layout" aria-label="Layout do mosaico no site">
        {renderSlot('lead', 'Principal', 'lead')}
        <div className="admin-mosaic-board__side">
          {renderSlot('side1', 'Secundária 1', 'side')}
          {renderSlot('side2', 'Secundária 2', 'side')}
        </div>
      </div>

      <div
        className="admin-mosaic-pool"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDropPool}
      >
        <p className="admin-mosaic-pool__title">
          Matérias publicadas
          <span className="admin-mosaic-pool__hint">Arraste para o mosaico · solte aqui para tirar do mosaico</span>
        </p>
        {!posts.length ? (
          <p className="about-copy">Nenhuma matéria publicada ainda.</p>
        ) : (
          <div className="admin-mosaic-pool__grid">
            {posts.map((post) => (
              <div
                key={`admin-mosaic-pool-${post.id}`}
                className={`admin-mosaic-pool__item${assignedIds.has(post.id) ? ' admin-mosaic-pool__item--assigned' : ''}`}
                draggable
                onDragStart={(event) => onDragStartPost(event, post.id, null)}
              >
                <AdminMosaicDragThumb post={post} />
                <p>{post.title}</p>
                {assignedIds.has(post.id) ? <span className="admin-mosaic-pool__badge">No mosaico</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminMosaicDragThumb({ post }) {
  const coverUrl = String(post?.coverUrl || '').trim();
  return (
    <div className={`admin-mosaic-thumb${coverUrl ? '' : ' admin-mosaic-thumb--empty'}`}>
      {coverUrl ? <img src={coverUrl} alt="" /> : <span>{editorialMosaicCategoryLabel(post)}</span>}
    </div>
  );
}

/** Seção Editorial da Home — layout próprio (não usa editorial-news-*). */
function HomeEditorialSection({ editorialPosts }) {
  const posts = useMemo(() => getPublishedEditorialPosts(editorialPosts, 4), [editorialPosts]);
  const railIssue = posts[0]?.issue || 'ED. —';
  const railSource = posts[0]?.source || 'DOUHA CLUB';

  return (
    <section className="section editorial-home-section" aria-labelledby="editorial-home-title">
      <div className="container editorial-home">
        <header className="editorial-home-head">
          <div className="editorial-home-head__left">
            <h2 id="editorial-home-title">Editorial</h2>
            <span className="editorial-home-head__rule" aria-hidden="true" />
          </div>
          <Link className="editorial-home-open" to="/editorial">
            Abrir página
          </Link>
        </header>

        <div className="editorial-home-body">
          <div className="editorial-home-grid">
            {posts.map((post) => (
              <Link
                key={`home-editorial-${post.id}`}
                to="/editorial"
                className="editorial-home-card"
              >
                <div className="editorial-home-card__content">
                  <div className="editorial-home-kicker">
                    <span className="editorial-home-kicker__source">{post.source}</span>
                    <span className="editorial-home-kicker__meta">
                      {[post.issue, post.date].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <h3 className="editorial-home-card__chamada">{post.title}</h3>
                  {String(post.deck || '').trim() ? (
                    <p className="editorial-home-card__subtext">{post.deck}</p>
                  ) : null}
                </div>
                <span className="editorial-home-card__hover" aria-hidden="true">
                  Ler matéria completa
                </span>
              </Link>
            ))}
          </div>

          <aside className="editorial-home-rail" aria-label="Detalhe editorial">
            <p className="editorial-home-rail__label">Douha Club</p>
            <p className="editorial-home-rail__issue">{railIssue}</p>
            <p className="editorial-home-rail__line" aria-hidden="true" />
            <p className="editorial-home-rail__quote">
              Leituras de cena, cultura e comportamento noturno.
            </p>
            <p className="editorial-home-rail__tag">{railSource}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function EditorialPage({ editorialPosts, siteContent }) {
  const mosaic = useMemo(
    () => resolveEditorialMosaic(editorialPosts, siteContent),
    [editorialPosts, siteContent],
  );
  const archivePosts = useMemo(
    () => getEditorialArchivePosts(editorialPosts, siteContent),
    [editorialPosts, siteContent],
  );

  return (
    <main id="top">
      <section className="section editorial-page-section">
        <div className="container editorial-page">
          <header className="editorial-page-head">
            <p className="editorial-page-kicker">Douha Club</p>
            <h2>Editorial</h2>
          </header>

          <div className="editorial-mosaic" aria-label="Mosaico editorial">
            <div className="editorial-mosaic__lead">
              <EditorialMosaicTile post={mosaic.lead} variant="lead" />
            </div>
            <div className="editorial-mosaic__side">
              {mosaic.side.map((post) => (
                <EditorialMosaicTile key={`mosaic-side-${post.id}`} post={post} variant="side" />
              ))}
            </div>
          </div>

          {archivePosts.length ? (
            <section className="editorial-archive" aria-labelledby="editorial-archive-title">
              <div className="editorial-archive__head">
                <h3 id="editorial-archive-title">Acervo</h3>
              </div>
              <div className="editorial-archive__grid">
                {archivePosts.map((post) => (
                  <EditorialArchiveCard key={`editorial-archive-${post.id}`} post={post} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ContactChannelIcon({ id }) {
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
}

function ContactPage({ siteContent }) {
  const email = String(siteContent?.contactEmail || '').trim();
  const whatsapp = normalizeWhatsAppUrl(siteContent?.contactWhatsApp);
  const channels = [
    email
      ? {
          id: 'email',
          label: 'E-mail comercial',
          hint: 'Parcerias, booking e assuntos gerais',
          value: email,
          href: `mailto:${email}`,
          external: false,
        }
      : null,
    whatsapp
      ? {
          id: 'whatsapp',
          label: 'WhatsApp Business',
          hint: 'Canal direto para combinados e parcerias',
          value: 'Abrir conversa',
          href: whatsapp,
          external: true,
        }
      : null,
  ].filter(Boolean);

  return (
    <main className="contact-page">
      <section className="section">
        <div className="container contact-page__inner">
          <p className="eyebrow">Contato</p>
          <h1>Comercial</h1>
          <p className="contact-page__lead">
            Escolha o canal abaixo. Respondemos o mais rápido possível em dias úteis.
          </p>
          <ul className="contact-channel-list">
            {channels.map((channel) => (
              <li key={channel.id}>
                <a
                  className="contact-channel-link"
                  href={channel.href}
                  {...(channel.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  <span className={`contact-channel-icon contact-channel-icon--${channel.id}`} aria-hidden="true">
                    <ContactChannelIcon id={channel.id} />
                  </span>
                  <span className="contact-channel-copy">
                    <span className="contact-channel-label">{channel.label}</span>
                    <span className="contact-channel-hint">{channel.hint}</span>
                    <span className="contact-channel-value">{channel.value}</span>
                  </span>
                  <span className="contact-channel-arrow" aria-hidden="true">→</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="about-copy contact-lgpd-note">
            Dúvidas sobre dados pessoais:{' '}
            <Link to="/privacidade">Política de privacidade</Link>
            {email ? (
              <>
                {' '}
                ou <a href={`mailto:${email}`}>{email}</a>
              </>
            ) : null}
            .
          </p>
        </div>
      </section>
      <section className="section contact-page__faq" id="faq">
        <div className="container">
          <h2>FAQ</h2>
          <div className="faq-list">
            {faq.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <div className="faq-item-body">
                  {item.paragraphs?.map((paragraph) => (
                    <p key={`${item.q}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
                  ))}
                  {item.a ? <p>{item.a}</p> : null}
                  {item.list?.length ? (
                    <ul className="faq-item-list">
                      {item.list.map((line) => (
                        <li key={`${item.q}-${line}`}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  {item.link ? (
                    <p className="faq-item-link-wrap">
                      <a href={item.link.href} target="_blank" rel="noreferrer">
                        {item.link.label}
                      </a>
                    </p>
                  ) : null}
                </div>
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
  adminSection = 'geral',
}) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState({ date: '', time: '', lineup: '', ticketUrl: '', photosUrl: '', poster: '' });
  const [posterUrlInput, setPosterUrlInput] = useState('');
  const [draftSiteContent, setDraftSiteContent] = useState(() => mergeSiteContentWithDefaults(siteContent));
  const [draftPhotos, setDraftPhotos] = useState(() => [...sitePhotos]);
  const [draftRolePhotos, setDraftRolePhotos] = useState(() => rolePhotos.map((r) => normalizeRolePhotoEntry(r)).filter(Boolean));
  const [draftEditorial, setDraftEditorial] = useState(() => ({
    id: '',
    title: '',
    deck: '',
    body: '',
    sources: [],
    authorName: '',
    authorAvatarUrl: '',
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
  const [isUploadingExperienceCopyBannerBg, setIsUploadingExperienceCopyBannerBg] = useState(false);
  const [isUploadingSetsBannerBg, setIsUploadingSetsBannerBg] = useState(false);
  const [isUploadingRoleStageBg, setIsUploadingRoleStageBg] = useState(false);
  const [experienceCopyBannerUploadError, setExperienceCopyBannerUploadError] = useState('');
  const [setsBannerUploadError, setSetsBannerUploadError] = useState('');
  const [roleStageBgUploadError, setRoleStageBgUploadError] = useState('');
  const [isUploadingFooterLogo, setIsUploadingFooterLogo] = useState(false);
  const [footerLogoUploadError, setFooterLogoUploadError] = useState('');
  const [createSlotLabel, setCreateSlotLabel] = useState('');
  const [isSavingGallery, setIsSavingGallery] = useState(false);
  const [isSavingEditorial, setIsSavingEditorial] = useState(false);
  const [isUploadingEditorialCover, setIsUploadingEditorialCover] = useState(false);
  const [editorialCoverUploadError, setEditorialCoverUploadError] = useState('');
  const [isSavingEditorialMosaic, setIsSavingEditorialMosaic] = useState(false);
  const [editorialMosaicError, setEditorialMosaicError] = useState('');
  const [draftEditorialMosaic, setDraftEditorialMosaic] = useState(() => ({
    leadId: String(siteContent?.editorialMosaicLeadId || ''),
    side1Id: String(siteContent?.editorialMosaicSide1Id || ''),
    side2Id: String(siteContent?.editorialMosaicSide2Id || ''),
  }));
  const [isSavingRolePhotos, setIsSavingRolePhotos] = useState(false);
  const [isSavingSiteContent, setIsSavingSiteContent] = useState(false);
  const [siteContentSaveError, setSiteContentSaveError] = useState('');
  const [posterUploadError, setPosterUploadError] = useState('');
  const [posterUploadInfo, setPosterUploadInfo] = useState('');
  const formRef = useRef(null);
  const galleryUploadWideRef = useRef(false);
  const [galleryUploadWide, setGalleryUploadWide] = useState(false);
  const sortedAgenda = useMemo(() => [...agendaEvents], [agendaEvents]);
  const publishedEditorialForMosaic = useMemo(
    () => getAllPublishedEditorialPosts(editorialPosts.length ? editorialPosts : defaultEditorialPosts),
    [editorialPosts],
  );
  const isGeneralSection = adminSection === 'geral';
  const isPhotosSection = adminSection === 'fotos';
  const isEditorialSection = adminSection === 'editorial';
  const isCalendarSection = adminSection === 'calendario';
  const isReservasSection = adminSection === 'reservas';
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
    setSaveHint('Alterações salvas no site.');
    window.setTimeout(() => setSaveHint(''), 2800);
    window.alert('Salvo com sucesso.');
  };

  // Mantem rascunhos do admin sincronizados com o estado principal quando logado.
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    setDraftSiteContent(mergeSiteContentWithDefaults(siteContent));
    setDraftPhotos([...sitePhotos]);
    setDraftRolePhotos(rolePhotos.map((r) => normalizeRolePhotoEntry(r)).filter(Boolean));
    setDraftEditorialMosaic({
      leadId: String(siteContent?.editorialMosaicLeadId || ''),
      side1Id: String(siteContent?.editorialMosaicSide1Id || ''),
      side2Id: String(siteContent?.editorialMosaicSide2Id || ''),
    });
  }, [isAdminLoggedIn, siteContent, sitePhotos, rolePhotos]);

  const onLogin = async (event) => {
    event.preventDefault();
    setIsSigningIn(true);
    setAuthError('');
    try {
      await signInDouhaAdmin(emailInput, passwordInput);
      setIsAdminLoggedIn(true);
      setEmailInput('');
      setPasswordInput('');
    } catch (error) {
      setAuthError(formatAdminAuthError(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  const onLogout = async () => {
    await signOutDouhaAdmin();
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
      date: item.daté || '',
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

  const onCreateFromCalendar = ({ year, monthIndex, slotIndex }) => {
    setEditingId('');
    setDraft({ date: '', time: '', lineup: '', ticketUrl: '', photosUrl: '', poster: '' });
    setPosterUrlInput('');
    setDraftDay(1);
    setDraftMonthIndex(monthIndex);
    setDraftYear(year);
    setAgendaSaveError('');
    setPosterUploadError('');
    setPosterUploadInfo('');
    if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < MAX_EVENTS_PER_MONTH) {
      const { slotNum, row } = describeCalendarSlot(slotIndex);
      setCreateSlotLabel(`Slot ${slotNum} (linha ${row}) em ${MONTH_LABELS[monthIndex]} ${year}`);
    } else {
      setCreateSlotLabel('');
    }
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
    setCreateSlotLabel('');
  };

  const onDelete = async (id) => {
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado');
      }
      const { error } = await supabase.from(SUPABASE_EVENTS_TABLE).delete().eq('id', id);
      if (error) throw error;
      const nextAgenda = agendaEvents.filter((item) => item.id !== id);
      setAgendaEvents(nextAgenda);
      if (editingId === id) resetDraft();
      setAgendaSaveError('');
    } catch (error) {
      setAgendaSaveError(`Não foi possível excluir no Supabase: ${error.message || 'erro desconhecido'}`);
    }
  };

  const onPosterUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase não configurado para upload do poster.');
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
      const msg = error.message || 'Não foi possível preparar o poster.';
      setAgendaSaveError(msg);
      setPosterUploadError(msg);
      setPosterUploadInfo('');
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const uploadYellowBannerBackground = async (file, fieldKey, setBusy, setError) => {
    if (!file) return;
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado para upload.');
      }
      setBusy(true);
      setError('');
      const rawDataUrl = await readFileAsDataUrl(file);
      if (typeof rawDataUrl !== 'string') throw new Error('Arquivo invalido.');
      const maxWidth = fieldKey === 'setsBannerBgUrl'
        ? YELLOW_BANNER_PX.sets.width
        : fieldKey === 'rolePhotosStageBgUrl'
          ? ROLE_PHOTOS_STAGE_PX.width
          : YELLOW_BANNER_PX.experienceCopy.width;
      const compressed = await compressDataUrlImage(rawDataUrl, { maxWidth, quality: 0.86 });
      const compressedBlob = await (await fetch(String(compressed))).blob();
      const fileForUpload = new File([compressedBlob], file.name || 'faixa-amarela.jpg', {
        type: 'image/jpeg',
      });
      const publicUrl = await withTimeout(
        uploadGalleryImageToSupabaseStorage(fileForUpload),
        20000,
        'Timeout ao enviar textura da faixa (20s).',
      );
      setDraftSiteContent((prev) =>
        mergeSiteContentWithDefaults({ ...prev, [fieldKey]: String(publicUrl) }),
      );
    } catch (error) {
      setError(error.message || 'Não foi possível enviar a imagem.');
    } finally {
      setBusy(false);
    }
  };

  const onExperienceHeroUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado para upload.');
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
        'Timeout ao enviar imagem da experiência (20s).',
      );
      setExperienceHeroPreviewFailed(false);
      setDraftSiteContent((prev) =>
        mergeSiteContentWithDefaults({ ...prev, experienceHeroImageUrl: String(publicUrl) }),
      );
    } catch (error) {
      setExperienceHeroUploadError(error.message || 'Não foi possível enviar a imagem.');
    } finally {
      setIsUploadingExperienceHero(false);
    }
  };

  const onExperienceCopyBannerBgUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    await uploadYellowBannerBackground(
      file,
      'experienceCopyBannerBgUrl',
      setIsUploadingExperienceCopyBannerBg,
      setExperienceCopyBannerUploadError,
    );
  };

  const onSetsBannerBgUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    await uploadYellowBannerBackground(
      file,
      'setsBannerBgUrl',
      setIsUploadingSetsBannerBg,
      setSetsBannerUploadError,
    );
  };

  const onRoleStageBgUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    await uploadYellowBannerBackground(
      file,
      'rolePhotosStageBgUrl',
      setIsUploadingRoleStageBg,
      setRoleStageBgUploadError,
    );
  };

  const onEditorialCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado para upload.');
      }
      setIsUploadingEditorialCover(true);
      setEditorialCoverUploadError('');
      const rawDataUrl = await readFileAsDataUrl(file);
      if (typeof rawDataUrl !== 'string') throw new Error('Arquivo invalido.');
      const compressed = await compressDataUrlImage(rawDataUrl, { maxWidth: 1600, quality: 0.86 });
      const compressedBlob = await (await fetch(String(compressed))).blob();
      const fileForUpload = new File([compressedBlob], file.name || 'editorial-cover.jpg', {
        type: 'image/jpeg',
      });
      const publicUrl = await withTimeout(
        uploadEditorialCoverToSupabaseStorage(fileForUpload),
        20000,
        'Timeout ao enviar capa editorial (20s).',
      );
      setDraftEditorial((prev) => ({ ...prev, coverUrl: String(publicUrl) }));
    } catch (error) {
      setEditorialCoverUploadError(error.message || 'Não foi possível enviar a capa.');
    } finally {
      setIsUploadingEditorialCover(false);
    }
  };

  const onFooterLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado para upload.');
      }
      setIsUploadingFooterLogo(true);
      setFooterLogoUploadError('');
      const rawDataUrl = await readFileAsDataUrl(file);
      if (typeof rawDataUrl !== 'string') throw new Error('Arquivo invalido.');
      const usePng = file.type === 'image/png' || /\.png$/i.test(file.name || '');
      const compressed = await compressDataUrlImage(rawDataUrl, {
        maxWidth: FOOTER_LOGO_PX.size,
        quality: 0.92,
        format: usePng ? 'png' : 'jpeg',
      });
      const compressedBlob = await (await fetch(String(compressed))).blob();
      const fileForUpload = new File(
        [compressedBlob],
        file.name || (usePng ? 'douha-footer-logo.png' : 'douha-footer-logo.jpg'),
        { type: usePng ? 'image/png' : 'image/jpeg' },
      );
      const publicUrl = await withTimeout(
        uploadGalleryImageToSupabaseStorage(fileForUpload),
        20000,
        'Timeout ao enviar logo do rodapé (20s).',
      );
      setDraftSiteContent((prev) =>
        mergeSiteContentWithDefaults({ ...prev, footerLogoUrl: String(publicUrl) }),
      );
    } catch (error) {
      setFooterLogoUploadError(error.message || 'Não foi possível enviar a logo.');
    } finally {
      setIsUploadingFooterLogo(false);
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
    const normalizedDaté = formatAgendaDate(draftDay, draftMonthIndex, draftYear);
    const existingEvent = editingId ? agendaEvents.find((item) => item.id === editingId) : null;
    const nextItem = {
      id: editingId || `event-${Date.now()}`,
      date: normalizedDate,
      time: draft.time.trim(),
      lineup: draft.lineup.trim(),
      ticketUrl: draft.ticketUrl.trim(),
      photosUrl: draft.photosUrl.trim(),
      poster: draft.poster.trim(),
      reservationsEnabled: Boolean(existingEvent?.reservationsEnabled),
      reservationLayout: existingEvent?.reservationLayout ?? null,
    };
    if (!nextItem.daté || !nextItem.lineup) {
      setAgendaSaveError('Preencha data e lineup para salvar o evento.');
      setIsSavingEvent(false);
      return;
    }

    const targetParts = parseAgendaDateParts(normalizedDate);
    if (targetParts) {
      const inMonth = countAgendaEventsInMonth(
        agendaEvents,
        targetParts.year,
        targetParts.monthIndex,
        editingId,
      );
      if (inMonth >= MAX_EVENTS_PER_MONTH) {
        setAgendaSaveError(
          `${MONTH_LABELS[targetParts.monthIndex]} ${targetParts.year} já tem ${MAX_EVENTS_PER_MONTH} eventos (limite do calendário). Edite ou exclua um antes de adicionar outro.`,
        );
        setIsSavingEvent(false);
        return;
      }
    }

    try {
      const nextAgenda = editingId
        ? agendaEvents.map((item) => (item.id === editingId ? nextItem : item))
        : [nextItem, ...agendaEvents];

      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado');
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
      } else if (saveResult.error && isMissingReservationColumnsError(saveResult.error.message)) {
        const legacyPayload = { ...payload };
        delete legacyPayload.reservations_enabled;
        delete legacyPayload.reservation_layout;
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

  const onSaveSiteContent = async () => {
    if (isSavingSiteContent) return;
    setSiteContentSaveError('');
    const merged = mergeSiteContentWithDefaults(draftSiteContent);
    setSiteContent(merged);
    safeSetLocalStorage(SITE_CONTENT_STORAGE_KEY, JSON.stringify(merged));
    if (!isSupabaseConfigured || !supabase) {
      flashSaved();
      return;
    }
    setIsSavingSiteContent(true);
    try {
      const { error } = await supabase.from(SUPABASE_SITE_CONTENT_TABLE).upsert(
        {
          id: SUPABASE_SITE_CONTENT_ROW_ID,
          payload: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (error) throw error;
      flashSaved();
    } catch (error) {
      const msg = isMissingSiteContentTableError(error.message)
        ? 'Tabela douha_site_content ausente no Supabase. Rode no SQL Editor: supabase/migrations/004_douha_site_content.sql'
        : `Não foi possível salvar conteúdo no Supabase: ${error.message || 'erro desconhecido'}`;
      setSiteContentSaveError(msg);
    } finally {
      setIsSavingSiteContent(false);
    }
  };

  const onSaveGallery = async () => {
    setAgendaSaveError('');
    setIsSavingGallery(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado');
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
        ? 'Não foi possível salvar galeria: tabela douha_site_photos ausente no Supabase. Rode o SQL de setup novamente no projeto novo.'
        : `Não foi possível salvar galeria no Supabase: ${error.message || 'erro desconhecido'}`;
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
      sources: [],
      authorName: '',
      authorAvatarUrl: '',
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
      deck: clampEditorialDeck(post.deck),
      body: post.body || '',
      sources: normalizeEditorialSourcesList(post.sources),
      authorName: post.authorName || '',
      authorAvatarUrl: post.authorAvatarUrl || '',
      source: post.source || 'DOUHA CLUB',
      issue: post.issue || '',
      category: post.category || '',
      coverUrl: post.coverUrl || '',
      date: post.daté || '',
      isPublished: post.isPublished !== false,
    });
    setEditorialError('');
  };

  const onSwapEditorialMosaicSides = () => {
    setDraftEditorialMosaic((prev) => ({
      ...prev,
      side1Id: prev.side2Id,
      side2Id: prev.side1Id,
    }));
  };

  const onSaveEditorialMosaic = async () => {
    if (isSavingEditorialMosaic) return;
    setEditorialMosaicError('');
    const leadId = String(draftEditorialMosaic.leadId || '').trim();
    const side1Id = String(draftEditorialMosaic.side1Id || '').trim();
    const side2Id = String(draftEditorialMosaic.side2Id || '').trim();
    const ids = [leadId, side1Id, side2Id].filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      setEditorialMosaicError('Cada posição do mosaico precisa de uma matéria diferente (ou deixe vazio para preenchimento automático).');
      return;
    }
    const merged = mergeSiteContentWithDefaults({
      ...siteContent,
      editorialMosaicLeadId: leadId,
      editorialMosaicSide1Id: side1Id,
      editorialMosaicSide2Id: side2Id,
    });
    setSiteContent(merged);
    safeSetLocalStorage(SITE_CONTENT_STORAGE_KEY, JSON.stringify(merged));
    if (!isSupabaseConfigured || !supabase) {
      flashSaved();
      return;
    }
    setIsSavingEditorialMosaic(true);
    try {
      const { error } = await supabase.from(SUPABASE_SITE_CONTENT_TABLE).upsert(
        {
          id: SUPABASE_SITE_CONTENT_ROW_ID,
          payload: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (error) throw error;
      flashSaved();
    } catch (error) {
      const msg = isMissingSiteContentTableError(error.message)
        ? 'Tabela douha_site_content ausente no Supabase. Rode supabase/migrations/004_douha_site_content.sql'
        : `Não foi possível salvar mosaico editorial: ${error.message || 'erro desconhecido'}`;
      setEditorialMosaicError(msg);
    } finally {
      setIsSavingEditorialMosaic(false);
    }
  };

  const onSaveEditorial = async (event) => {
    event.preventDefault();
    if (isSavingEditorial) return;
    setEditorialError('');
    const title = String(draftEditorial.title || '').trim();
    const deck = clampEditorialDeck(draftEditorial.deck).trim();
    if (!title || !deck) {
      setEditorialError('Preencha pelo menos título e deck para salvar a matéria.');
      return;
    }
    setIsSavingEditorial(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado');
      }
      const publishDaté = String(draftEditorial.daté || '').trim();
      const nextItem = normalizeEditorialItem(
        {
          ...draftEditorial,
          id: editingEditorialId || `editorial-${Date.now()}`,
          title,
          deck,
          date: publishDate,
          publishedAt: publishDaté || null,
          updatedAt: new Date().toISOString(),
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
        : `Não foi possível salvar matéria no Supabase: ${error.message || 'erro desconhecido'}`;
      setEditorialError(msg);
    } finally {
      setIsSavingEditorial(false);
    }
  };

  const onDeleteEditorial = async (id) => {
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(supabaseConfigError || 'Supabase não configurado');
      }
      const { error } = await supabase.from(SUPABASE_EDITORIAL_TABLE).delete().eq('id', id);
      if (error) throw error;
      setEditorialPosts((prev) => prev.filter((item) => item.id !== id));
      if (editingEditorialId === id) resetEditorialDraft();
    } catch (error) {
      const msg = isMissingEditorialTableError(error.message)
        ? 'Tabela douha_editorial_posts ausente no Supabase. Rode a migration 002.'
        : `Não foi possível remover matéria: ${error.message || 'erro desconhecido'}`;
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
          setDraftRolePhotos((prev) => [{ url: reader.result }, ...prev].slice(0, 120));
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
        throw new Error(supabaseConfigError || 'Supabase não configurado');
      }
      const normalized = [];
      for (const raw of draftRolePhotos) {
        const entry = normalizeRolePhotoEntry(raw);
        if (!entry) continue;
        let { url } = entry;
        if (url.startsWith('data:')) {
          const blob = await (await fetch(url)).blob();
          const file = new File([blob], `role-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          url = await uploadRolePhotoToSupabaseStorage(file);
        }
        normalized.push({ url });
      }

      const nextUrls = new Set(normalized.map((x) => x.url));
      const removed = rolePhotos.map((r) => rolePhotoEntryUrl(r)).filter((u) => u && !nextUrls.has(u));
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
        const rows = normalized.map((item, idx) => ({
          id: `role-photo-${idx + 1}`,
          photo_url: item.url,
          position: idx,
          aspect_key: 'r34',
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
        : `Não foi possível salvar fotos do role no Supabase: ${error.message || 'erro desconhecido'}`;
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
              Acesso restrito com conta Supabase Auth (e-mail + senha). O usuário precisa ter{' '}
              <code>app_metadata.role = admin</code> no painel do Supabase.
            </p>
            <form className="admin-login-form" onSubmit={onLogin}>
              <label htmlFor="admin-email">E-mail</label>
              <input
                id="admin-email"
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="admin@douhaclub.com"
                autoComplete="username"
                required
              />
              <label htmlFor="admin-password">Senha</label>
              <input
                id="admin-password"
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="Senha do administrador"
                autoComplete="current-password"
                required
              />
              {authError && <p className="admin-error">{authError}</p>}
              <button type="submit" className="pill pill-light" disabled={isSigningIn}>
                {isSigningIn ? 'Entrando...' : 'Entrar no painel'}
              </button>
            </form>
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
            <h2>
              Admin
              {isCalendarSection ? ' · Agenda' : ''}
              {isReservasSection ? ' · Reservas' : ''}
              {isPhotosSection ? ' · Fotos' : ''}
              {isEditorialSection ? ' · Editorial' : ''}
              {isGeneralSection ? ' · Conteudo' : ''}
            </h2>
            <div className="admin-actions">
              <button type="button" className="pill" onClick={onResetAgenda}>Limpar agenda</button>
              <button type="button" className="pill pill-light" onClick={onLogout}>Sair</button>
            </div>
          </div>
          <nav className="admin-nav">
            <Link className="pill" to="/admin">Conteudo do site</Link>
            <Link className="pill" to="/admin/fotos">Fotos</Link>
            <Link className="pill" to="/admin/editorial">Materias</Link>
            <Link className="pill" to="/admin/calendario">Agenda / Calendário</Link>
            <Link className="pill" to="/admin/reservas">Reservas / Mapa</Link>
          </nav>

          {saveHint && <p className="admin-save-hint" role="status">{saveHint}</p>}
          {supabaseSetupError && <p className="admin-error">{supabaseSetupError}</p>}
          {agendaSyncError && <p className="admin-error">{agendaSyncError}</p>}

          {isGeneralSection ? <article id="admin-overview" className="admin-panel-card admin-panel-card-highlight">
            <h3>Visao geral rapida</h3>
            <div className="admin-kpi-grid">
              <div className="admin-kpi-item"><strong>{adminStats.total}</strong><span>Eventos cadastrados</span></div>
              <div className="admin-kpi-item"><strong>{adminStats.withTicket}</strong><span>Com link de ingresso</span></div>
              <div className="admin-kpi-item"><strong>{adminStats.withPhotos}</strong><span>Com link de fotos</span></div>
              <div className="admin-kpi-item"><strong>{adminStats.totalPhotos}</strong><span>Fotos na galeria</span></div>
            </div>
          </article> : null}

          {isGeneralSection ? <article id="admin-site-content" className="admin-panel-card">
            <h3>Conteudo geral do site</h3>
            <div className="admin-form">
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
              <label>WhatsApp comercial (numero ou link wa.me)</label>
              <input
                value={draftSiteContent.contactWhatsApp}
                placeholder="https://wa.me/5511999999999 ou 5511999999999"
                onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, contactWhatsApp: event.target.value }))}
              />
              <div className="admin-form-pair-row">
                <div className="admin-form-field">
                  <label htmlFor="site-newsletter-label">Newsletter (titulo)</label>
                  <input
                    id="site-newsletter-label"
                    value={draftSiteContent.communityNewsletterLabel}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityNewsletterLabel: event.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="site-newsletter-url">Newsletter (link)</label>
                  <input
                    id="site-newsletter-url"
                    value={draftSiteContent.communityNewsletterUrl}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityNewsletterUrl: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="admin-form-pair-row">
                <div className="admin-form-field">
                  <label htmlFor="site-cm-wa-label">Comunidade WhatsApp (titulo)</label>
                  <input
                    id="site-cm-wa-label"
                    value={draftSiteContent.communityWhatsAppLabel}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityWhatsAppLabel: event.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="site-cm-wa-url">Comunidade WhatsApp (numero ou link wa.me)</label>
                  <input
                    id="site-cm-wa-url"
                    placeholder="https://wa.me/5511999999999"
                    value={draftSiteContent.communityWhatsAppUrl}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityWhatsAppUrl: event.target.value }))}
                  />
                </div>
              </div>
              <div className="admin-form-pair-row">
                <div className="admin-form-field">
                  <label htmlFor="site-cm-ig-label">Comunidade Instagram (titulo)</label>
                  <input
                    id="site-cm-ig-label"
                    value={draftSiteContent.communityInstagramLabel}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityInstagramLabel: event.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="site-cm-ig-url">Comunidade Instagram (link)</label>
                  <input
                    id="site-cm-ig-url"
                    value={draftSiteContent.communityInstagramUrl}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, communityInstagramUrl: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="admin-form-pair-row">
                <div className="admin-form-field">
                  <label htmlFor="site-soc-ig-handle">Instagram (perfil @)</label>
                  <input
                    id="site-soc-ig-handle"
                    value={draftSiteContent.socialInstagramHandle}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialInstagramHandle: event.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="site-soc-ig-url">Instagram (link)</label>
                  <input
                    id="site-soc-ig-url"
                    value={draftSiteContent.socialInstagramUrl}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialInstagramUrl: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="admin-form-pair-row">
                <div className="admin-form-field">
                  <label htmlFor="site-soc-tt-handle">TikTok (perfil @)</label>
                  <input
                    id="site-soc-tt-handle"
                    value={draftSiteContent.socialTikTokHandle}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialTikTokHandle: event.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="site-soc-tt-url">TikTok (link)</label>
                  <input
                    id="site-soc-tt-url"
                    value={draftSiteContent.socialTikTokUrl}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialTikTokUrl: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="admin-form-pair-row">
                <div className="admin-form-field">
                  <label htmlFor="site-soc-sc-handle">SoundCloud (perfil @)</label>
                  <input
                    id="site-soc-sc-handle"
                    value={draftSiteContent.socialSoundCloudHandle}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialSoundCloudHandle: event.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="site-soc-sc-url">SoundCloud (link)</label>
                  <input
                    id="site-soc-sc-url"
                    value={draftSiteContent.socialSoundCloudUrl}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialSoundCloudUrl: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="admin-form-pair-row">
                <div className="admin-form-field">
                  <label htmlFor="site-soc-yt-handle">YouTube (perfil @)</label>
                  <input
                    id="site-soc-yt-handle"
                    value={draftSiteContent.socialYouTubeHandle}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialYouTubeHandle: event.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="site-soc-yt-url">YouTube (link)</label>
                  <input
                    id="site-soc-yt-url"
                    value={draftSiteContent.socialYouTubeUrl}
                    onChange={(event) => setDraftSiteContent((prev) => ({ ...prev, socialYouTubeUrl: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="admin-yellow-banners-block">
                <h4 className="admin-subheading">Faixas amarelas (2) — textura atras do texto</h4>
                <p className="about-copy">
                  São <strong>duas faixas separadas</strong> na Home. Cada uma tem seu upload. Vazio = amarelo padrão.
                  Depois de enviar as duas, clique em <strong>Salvar alterações</strong>.
                </p>
              </div>
              <article className="admin-panel-card admin-yellow-strip-card">
                <h3>Faixa 1 — Conheça a experiência Douha</h3>
                <p className="about-copy image-spec-note">{IMAGE_SPEC.experienceCopyBanner}</p>
                <div className="admin-form">
                  <label htmlFor="admin-experience-copy-banner-url">URL da textura</label>
                  <input
                    id="admin-experience-copy-banner-url"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://..."
                    value={draftSiteContent.experienceCopyBannerBgUrl ?? ''}
                    onChange={(event) => setDraftSiteContent((prev) => ({
                      ...mergeSiteContentWithDefaults(prev),
                      experienceCopyBannerBgUrl: event.target.value,
                    }))}
                  />
                  <label htmlFor="admin-experience-copy-banner-file">Enviar textura (experiência)</label>
                  <input
                    id="admin-experience-copy-banner-file"
                    type="file"
                    accept="image/*"
                    onChange={onExperienceCopyBannerBgUpload}
                    disabled={isUploadingExperienceCopyBannerBg}
                  />
                  {isUploadingExperienceCopyBannerBg ? (
                    <p className="admin-save-hint" role="status">Enviando textura da faixa experiência...</p>
                  ) : null}
                  {experienceCopyBannerUploadError ? (
                    <p className="admin-error">{experienceCopyBannerUploadError}</p>
                  ) : null}
                  {String(draftSiteContent.experienceCopyBannerBgUrl || '').trim() ? (
                    <div className="admin-yellow-banner-preview experience-highlight-copy douha-yellow-strip douha-yellow-strip--has-bg">
                      <YellowStripBg imageUrl={draftSiteContent.experienceCopyBannerBgUrl} />
                      <span>Preview faixa 1</span>
                    </div>
                  ) : null}
                </div>
              </article>
              <article className="admin-panel-card admin-yellow-strip-card">
                <h3>Faixa 2 — Sets (antes dos videos)</h3>
                <p className="about-copy image-spec-note">{IMAGE_SPEC.setsBanner}</p>
                <div className="admin-form">
                  <label htmlFor="admin-sets-banner-url">URL da textura</label>
                  <input
                    id="admin-sets-banner-url"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://..."
                    value={draftSiteContent.setsBannerBgUrl ?? ''}
                    onChange={(event) => setDraftSiteContent((prev) => ({
                      ...mergeSiteContentWithDefaults(prev),
                      setsBannerBgUrl: event.target.value,
                    }))}
                  />
                  <label htmlFor="admin-sets-banner-file">Enviar textura (Sets)</label>
                  <input
                    id="admin-sets-banner-file"
                    type="file"
                    accept="image/*"
                    onChange={onSetsBannerBgUpload}
                    disabled={isUploadingSetsBannerBg}
                  />
                  {isUploadingSetsBannerBg ? (
                    <p className="admin-save-hint" role="status">Enviando textura da faixa Sets...</p>
                  ) : null}
                  {setsBannerUploadError ? <p className="admin-error">{setsBannerUploadError}</p> : null}
                  {String(draftSiteContent.setsBannerBgUrl || '').trim() ? (
                    <div className="admin-yellow-banner-preview sets-banner douha-yellow-strip douha-yellow-strip--has-bg">
                      <YellowStripBg imageUrl={draftSiteContent.setsBannerBgUrl} />
                      <span>Preview faixa 2</span>
                    </div>
                  ) : null}
                </div>
              </article>
              <div className="admin-yellow-banners-block">
                <p className="about-copy admin-yellow-banners-save-hint">
                  Lembre de <strong>Salvar alterações</strong> no bloco de textos/links acima para gravar as duas faixas no site.
                </p>
              </div>
              {siteContentSaveError ? <p className="admin-error">{siteContentSaveError}</p> : null}
              <div className="admin-actions">
                <button type="button" className="pill pill-light" onClick={onSaveSiteContent} disabled={isSavingSiteContent}>
                  {isSavingSiteContent ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button type="button" className="pill" onClick={onResetSiteContentDraft} disabled={isSavingSiteContent}>Restaurar textos padrão</button>
              </div>
            </div>
          </article> : null}

          {isGeneralSection ? (
          <article id="admin-footer-logo" className="admin-panel-card">
            <h3>Logo do rodapé</h3>
            <p className="about-copy">
              Detalhe <strong>pequeno e redondo</strong> na mesma linha do copyright (centro). Use <strong>PNG com fundo transparente</strong>.
              Envie em <strong>PNG com fundo transparente</strong> para não aparecer o quadrado preto.
            </p>
            <p className="about-copy image-spec-note">{IMAGE_SPEC.footerLogo}</p>
            <div className="admin-form">
              <label htmlFor="admin-footer-logo-url">URL da logo</label>
              <input
                id="admin-footer-logo-url"
                type="text"
                inputMode="url"
                autoComplete="off"
                placeholder="https://..."
                value={draftSiteContent.footerLogoUrl ?? ''}
                onChange={(event) => setDraftSiteContent((prev) => ({
                  ...mergeSiteContentWithDefaults(prev),
                  footerLogoUrl: event.target.value,
                }))}
              />
              <label htmlFor="admin-footer-logo-file">Enviar logo do computador</label>
              <input
                id="admin-footer-logo-file"
                type="file"
                accept="image/png,image/webp,image/jpeg,image/*"
                onChange={onFooterLogoUpload}
                disabled={isUploadingFooterLogo}
              />
              {isUploadingFooterLogo ? (
                <p className="admin-save-hint" role="status">Enviando logo...</p>
              ) : null}
              {footerLogoUploadError ? <p className="admin-error">{footerLogoUploadError}</p> : null}
              {String(draftSiteContent.footerLogoUrl || '').trim() ? (
                <div className="admin-footer-logo-preview">
                  <p className="about-copy admin-preview-label">Preview (redonda, acima da linha do rodapé)</p>
                  <div className="footer-logo-mark">
                    <img
                      className={footerLogoImageClassName(draftSiteContent.footerLogoUrl)}
                      src={String(draftSiteContent.footerLogoUrl).trim()}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              ) : (
                <p className="about-copy admin-muted">Sem logo: nenhum bloco extra no rodapé do site.</p>
              )}
              <div className="admin-actions">
                <button type="button" className="pill pill-light" onClick={onSaveSiteContent} disabled={isSavingSiteContent}>
                  {isSavingSiteContent ? 'Salvando...' : 'Salvar logo do rodapé'}
                </button>
              </div>
            </div>
          </article>
          ) : null}

          {isPhotosSection ? (
          <article id="admin-experience-hero" className="admin-panel-card">
            <h3>Faixa acima de &quot;Conheça a experiência Douha&quot;</h3>
            <p className="about-copy">
              Salvar grava no site e no navegador.
            </p>
            <p className="about-copy">
              Proporção da arte: <strong>3:1</strong> ou <strong>5:1</strong> (paisagem). Vazio = fundo padrão.
            </p>
            <div className="admin-form">
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
                    <p className="admin-error">Não foi possível carregar esta URL. Confira o link, tente outro endereço ou use o upload.</p>
                  )}
                </div>
              ) : (
                <p className="about-copy admin-muted">Sem imagem: a Home mostra só o fundo padrão nessa faixa.</p>
              )}
              <div className="admin-actions">
                <button type="button" className="pill pill-light" onClick={onSaveSiteContent} disabled={isSavingSiteContent}>
                  {isSavingSiteContent ? 'Salvando...' : 'Salvar faixa'}
                </button>
              </div>
            </div>
          </article>
          ) : null}

          {isPhotosSection ? <article id="admin-gallery" className="admin-panel-card">
            <h3>Galeria principal (carrossel do topo + página Fotos)</h3>
            <p className="about-copy">
              As fotos daqui alimentam o carrossel inicial do site (topo) e a página de Fotos. Esta seção NAO altera a faixa de fotos do bloco pos
              &quot;Conheça a Experiência Douha&quot;.
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
          </article> : null}

          {isPhotosSection ? <article id="admin-role-photos" className="admin-panel-card">
            <h3>Fotos do role (faixa da home)</h3>
            <p className="about-copy">
              Envie imagens em proporção 3:4 (retrato) ou 4:3 (paisagem); no site todas aparecem no mesmo quadro 3:4 com recorte central (object-fit).
              A faixa rola em diagonal apos &quot;Conheça a Experiência Douha&quot;; não altera o carrossel do topo.
            </p>
            <div className="admin-role-stage-bg-block">
              <h4 className="admin-subheading">Fundo da faixa (2º plano — atras dos cards)</h4>
              <p className="about-copy image-spec-note">{IMAGE_SPEC.rolePhotosStage}</p>
              <p className="about-copy">
                Substitui o fundo bege/ilustrações padrão. Os cards <strong>FOTO</strong> continuam por cima. Vazio = visual padrão.
                Depois de enviar, use <strong>Salvar alterações</strong> em Geral ou o botao abaixo.
              </p>
              <div className="admin-form">
                <label htmlFor="admin-role-stage-bg-url">URL do fundo</label>
                <input
                  id="admin-role-stage-bg-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://..."
                  value={draftSiteContent.rolePhotosStageBgUrl ?? ''}
                  onChange={(event) => setDraftSiteContent((prev) => ({
                    ...mergeSiteContentWithDefaults(prev),
                    rolePhotosStageBgUrl: event.target.value,
                  }))}
                />
                <label htmlFor="admin-role-stage-bg-file">Enviar textura / imagem de fundo</label>
                <input
                  id="admin-role-stage-bg-file"
                  type="file"
                  accept="image/*"
                  onChange={onRoleStageBgUpload}
                  disabled={isUploadingRoleStageBg}
                />
                {isUploadingRoleStageBg ? (
                  <p className="admin-save-hint" role="status">Enviando fundo da faixa do role...</p>
                ) : null}
                {roleStageBgUploadError ? <p className="admin-error">{roleStageBgUploadError}</p> : null}
                {String(draftSiteContent.rolePhotosStageBgUrl || '').trim() ? (
                  <div
                    className="admin-role-stage-preview people-role-photos-stage role-stage--has-bg"
                    style={{
                      '--role-stage-bg-url': `url("${String(draftSiteContent.rolePhotosStageBgUrl).trim().replace(/"/g, '\\"')}")`,
                    }}
                  >
                    <span>Preview — cards FOTO ficam por cima no site</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="pill"
                  onClick={onSaveSiteContent}
                  disabled={isSavingSiteContent}
                >
                  {isSavingSiteContent ? 'Salvando...' : 'Salvar fundo no site'}
                </button>
              </div>
            </div>
            {rolePhotosError ? <p className="admin-error">{rolePhotosError}</p> : null}
            <input type="file" accept="image/*" multiple onChange={onRolePhotoUpload} />
            <div className="admin-photo-grid">
              {draftRolePhotos.map((raw, idx) => {
                const entry = normalizeRolePhotoEntry(raw) || { url: '' };
                const src = entry.url;
                return (
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
                );
              })}
            </div>
            <div className="admin-actions">
              <button type="button" className="pill pill-light" onClick={onSaveRolePhotos} disabled={isSavingRolePhotos}>
                {isSavingRolePhotos ? 'Salvando fotos do role...' : 'Salvar fotos do role'}
              </button>
            </div>
          </article> : null}

          {isEditorialSection ? <article id="admin-editorial-mosaic" className="admin-panel-card">
            <h3>Mosaico da página Editorial</h3>
            <p className="about-copy">
              Arraste as matérias publicadas para o layout fixo do site (1 principal + 2 secundárias).
              As demais ficam no <strong>Acervo</strong> na página pública. Slot vazio = preenchimento automático.
            </p>
            {editorialMosaicError ? <p className="admin-error">{editorialMosaicError}</p> : null}
            <AdminEditorialMosaicBoard
              posts={publishedEditorialForMosaic}
              draft={draftEditorialMosaic}
              onChange={setDraftEditorialMosaic}
            />
            <div className="admin-actions">
              <button type="button" className="pill" onClick={onSwapEditorialMosaicSides}>
                Trocar secundárias
              </button>
              <button
                type="button"
                className="pill pill-light"
                onClick={onSaveEditorialMosaic}
                disabled={isSavingEditorialMosaic}
              >
                {isSavingEditorialMosaic ? 'Salvando mosaico...' : 'Salvar mosaico editorial'}
              </button>
            </div>
          </article> : null}

          {isEditorialSection ? <article id="admin-editorial" className="admin-panel-card">
            <h3>Matérias / Editorial</h3>
            <p className="about-copy">
              Crie e atualize matérias. A capa aparece no site <strong>apenas no mosaico</strong> (3 posições); no acervo fica sem imagem até a página da matéria.
            </p>
            {editorialError ? <p className="admin-error">{editorialError}</p> : null}
            <form className="admin-form" onSubmit={onSaveEditorial}>
              <label>Título</label>
              <input
                value={draftEditorial.title}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Manchete da matéria"
              />
              <div className="admin-form-field">
                <label htmlFor="admin-editorial-deck">
                  Deck (subtexto na Home)
                  <span className="admin-field-limit">
                    {clampEditorialDeck(draftEditorial.deck).length}/{EDITORIAL_HOME_DECK_MAX_LENGTH}
                  </span>
                </label>
                <textarea
                  id="admin-editorial-deck"
                  value={draftEditorial.deck}
                  maxLength={EDITORIAL_HOME_DECK_MAX_LENGTH}
                  rows={3}
                  onChange={(event) =>
                    setDraftEditorial((prev) => ({
                      ...prev,
                      deck: clampEditorialDeck(event.target.value),
                    }))
                  }
                  placeholder="Linha de apoio abaixo da chamada (até 90 caracteres, aparece inteira no card)"
                />
              </div>
              <AdminEditorialBylineFields
                draft={draftEditorial}
                onChange={(patch) => setDraftEditorial((prev) => ({ ...prev, ...patch }))}
              />
              <div className="admin-form-field">
                <label htmlFor="admin-editorial-body">Texto completo</label>
                <p className="about-copy image-spec-note">
                  Enter = quebra de linha no mesmo parágrafo. Linha em branco = novo parágrafo (o site repete igual).
                  Bloco só com ## titulo, ### subtitulo ou linhas com - item = lista.
                </p>
                <textarea
                  id="admin-editorial-body"
                  value={draftEditorial.body}
                  onChange={(event) => setDraftEditorial((prev) => ({ ...prev, body: event.target.value }))}
                  rows={14}
                  placeholder="Corpo da matéria"
                />
              </div>
              <div className="admin-form-field">
                <h4 className="admin-subheading">Referências (links)</h4>
                <AdminEditorialSourcesFields
                  sources={draftEditorial.sources}
                  onChange={(sources) => setDraftEditorial((prev) => ({ ...prev, sources }))}
                />
              </div>
              <label>Rótulo editorial</label>
              <input
                value={draftEditorial.source}
                onChange={(event) => setDraftEditorial((prev) => ({ ...prev, source: event.target.value }))}
                placeholder="Ex: BOLETIM DOUHA (aparece no cabeçalho da matéria)"
              />
              <label>Edição / issue</label>
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
              <div className="admin-form-field">
                <label htmlFor="admin-editorial-cover-file">Capa da matéria (mosaico)</label>
                <p className="about-copy image-spec-note">{IMAGE_SPEC.editorialCover}</p>
                <input
                  id="admin-editorial-cover-file"
                  type="file"
                  accept="image/png,image/webp,image/jpeg,image/*"
                  onChange={onEditorialCoverUpload}
                  disabled={isUploadingEditorialCover}
                />
                {isUploadingEditorialCover ? (
                  <p className="admin-save-hint" role="status">Enviando capa...</p>
                ) : null}
                {editorialCoverUploadError ? <p className="admin-error">{editorialCoverUploadError}</p> : null}
                <label htmlFor="admin-editorial-cover-url">Ou URL da capa</label>
                <input
                  id="admin-editorial-cover-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  value={draftEditorial.coverUrl}
                  onChange={(event) => setDraftEditorial((prev) => ({ ...prev, coverUrl: event.target.value }))}
                  placeholder="https://..."
                />
                {String(draftEditorial.coverUrl || '').trim() ? (
                  <div className="admin-editorial-cover-preview">
                    <p className="admin-preview-label">Preview da capa (mosaico)</p>
                    <img
                      src={String(draftEditorial.coverUrl).trim()}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <button
                      type="button"
                      className="pill"
                      onClick={() => setDraftEditorial((prev) => ({ ...prev, coverUrl: '' }))}
                    >
                      Remover capa
                    </button>
                  </div>
                ) : null}
              </div>
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
                  {isSavingEditorial ? 'Salvando matéria...' : (editingEditorialId ? 'Salvar alterações da matéria' : 'Adicionar matéria')}
                </button>
                <button type="button" className="pill" onClick={resetEditorialDraft}>Limpar formulário</button>
              </div>
            </form>
            <div className="admin-list">
              {(editorialPosts.length ? editorialPosts : defaultEditorialPosts).map((post) => (
                <article key={`admin-editorial-${post.id}`} className="admin-list-item">
                  <div>
                    <strong>{post.title}</strong>
                    <p>{post.source} · {post.issue} · {post.daté || 'SEM DATA'}</p>
                  </div>
                  <div className="admin-actions">
                    <button type="button" className="pill" onClick={() => onEditEditorial(post)}>Editar</button>
                    <button type="button" className="pill" onClick={() => onDeleteEditorial(post.id)}>Remover</button>
                  </div>
                </article>
              ))}
            </div>
          </article> : null}

          {isReservasSection ? (
            <AdminReservasPanel agendaEvents={agendaEvents} setAgendaEvents={setAgendaEvents} />
          ) : null}

          {isCalendarSection ? <article id="admin-calendar" className="admin-panel-card">
            <h3>Calendário do Admin</h3>
            <p className="about-copy">
              Até <strong>{MAX_EVENTS_PER_MONTH} eventos por mês</strong>, ordenados pela <strong>data do evento</strong> (não pela ordem de cadastro).
              {CALENDAR_CARDS_PER_ROW} na 1ª linha; do 5º em diante na 2ª, preenchendo da esquerda para a direita.
            </p>
            <AgendaCalendarSection
              agendaEvents={sortedAgenda}
              title="CALENDÁRIO INTERNO"
              adminMode
              showEmptySlots
              onEditEvent={onEdit}
              onDeleteEvent={onDelete}
              onCreateEvent={onCreateFromCalendar}
              embedded
            />
          </article> : null}

          {isCalendarSection ? <div className="admin-actions">
            <button type="button" className="pill pill-light" onClick={() => onCreateFromCalendar({ year: draftYear, monthIndex: draftMonthIndex })}>
              Novo evento manual
            </button>
            {showEventForm ? (
              <button type="button" className="pill" onClick={() => setShowEventForm(false)}>Fechar formulário</button>
            ) : null}
          </div> : null}

          {isCalendarSection && showEventForm ? (
            <form id="admin-event-form" ref={formRef} className="admin-form" onSubmit={onSave}>
              <h3>Formulário de evento</h3>
              {createSlotLabel ? (
                <p className="admin-save-hint" role="status">{createSlotLabel}</p>
              ) : null}
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
              <small>Data final que será salva: {formatAgendaDate(draftDay, draftMonthIndex, draftYear)}</small>
              <label>Horário</label>
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
                No site público, esse link só aparece 48 horas depois do fim do dia do evento (até lá continua o link de ingresso).
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
                      : (editingId ? 'Salvar alterações' : 'Adicionar evento')}
                </button>
                <button type="button" className="pill" onClick={resetDraft}>Limpar formulário</button>
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
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [calendarFocus, setCalendarFocus] = useState(null);
  const [agendaSyncError, setAgendaSyncError] = useState('');
  const [youtubeChannelBranding, setYoutubeChannelBranding] = useState(null);

  const youtubeChannelHref = useMemo(() => {
    const fromEnv = resolveYoutubeChannelWebUrl(YOUTUBE_CHANNEL_ID);
    if (fromEnv) return fromEnv;
    return resolvePublicYoutubeChannelUrl(siteContent);
  }, [siteContent]);

  /* Branding do bloco Sets: API ou titulo via RSS (UC... + proxy). */
  useEffect(() => {
    if (!CAN_LOAD_YOUTUBE_FEED) return undefined;
    let active = true;
    (async () => {
      const data = await fetchYoutubeChannelBrandingResilient({
        apiKey: YOUTUBE_API_KEY,
        channelIdOrHandle: YOUTUBE_CHANNEL_ID,
      });
      if (active && data) setYoutubeChannelBranding(data);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadAgendaFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setAgendaSyncError(
          supabaseConfigError
            ? `Configuração Supabase inválida: ${supabaseConfigError}`
            : 'Supabase não configurado. Agenda vazia.',
        );
        setAgendaEvents([]);
        return;
      }
      try {
        const fullSelect =
          'id, date, time, lineup, poster, ticket_url, photos_url, reservations_enabled, reservation_layout, created_at';
        const firstAttempt = await supabase
          .from(SUPABASE_EVENTS_TABLE)
          .select(fullSelect)
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
        } else if (firstAttempt.error && isMissingReservationColumnsError(firstAttempt.error.message)) {
          const fallback = await supabase
            .from(SUPABASE_EVENTS_TABLE)
            .select('id, date, time, lineup, poster, ticket_url, photos_url, created_at')
            .order('created_at', { ascending: true });
          if (fallback.error) throw fallback.error;
          rowsData = fallback.data || [];
          if (active) {
            setAgendaSyncError(
              'Pré-reservas: rode supabase/migrations/007_douha_reservations.sql no Supabase.',
            );
          }
        } else if (firstAttempt.error) {
          throw firstAttempt.error;
        }
        if (!active) return;
        const mapped = Array.isArray(rowsData) ? rowsData.map((row, idx) => mapDbEventToAgendaItem(row, idx)) : [];
        setAgendaEvents(mapped);
        if (!firstAttempt.error) setAgendaSyncError('');
      } catch (error) {
        if (!active) return;
        setAgendaEvents([]);
        setAgendaSyncError(`Não foi possível carregar a agenda. Detalhe: ${error.message || 'erro desconhecido'}`);
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
        const editorialSelectWithSources =
          'id, title, deck, body, sources, source, issue, category, cover_url, published_at, is_published, position';
        const editorialSelectLegacy =
          'id, title, deck, body, source, issue, category, cover_url, published_at, is_published, position';
        const firstAttempt = await supabase
          .from(SUPABASE_EDITORIAL_TABLE)
          .select(editorialSelectWithSources)
          .order('position', { ascending: true });
        let rowsData = firstAttempt.data;
        if (firstAttempt.error && isMissingEditorialSourcesColumnError(firstAttempt.error.message)) {
          const fallback = await supabase
            .from(SUPABASE_EDITORIAL_TABLE)
            .select(editorialSelectLegacy)
            .order('position', { ascending: true });
          if (fallback.error) throw fallback.error;
          rowsData = (fallback.data || []).map((row) => ({ ...row, sources: '' }));
        } else if (firstAttempt.error) {
          throw firstAttempt.error;
        }
        if (!active) return;
        const mapped = Array.isArray(rowsData) ? rowsData.map((row, idx) => mapDbEditorialPostToItem(row, idx)) : [];
        if (mapped.length) setEditorialPosts(mapped);
      } catch (error) {
        if (!active) return;
        const msg = isMissingEditorialTableError(error.message)
          ? 'Tabela douha_editorial_posts ausente no Supabase (rode a migration 002).'
          : `Não foi possível carregar matérias do Supabase: ${error.message || error}`;
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
          .map((row) => ({
            url: String(row.photo_url || '').trim(),
          }))
          .filter((x) => x.url);
        if (!normalized.length) return;
        setRolePhotos(normalized);
        safeSetLocalStorage(ROLE_PHOTOS_STORAGE_KEY, JSON.stringify(normalized));
      } catch (error) {
        if (!active) return;
        const msg = isMissingRolePhotosTableError(error.message)
          ? 'Tabela douha_role_photos ausente no Supabase (rode a migration 002).'
          : `Não foi possível carregar fotos do role no Supabase: ${error.message || error}`;
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
          : `Não foi possível carregar galeria do Supabase: ${error.message || error}`;
        console.warn(msg);
      }
    };

    loadGalleryFromSupabase();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    const loadSiteContentFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const { data, error } = await supabase
          .from(SUPABASE_SITE_CONTENT_TABLE)
          .select('payload')
          .eq('id', SUPABASE_SITE_CONTENT_ROW_ID)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        const local = mergeSiteContentWithDefaults(loadStoredSiteContent());
        const remote = data?.payload;
        const merged = mergeSiteContentWithDefaults(
          remote && typeof remote === 'object' ? { ...local, ...remote } : local,
        );
        setSiteContent(merged);
        safeSetLocalStorage(SITE_CONTENT_STORAGE_KEY, JSON.stringify(merged));
      } catch (error) {
        if (!active) return;
        const msg = isMissingSiteContentTableError(error.message)
          ? 'Tabela douha_site_content ausente no Supabase (rode supabase/migrations/004_douha_site_content.sql).'
          : `Não foi possível carregar conteúdo do site: ${error.message || error}`;
        console.warn(msg);
      }
    };

    loadSiteContentFromSupabase();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== SITE_CONTENT_STORAGE_KEY || e.newValue == null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        setSiteContent(mergeSiteContentWithDefaults(parsed));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
    if (hasAcceptedOptionalStorage()) {
      registerServiceWorkerIfAccepted();
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return undefined;
    }
    let active = true;
    getAdminSession()
      .then((session) => {
        if (active) setIsAdminLoggedIn(Boolean(session));
      })
      .catch(() => {
        if (active) setIsAdminLoggedIn(false);
      });
    const unsubscribe = subscribeAdminAuth((session) => {
      if (active) setIsAdminLoggedIn(Boolean(session));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const onResetAgenda = async () => {
    if (!window.confirm('Apagar todos os eventos da agenda no Supabase?')) return;
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: deleteError } = await supabase.from(SUPABASE_EVENTS_TABLE).delete().neq('id', '');
        if (deleteError) throw deleteError;
      }
      setAgendaEvents([]);
      setAgendaSyncError('');
    } catch (error) {
      setAgendaSyncError(`Não foi possível limpar a agenda: ${formatAdminAuthError(error)}`);
    }
  };

  const onAdminLogout = async () => {
    await signOutDouhaAdmin();
    setIsAdminLoggedIn(false);
  };

  return (
    <BrowserRouter>
      <DocumentMeta />
      <Analytics />
      <SiteFavicon footerLogoUrl={siteContent?.footerLogoUrl} />
      <AppShell
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={onAdminLogout}
        siteContent={siteContent}
      >
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
                youtubeChannelBranding={youtubeChannelBranding}
                youtubeChannelHref={youtubeChannelHref}
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
          <Route path="/tickets" element={<Navigate to="/calendario" replace />} />
          <Route path="/fotos" element={<Navigate to="/" replace />} />
          <Route
            path="/sets"
            element={(
              <SetsPage
                siteContent={siteContent}
                youtubeChannelBranding={youtubeChannelBranding}
                youtubeChannelHref={youtubeChannelHref}
              />
            )}
          />
          <Route
            path="/editorial/:postId"
            element={<EditorialArticlePage editorialPosts={editorialPosts} />}
          />
          <Route path="/editorial" element={<EditorialPage editorialPosts={editorialPosts} siteContent={siteContent} />} />
          <Route path="/contato" element={<ContactPage siteContent={siteContent} />} />
          <Route path="/reservas" element={<ReservasPage agendaEvents={agendaEvents} />} />
          <Route path="/reservas/:eventId" element={<ReservasPage agendaEvents={agendaEvents} />} />
          <Route path="/privacidade" element={<PrivacyPolicyPage siteContent={siteContent} />} />
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
                adminSection="geral"
              />
            )}
          />
          <Route
            path="/admin/fotos"
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
                adminSection="fotos"
              />
            )}
          />
          <Route
            path="/admin/editorial"
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
                adminSection="editorial"
              />
            )}
          />
          <Route
            path="/admin/calendario"
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
                adminSection="calendario"
              />
            )}
          />
          <Route
            path="/admin/reservas"
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
                adminSection="reservas"
              />
            )}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
      <CookieConsentBanner />
    </BrowserRouter>
  );
}

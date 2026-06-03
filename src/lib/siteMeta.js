/** SEO, Open Graph e URLs canonicas do site publico. */

export const SITE_NAME = 'Douha Club';

export const DEFAULT_PAGE_TITLE = SITE_NAME;

export const FAVICON_PATH = '/favicon.png';

/** Incremente ao trocar o arquivo do favicon (quebra cache do navegador e do SW). */
export const FAVICON_VERSION = '3';

export const DEFAULT_DESCRIPTION =
  'Douha Club: agenda de eventos, sets, editorial e ingressos. Acompanhe datas, lineups e novidades da cena.';

export const OG_IMAGE_PATH = '/og-share.png';

export const TWITTER_CARD = 'summary_large_image';

const ROUTE_META = {
  '/': {
    title: DEFAULT_PAGE_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  '/quem-somos': {
    title: `Quem somos | ${SITE_NAME}`,
    description:
      'Douha Club em Maringá: curadoria musical, natureza e noites memoráveis com os melhores DJs do Brasil e do mundo.',
  },
  '/calendario': {
    title: `Calendário | ${SITE_NAME}`,
    description: 'Agenda de eventos do Douha Club: datas, horarios e lineups.',
  },
  '/agenda': {
    title: `Agenda | ${SITE_NAME}`,
    description: 'Agenda de eventos do Douha Club: datas, horarios e lineups.',
  },
  '/sets': {
    title: `Sets | ${SITE_NAME}`,
    description: 'Sets e videos do canal Douha Club no YouTube.',
  },
  '/editorial': {
    title: `Editorial | ${SITE_NAME}`,
    description: 'Reportagens, entrevistas e materias do editorial Douha Club.',
  },
  '/contato': {
    title: `Contato | ${SITE_NAME}`,
    description: 'Fale com o Douha Club: comercial, parcerias e duvidas frequentes.',
  },
  '/reservas': {
    title: `Pre-reservas | ${SITE_NAME}`,
    description: 'Pre-reserve mesa ou camarote no mapa do evento — sem pagamento no site.',
  },
  '/privacidade': {
    title: `Política de privacidade | ${SITE_NAME}`,
    description: 'Como o Douha Club trata cookies, armazenamento local e dados pessoais (LGPD).',
  },
};

export function getSiteOrigin() {
  const fromEnv = String(import.meta.env.VITE_SITE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function absoluteUrl(path) {
  const origin = getSiteOrigin();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}

export function resolveRouteMeta(pathname) {
  if (pathname.startsWith('/admin')) {
    return {
      title: `Administracao | ${SITE_NAME}`,
      description: 'Area restrita do Douha Club.',
      canonicalPath: pathname,
      noIndex: true,
    };
  }
  if (pathname.startsWith('/editorial/') && pathname !== '/editorial') {
    return {
      title: `Materia | ${SITE_NAME}`,
      description: 'Leia no editorial Douha Club.',
      canonicalPath: pathname,
    };
  }
  const base = ROUTE_META[pathname] || {
    title: DEFAULT_PAGE_TITLE,
    description: DEFAULT_DESCRIPTION,
  };
  return { ...base, canonicalPath: pathname };
}

export function buildEditorialArticleMeta(post) {
  const title = String(post?.title || '').trim();
  const deck = String(post?.deck || '').trim();
  return {
    title: title ? `${title} | ${SITE_NAME}` : `Materia | ${SITE_NAME}`,
    description: deck || DEFAULT_DESCRIPTION,
    canonicalPath: post?.id ? `/editorial/${post.id}` : '/editorial',
    ogImage: post?.coverUrl ? absoluteUrl(post.coverUrl.startsWith('/') ? post.coverUrl : `/${post.coverUrl}`) : undefined,
  };
}

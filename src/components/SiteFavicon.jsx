import { useEffect } from 'react';
import { FAVICON_PATH, FAVICON_VERSION } from '../lib/siteMeta';

export function faviconHrefWithVersion(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}v=${FAVICON_VERSION}`;
}

function applyFaviconLink(rel, href) {
  if (!href) return;
  const selector = `link[rel="${rel}"]`;
  document.querySelectorAll(selector).forEach((node) => node.remove());
  const link = document.createElement('link');
  link.setAttribute('rel', rel);
  link.setAttribute('href', href);
  if (rel === 'icon') {
    link.setAttribute('type', 'image/png');
    link.setAttribute('sizes', '32x32');
  }
  if (rel === 'apple-touch-icon') {
    link.setAttribute('sizes', '180x180');
  }
  document.head.appendChild(link);
}

/** Favicon = logo redonda (arquivo local ou URL do rodapé no admin). */
export function SiteFavicon({ footerLogoUrl }) {
  useEffect(() => {
    const fromAdmin = String(footerLogoUrl || '').trim();
    const href = faviconHrefWithVersion(fromAdmin || FAVICON_PATH);
    applyFaviconLink('icon', href);
    applyFaviconLink('shortcut icon', href);
    applyFaviconLink('apple-touch-icon', href);
  }, [footerLogoUrl]);

  return null;
}

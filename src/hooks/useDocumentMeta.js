import { useEffect } from 'react';
import {
  DEFAULT_DESCRIPTION,
  OG_IMAGE_PATH,
  SITE_NAME,
  TWITTER_CARD,
  absoluteUrl,
} from '../lib/siteMeta';

function upsertMetaByName(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaByProperty(property, content) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  if (!href) return;
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * @param {{ title: string, description?: string, canonicalPath?: string, ogImage?: string, noIndex?: boolean }} meta
 */
export function useDocumentMeta(meta) {
  const title = meta?.title || SITE_NAME;
  const description = meta?.description || DEFAULT_DESCRIPTION;
  const canonicalPath = meta?.canonicalPath || '/';
  const ogImage = meta?.ogImage || absoluteUrl(OG_IMAGE_PATH);
  const canonical = absoluteUrl(canonicalPath);
  const noIndex = Boolean(meta?.noIndex);

  useEffect(() => {
    document.title = title;
    upsertMetaByName('description', description);
    upsertMetaByName('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    upsertMetaByProperty('og:type', 'website');
    upsertMetaByProperty('og:site_name', SITE_NAME);
    upsertMetaByProperty('og:locale', 'pt_BR');
    upsertMetaByProperty('og:title', title);
    upsertMetaByProperty('og:description', description);
    upsertMetaByProperty('og:url', canonical);
    upsertMetaByProperty('og:image', ogImage);

    upsertMetaByName('twitter:card', TWITTER_CARD);
    upsertMetaByName('twitter:title', title);
    upsertMetaByName('twitter:description', description);
    upsertMetaByName('twitter:image', ogImage);

    upsertCanonical(canonical);
  }, [title, description, canonical, ogImage, noIndex]);
}

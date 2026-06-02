import { hasAcceptedOptionalStorage } from './consentStorage';

let gaMeasurementId = '';
let plausibleDomain = '';
let initialized = false;

function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    Object.entries(attrs).forEach(([key, value]) => {
      script.setAttribute(key, value);
    });
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

function initGa4(measurementId) {
  if (!measurementId || window.__douhaGaReady) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });
  window.__douhaGaReady = true;
}

function initPlausible(domain) {
  if (!domain || window.__douhaPlausibleReady) return;
  window.__douhaPlausibleReady = true;
}

export async function initAnalyticsIfConsented() {
  if (!hasAcceptedOptionalStorage() || initialized) return;

  gaMeasurementId = String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim();
  plausibleDomain = String(import.meta.env.VITE_PLAUSIBLE_DOMAIN || '').trim();

  if (!gaMeasurementId && !plausibleDomain) {
    initialized = true;
    return;
  }

  try {
    if (gaMeasurementId) {
      await loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`);
      initGa4(gaMeasurementId);
    }
    if (plausibleDomain) {
      await loadScript('https://plausible.io/js/script.js', {
        defer: 'true',
        'data-domain': plausibleDomain,
      });
      initPlausible(plausibleDomain);
    }
    initialized = true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Douha] Analytics:', err?.message || err);
    }
  }
}

export function trackPageView(pathname, title) {
  if (!hasAcceptedOptionalStorage()) return;

  const path = pathname || window.location.pathname;
  const pageTitle = title || document.title;

  if (gaMeasurementId && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: pageTitle,
      page_location: window.location.href,
    });
  }

  if (plausibleDomain && typeof window.plausible === 'function') {
    window.plausible('pageview', { u: path });
  }
}

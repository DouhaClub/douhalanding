/**
 * Service Worker: cache de assets do mesmo site apos consentimento.
 * So em producao (HTTPS); em dev o Vite nao deve registrar SW.
 */

const SW_URL = '/sw.js';

export async function registerServiceWorkerIfAccepted() {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return null;
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register(SW_URL, {
      scope: '/',
      updateViaCache: 'none',
    });
    return reg;
  } catch (err) {
    console.warn('[Douha] Service Worker nao registrado:', err?.message || err);
    return null;
  }
}

export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.unregister();
  } catch {
    /* ignore */
  }
}

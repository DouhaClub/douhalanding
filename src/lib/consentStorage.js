/**
 * Consentimento de cookies / armazenamento local (LGPD).
 * A escolha fica em localStorage (necessario para lembrar a decisao).
 */

const CONSENT_KEY = 'douha_consent_v1';

/** Subir quando mudar o texto legal ou o que o aceite habilita (ex.: novo cache). */
export const CONSENT_VERSION = 1;

/**
 * @typedef {{ v: number, choice: 'accepted' | 'rejected', at: string }} ConsentRecord
 */

/**
 * @returns {ConsentRecord | null}
 */
export function getConsentRecord() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== CONSENT_VERSION) return null;
    if (parsed.choice !== 'accepted' && parsed.choice !== 'rejected') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function needsConsentBanner() {
  return getConsentRecord() === null;
}

/**
 * @param {'accepted' | 'rejected'} choice
 */
export function saveConsentChoice(choice) {
  /** @type {ConsentRecord} */
  const record = {
    v: CONSENT_VERSION,
    choice,
    at: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  return record;
}

export function hasAcceptedOptionalStorage() {
  const r = getConsentRecord();
  return r?.choice === 'accepted';
}

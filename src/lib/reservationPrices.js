import {
  buildDefaultReservationLayout,
  DOUHA_SPOT_PACKAGES,
  enrichSpotWithPackage,
  MESA_PACKAGE,
  normalizeReservationLayout,
} from './reservations';

export const RESERVATION_PRICE_GROUP_ORDER = ['mesa', 'C1', 'C2', 'C3', 'C4', 'C5'];

export const RESERVATION_PRICE_GROUP_LABELS = {
  mesa: 'Mesas 1–14 (mesmo valor para todas)',
  C1: 'Camarote C1 — Sidestage',
  C2: 'Camarote C2',
  C3: 'Camarote C3',
  C4: 'Camarote C4',
  C5: 'Camarote C5',
};

function defaultGroupValues(groupId) {
  const pkg = groupId === 'mesa' ? MESA_PACKAGE : DOUHA_SPOT_PACKAGES[groupId];
  if (!pkg) return { priceTotal: '', priceConsumption: '', entriesIncluded: '' };
  return {
    priceTotal: String(pkg.priceTotal ?? ''),
    priceConsumption: String(pkg.priceConsumption ?? ''),
    entriesIncluded: String(pkg.entriesIncluded ?? ''),
  };
}

function resolvePriceGroupId(table) {
  if (!table || table.reservable === false || table.infoOnly) return null;
  if (table.zone === 'mesa' || /^\d+$/.test(String(table.id))) return 'mesa';
  if (RESERVATION_PRICE_GROUP_ORDER.includes(String(table.id))) return String(table.id);
  return null;
}

function parsePriceInput(value) {
  const n = Number(String(value ?? '').replace(/\./g, '').replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Valores atuais (layout do evento ou padrão global). */
export function getReservationPriceGroups(layout) {
  const normalized = normalizeReservationLayout(layout) || buildDefaultReservationLayout();
  const groups = {};

  for (const table of normalized.tables) {
    const groupId = resolvePriceGroupId(table);
    if (!groupId || groups[groupId]) continue;
    const spot = enrichSpotWithPackage(table);
    groups[groupId] = {
      priceTotal: String(spot.priceTotal ?? ''),
      priceConsumption: String(spot.priceConsumption ?? ''),
      entriesIncluded: String(spot.entriesIncluded ?? ''),
    };
  }

  for (const groupId of RESERVATION_PRICE_GROUP_ORDER) {
    if (!groups[groupId]) groups[groupId] = defaultGroupValues(groupId);
  }

  return groups;
}

/** Aplica preços editados no layout antes de salvar no Supabase. */
export function applyReservationPriceGroups(layout, groups) {
  const normalized = normalizeReservationLayout(layout) || buildDefaultReservationLayout();
  const tables = normalized.tables.map((table) => {
    const groupId = resolvePriceGroupId(table);
    if (!groupId) return table;
    const g = groups[groupId] || {};
    const priceTotal = parsePriceInput(g.priceTotal);
    const priceConsumption = parsePriceInput(g.priceConsumption);
    const entriesIncluded = parsePriceInput(g.entriesIncluded);
    if (!priceTotal) return table;
    return {
      ...table,
      priceTotal,
      priceConsumption: priceConsumption || undefined,
      entriesIncluded: entriesIncluded || undefined,
    };
  });

  return {
    ...normalized,
    tables: tables.map((table) => enrichSpotWithPackage(table)),
  };
}

export function formatPricePreview(value) {
  const n = parsePriceInput(value);
  if (!n) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

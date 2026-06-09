import { supabase, isSupabaseConfigured } from './supabaseClient';

export const SUPABASE_RESERVATIONS_TABLE = 'douha_table_reservations';

export const DOUHA_FLOOR_MAP_IMAGE = '/brand/reservation/douha-floor-map.png';

export const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

const ACTIVE_STATUSES = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];

const DOUHA_LAYOUT_WIDTH = 1024;
const DOUHA_LAYOUT_HEIGHT = 992;

const MESA_PACKAGE = {
  packageName: 'Mesa / bistrô',
  priceTotal: 500,
  priceConsumption: 290,
  entriesIncluded: 1,
  capacity: 4,
};

/** Pacotes oficiais Douha (valores e entradas por spot). */
export const DOUHA_SPOT_PACKAGES = {
  C2: {
    label: 'Camarote C2 — Sidestage ⭐️',
    packageName: 'Sidestage',
    priceTotal: 4000,
    priceConsumption: 2000,
    entriesIncluded: 10,
    capacity: 35,
    perks: ['Segurança exclusivo', 'Garçom exclusivo', 'Ao lado do palco'],
  },
  C3: {
    label: 'Camarote C3',
    packageName: 'Camarote C3',
    priceTotal: 2500,
    priceConsumption: 1500,
    entriesIncluded: 8,
    capacity: 20,
  },
  C4: {
    label: 'Camarote C4',
    packageName: 'Camarote C4',
    priceTotal: 2200,
    priceConsumption: 1200,
    entriesIncluded: 6,
    capacity: 20,
  },
  C5: {
    label: 'Camarote C5',
    packageName: 'Camarote C5',
    priceTotal: 2000,
    priceConsumption: 1000,
    entriesIncluded: 5,
    capacity: 20,
  },
  C6: {
    label: 'Camarote C6',
    packageName: 'Camarote C6',
    priceTotal: 1800,
    priceConsumption: 1000,
    entriesIncluded: 5,
    capacity: 20,
  },
  mesa: MESA_PACKAGE,
};

function formatBrl(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function spot(id, label, zone, x, y, options = {}) {
  const shape = options.shape || 'circle';
  const pkg = DOUHA_SPOT_PACKAGES[id] || (zone === 'mesa' ? MESA_PACKAGE : null);
  return {
    id,
    label: pkg?.label || label,
    zone,
    shape,
    x,
    y,
    r: options.r ?? 0.038,
    w: options.w,
    h: options.h,
    capacity: options.capacity ?? pkg?.capacity ?? (zone === 'camarote' ? 20 : 4),
    reservable: options.reservable !== false,
    packageName: options.packageName ?? pkg?.packageName,
    priceTotal: options.priceTotal ?? pkg?.priceTotal,
    priceConsumption: options.priceConsumption ?? pkg?.priceConsumption,
    entriesIncluded: options.entriesIncluded ?? pkg?.entriesIncluded,
    perks: Array.isArray(options.perks) ? options.perks : pkg?.perks,
  };
}

export function enrichSpotWithPackage(table) {
  if (!table || typeof table !== 'object') return table;
  const pkg = DOUHA_SPOT_PACKAGES[table.id] || (table.zone === 'mesa' ? MESA_PACKAGE : null);
  if (!pkg) return table;
  return {
    ...table,
    label: table.label || pkg.label || table.id,
    packageName: table.packageName ?? pkg.packageName,
    priceTotal: Number(table.priceTotal) > 0 ? Number(table.priceTotal) : pkg.priceTotal,
    priceConsumption: Number(table.priceConsumption) > 0 ? Number(table.priceConsumption) : pkg.priceConsumption,
    entriesIncluded: Number(table.entriesIncluded) > 0 ? Number(table.entriesIncluded) : pkg.entriesIncluded,
    capacity: Number(table.capacity) > 0 ? Number(table.capacity) : pkg.capacity,
    perks: Array.isArray(table.perks) && table.perks.length ? table.perks : pkg.perks,
  };
}

export function formatSpotPackageSummary(table) {
  const spot = enrichSpotWithPackage(table);
  if (!spot?.priceTotal) return '';
  const parts = [
    formatBrl(spot.priceTotal),
    spot.priceConsumption ? `${formatBrl(spot.priceConsumption)} em consumação` : null,
    spot.entriesIncluded ? `${spot.entriesIncluded} entrada${spot.entriesIncluded > 1 ? 's' : ''}` : null,
    spot.capacity ? `até ${spot.capacity} pessoas` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function formatSpotPackageNote(table) {
  const spot = enrichSpotWithPackage(table);
  const summary = formatSpotPackageSummary(spot);
  if (!summary) return '';
  const perks = Array.isArray(spot.perks) && spot.perks.length
    ? ` | Incluso: ${spot.perks.join(', ')}`
    : '';
  return `Pacote ${spot.label}: ${summary}${perks}`;
}

/**
 * Versão do layout default. Aumentar quando as coordenadas forem recalibradas,
 * para layouts antigos salvos no Supabase serem substituídos pelo novo default.
 */
export const DOUHA_LAYOUT_VERSION = 2;

const MESA_HIT_R = 0.033;

/** Mapa oficial Douha (1024×992): mesas 1–14, camarotes C2–C6 reserváveis; C1 fixo. */
export function buildDefaultReservationLayout() {
  return {
    layoutVersion: DOUHA_LAYOUT_VERSION,
    width: DOUHA_LAYOUT_WIDTH,
    height: DOUHA_LAYOUT_HEIGHT,
    backgroundImage: DOUHA_FLOOR_MAP_IMAGE,
    stage: { x: 0.27, y: 0.47, w: 0.08, h: 0.32, label: 'PALCO' },
    zones: {
      mesa: { label: 'Mesas' },
      camarote: { label: 'Camarotes' },
    },
    /* Coordenadas medidas pixel a pixel na planta douha-floor-map.png (1024×992). */
    tables: [
      spot('C1', 'Camarote C1', 'camarote', 0.185, 0.596, { shape: 'rect', w: 0.076, h: 0.19, reservable: false }),
      spot('C2', 'Camarote C2', 'camarote', 0.185, 0.335, { shape: 'rect', w: 0.076, h: 0.187 }),
      spot('C3', 'Camarote C3', 'camarote', 0.305, 0.127, { shape: 'rect', w: 0.098, h: 0.073 }),
      spot('C4', 'Camarote C4', 'camarote', 0.439, 0.127, { shape: 'rect', w: 0.12, h: 0.073 }),
      spot('C5', 'Camarote C5', 'camarote', 0.584, 0.127, { shape: 'rect', w: 0.117, h: 0.073 }),
      spot('C6', 'Camarote C6', 'camarote', 0.716, 0.127, { shape: 'rect', w: 0.098, h: 0.073 }),
      spot('1', 'Mesa 1', 'mesa', 0.41, 0.274, { r: MESA_HIT_R, capacity: 4 }),
      spot('2', 'Mesa 2', 'mesa', 0.41, 0.374, { r: MESA_HIT_R }),
      spot('3', 'Mesa 3', 'mesa', 0.41, 0.553, { r: MESA_HIT_R }),
      spot('4', 'Mesa 4', 'mesa', 0.41, 0.651, { r: MESA_HIT_R }),
      spot('5', 'Mesa 5', 'mesa', 0.51, 0.274, { r: MESA_HIT_R }),
      spot('6', 'Mesa 6', 'mesa', 0.51, 0.374, { r: MESA_HIT_R }),
      spot('7', 'Mesa 7', 'mesa', 0.51, 0.553, { r: MESA_HIT_R }),
      spot('8', 'Mesa 8', 'mesa', 0.51, 0.651, { r: MESA_HIT_R }),
      spot('9', 'Mesa 9', 'mesa', 0.614, 0.274, { r: MESA_HIT_R }),
      spot('10', 'Mesa 10', 'mesa', 0.614, 0.374, { r: MESA_HIT_R }),
      spot('11', 'Mesa 11', 'mesa', 0.614, 0.553, { r: MESA_HIT_R }),
      spot('12', 'Mesa 12', 'mesa', 0.614, 0.651, { r: MESA_HIT_R }),
      spot('13', 'Mesa 13', 'mesa', 0.71, 0.374, { r: MESA_HIT_R }),
      spot('14', 'Mesa 14', 'mesa', 0.71, 0.553, { r: MESA_HIT_R }),
    ],
  };
}

function isLegacyFloorMapLayout(raw) {
  const bg = String(raw?.backgroundImage || '');
  const missingPackages = Array.isArray(raw?.tables)
    && raw.tables.some((table) => table?.reservable !== false && !(Number(table?.priceTotal) > 0));
  const outdatedVersion = Number(raw?.layoutVersion || 0) < DOUHA_LAYOUT_VERSION;
  return (
    !bg
    || bg.includes('douha-floor-map.svg')
    || (Number(raw.width) === 1000 && Number(raw.height) === 700)
    || missingPackages
    || outdatedVersion
  );
}

export function isMissingReservationColumnsError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('reservations_enabled')
    || text.includes('reservation_layout')
    || text.includes('douha_table_reservations')
  );
}

function normalizeTableEntry(table, idx) {
  const id = String(table?.id || `table-${idx + 1}`).trim();
  if (!id) return null;
  const x = Number(table.x);
  const y = Number(table.y);
  const shape = table?.shape === 'rect' ? 'rect' : 'circle';
  const entry = {
    id,
    label: String(table?.label || id),
    zone: String(table?.zone || 'mesa'),
    shape,
    capacity: Number(table?.capacity) > 0 ? Number(table.capacity) : 4,
    reservable: table?.reservable !== false,
    x: Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5,
    y: Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : 0.5,
    r: Number(table?.r) > 0 ? Number(table.r) : 0.038,
  };
  if (shape === 'rect') {
    entry.w = Number(table?.w) > 0 ? Number(table.w) : 0.08;
    entry.h = Number(table?.h) > 0 ? Number(table.h) : 0.1;
  }
  if (table?.packageName) entry.packageName = String(table.packageName);
  if (Number(table?.priceTotal) > 0) entry.priceTotal = Number(table.priceTotal);
  if (Number(table?.priceConsumption) > 0) entry.priceConsumption = Number(table.priceConsumption);
  if (Number(table?.entriesIncluded) > 0) entry.entriesIncluded = Number(table.entriesIncluded);
  if (Array.isArray(table?.perks)) entry.perks = table.perks;
  return enrichSpotWithPackage(entry);
}

function sanitizeBlockedTableIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))];
}

/** IDs de mesas/camarotes fechados manualmente pelo admin neste evento. */
export function getBlockedTableIdSet(layout) {
  return new Set(sanitizeBlockedTableIds(layout?.blockedTableIds));
}

export function normalizeReservationLayout(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const blockedTableIds = sanitizeBlockedTableIds(raw.blockedTableIds);
  if (isLegacyFloorMapLayout(raw)) {
    const defaults = buildDefaultReservationLayout();
    return {
      ...defaults,
      zones: { ...defaults.zones, ...(raw.zones && typeof raw.zones === 'object' ? raw.zones : {}) },
      stage: raw.stage && typeof raw.stage === 'object' ? raw.stage : defaults.stage,
      blockedTableIds,
    };
  }
  const tables = Array.isArray(raw.tables)
    ? raw.tables.map((table, idx) => normalizeTableEntry(table, idx)).filter(Boolean)
    : [];
  if (!tables.length) return null;
  return {
    layoutVersion: Number(raw.layoutVersion) || DOUHA_LAYOUT_VERSION,
    width: Number(raw.width) > 0 ? Number(raw.width) : DOUHA_LAYOUT_WIDTH,
    height: Number(raw.height) > 0 ? Number(raw.height) : DOUHA_LAYOUT_HEIGHT,
    backgroundImage: String(raw.backgroundImage || '').trim() || DOUHA_FLOOR_MAP_IMAGE,
    stage: raw.stage && typeof raw.stage === 'object' ? raw.stage : undefined,
    zones: raw.zones && typeof raw.zones === 'object' ? raw.zones : {},
    tables,
    blockedTableIds,
  };
}

export function mapDbEventReservationFields(row) {
  return {
    reservationsEnabled: Boolean(row?.reservations_enabled),
    reservationLayout: normalizeReservationLayout(row?.reservation_layout),
  };
}

export function mapAgendaReservationFieldsToDb(item) {
  const layout = item?.reservationLayout ?? item?.reservation_layout;
  return {
    reservations_enabled: Boolean(item?.reservationsEnabled ?? item?.reservations_enabled),
    reservation_layout: layout && typeof layout === 'object' ? layout : null,
  };
}

/**
 * Monta o link wa.me para o WhatsApp do Douha com a mensagem de confirmação
 * da pré-reserva já preenchida (evento + lugar + pacote + nome).
 */
/** Extrai só o telefone (com DDI) de um link wa.me ou número solto do admin. */
export function extractWhatsAppPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const linkMatch = raw.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\+?(\d{8,15})/i);
  let digits = linkMatch ? linkMatch[1] : raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  /* Placeholder do conteúdo padrão = número ainda não configurado no admin. */
  if (digits === '5500000000000' || /^0+$/.test(digits.replace(/^55/, ''))) return '';
  /* Número brasileiro sem DDI (DDD + 8/9 dígitos) ganha o 55 na frente. */
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    digits = `55${digits}`;
  }
  return digits;
}

export function buildReservationWhatsAppUrl({ whatsAppUrl, event, table, guestName }) {
  const phone = extractWhatsAppPhone(whatsAppUrl);
  if (!phone) return '';

  const spot = enrichSpotWithPackage(table);
  const lines = [
    'Olá, Douha! Acabei de fazer uma pré-reserva pelo site e quero confirmar.',
    `Evento: ${formatEventReservationLabel(event)}`,
    `Lugar: ${spot?.label || table?.id || ''}`,
  ];
  const summary = formatSpotPackageSummary(spot);
  if (summary) lines.push(`Pacote: ${summary}`);
  if (guestName) lines.push(`Nome: ${String(guestName).trim()}`);
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function formatEventReservationLabel(event) {
  const parts = [event?.date, event?.lineup, event?.time].map((v) => String(v || '').trim()).filter(Boolean);
  return parts.join(' · ') || String(event?.id || 'Evento');
}

export function getOccupiedTableIds(reservations) {
  const set = new Set();
  (reservations || []).forEach((row) => {
    if (!ACTIVE_STATUSES.includes(String(row?.status || ''))) return;
    set.add(String(row.table_id || row.tableId || ''));
  });
  return set;
}

export async function fetchReservationsForEvent(eventId) {
  if (!isSupabaseConfigured || !supabase || !eventId) return [];
  const { data, error } = await supabase
    .from(SUPABASE_RESERVATIONS_TABLE)
    .select('id, event_id, table_id, status, guest_name, guest_phone, guest_email, party_size, notes, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingReservationColumnsError(error.message)) return [];
    throw error;
  }
  return data || [];
}

export async function createTableReservation({
  eventId,
  tableId,
  guestName,
  guestPhone,
  guestEmail,
  partySize,
  notes,
}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado.');
  }
  const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const { data, error } = await supabase
    .from(SUPABASE_RESERVATIONS_TABLE)
    .insert({
      id,
      event_id: String(eventId),
      table_id: String(tableId),
      status: RESERVATION_STATUS.PENDING,
      guest_name: String(guestName || '').trim(),
      guest_phone: String(guestPhone || '').trim(),
      guest_email: String(guestEmail || '').trim() || null,
      party_size: Math.max(1, Math.min(20, Number(partySize) || 2)),
      notes: String(notes || '').trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReservationStatus(reservationId, status) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado.');
  }
  const { error } = await supabase
    .from(SUPABASE_RESERVATIONS_TABLE)
    .update({ status })
    .eq('id', reservationId);
  if (error) throw error;
}

/** Cancelamento = exclusão definitiva (não acumula registro morto no banco). */
export async function deleteReservation(reservationId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado.');
  }
  const { error } = await supabase
    .from(SUPABASE_RESERVATIONS_TABLE)
    .delete()
    .eq('id', reservationId);
  if (error) throw error;
}

export async function saveEventReservationConfig(eventId, { enabled, layout }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado.');
  }
  const payload = {
    reservations_enabled: Boolean(enabled),
    reservation_layout: layout || null,
  };
  const { error } = await supabase.from('douha_events').update(payload).eq('id', eventId);
  if (error) throw error;
}

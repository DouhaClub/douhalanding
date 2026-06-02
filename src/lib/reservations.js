import { supabase, isSupabaseConfigured } from './supabaseClient';

export const SUPABASE_RESERVATIONS_TABLE = 'douha_table_reservations';

export const DOUHA_FLOOR_MAP_IMAGE = '/brand/reservation/douha-floor-map.svg';

export const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

const ACTIVE_STATUSES = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];

const DOUHA_LAYOUT_WIDTH = 1000;
const DOUHA_LAYOUT_HEIGHT = 700;

function spot(id, label, zone, x, y, options = {}) {
  const shape = options.shape || 'circle';
  return {
    id,
    label,
    zone,
    shape,
    x,
    y,
    r: options.r ?? 0.04,
    w: options.w,
    h: options.h,
    capacity: options.capacity ?? (zone === 'camarote' ? 8 : 4),
  };
}

/** Mapa oficial Douha: palco, mesas 1–14, camarotes C1–C6 (coordenadas alinhadas ao SVG). */
export function buildDefaultReservationLayout() {
  return {
    width: DOUHA_LAYOUT_WIDTH,
    height: DOUHA_LAYOUT_HEIGHT,
    backgroundImage: DOUHA_FLOOR_MAP_IMAGE,
    stage: { x: 0.103, y: 0.5, w: 0.11, h: 0.57, label: 'PALCO' },
    zones: {
      mesa: { label: 'Mesas' },
      camarote: { label: 'Camarotes' },
    },
    tables: [
      spot('C1', 'Camarote C1', 'camarote', 0.064, 0.168, { shape: 'rect', w: 0.072, h: 0.126 }),
      spot('C2', 'Camarote C2', 'camarote', 0.064, 0.325, { shape: 'rect', w: 0.072, h: 0.126 }),
      spot('C3', 'Camarote C3', 'camarote', 0.292, 0.086, { shape: 'rect', w: 0.088, h: 0.091 }),
      spot('C4', 'Camarote C4', 'camarote', 0.4, 0.086, { shape: 'rect', w: 0.088, h: 0.091 }),
      spot('C5', 'Camarote C5', 'camarote', 0.508, 0.086, { shape: 'rect', w: 0.088, h: 0.091 }),
      spot('C6', 'Camarote C6', 'camarote', 0.616, 0.086, { shape: 'rect', w: 0.088, h: 0.091 }),
      spot('1', 'Mesa 1', 'mesa', 0.3, 0.311, { r: 0.04 }),
      spot('2', 'Mesa 2', 'mesa', 0.3, 0.426, { r: 0.04 }),
      spot('3', 'Mesa 3', 'mesa', 0.3, 0.589, { r: 0.04 }),
      spot('4', 'Mesa 4', 'mesa', 0.3, 0.703, { r: 0.04 }),
      spot('5', 'Mesa 5', 'mesa', 0.42, 0.311, { r: 0.04 }),
      spot('6', 'Mesa 6', 'mesa', 0.42, 0.426, { r: 0.04 }),
      spot('7', 'Mesa 7', 'mesa', 0.42, 0.589, { r: 0.04 }),
      spot('8', 'Mesa 8', 'mesa', 0.42, 0.703, { r: 0.04 }),
      spot('9', 'Mesa 9', 'mesa', 0.54, 0.311, { r: 0.04 }),
      spot('10', 'Mesa 10', 'mesa', 0.54, 0.426, { r: 0.04 }),
      spot('11', 'Mesa 11', 'mesa', 0.54, 0.589, { r: 0.04 }),
      spot('12', 'Mesa 12', 'mesa', 0.54, 0.703, { r: 0.04 }),
      spot('13', 'Mesa 13', 'mesa', 0.66, 0.369, { r: 0.04 }),
      spot('14', 'Mesa 14', 'mesa', 0.66, 0.646, { r: 0.04 }),
    ],
  };
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
    x: Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5,
    y: Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : 0.5,
    r: Number(table?.r) > 0 ? Number(table.r) : 0.04,
  };
  if (shape === 'rect') {
    entry.w = Number(table?.w) > 0 ? Number(table.w) : 0.08;
    entry.h = Number(table?.h) > 0 ? Number(table.h) : 0.1;
  }
  return entry;
}

export function normalizeReservationLayout(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tables = Array.isArray(raw.tables)
    ? raw.tables.map((table, idx) => normalizeTableEntry(table, idx)).filter(Boolean)
    : [];
  if (!tables.length) return null;
  return {
    width: Number(raw.width) > 0 ? Number(raw.width) : DOUHA_LAYOUT_WIDTH,
    height: Number(raw.height) > 0 ? Number(raw.height) : DOUHA_LAYOUT_HEIGHT,
    backgroundImage: String(raw.backgroundImage || '').trim() || undefined,
    stage: raw.stage && typeof raw.stage === 'object' ? raw.stage : undefined,
    zones: raw.zones && typeof raw.zones === 'object' ? raw.zones : {},
    tables,
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
    throw new Error('Supabase nao configurado.');
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
    throw new Error('Supabase nao configurado.');
  }
  const { error } = await supabase
    .from(SUPABASE_RESERVATIONS_TABLE)
    .update({ status })
    .eq('id', reservationId);
  if (error) throw error;
}

export async function saveEventReservationConfig(eventId, { enabled, layout }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase nao configurado.');
  }
  const payload = {
    reservations_enabled: Boolean(enabled),
    reservation_layout: layout || null,
  };
  const { error } = await supabase.from('douha_events').update(payload).eq('id', eventId);
  if (error) throw error;
}

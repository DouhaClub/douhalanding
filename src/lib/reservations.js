import { supabase, isSupabaseConfigured } from './supabaseClient';

export const SUPABASE_RESERVATIONS_TABLE = 'douha_table_reservations';

export const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

const ACTIVE_STATUSES = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];

export function isMissingReservationColumnsError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('reservations_enabled')
    || text.includes('reservation_layout')
    || text.includes('douha_table_reservations')
  );
}

export function buildDefaultReservationLayout() {
  const tables = [];
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const n = row * 4 + col + 1;
      tables.push({
        id: `mesa-${n}`,
        label: `Mesa ${n}`,
        zone: 'mesa',
        capacity: 4,
        x: 0.11 + col * 0.2,
        y: 0.22 + row * 0.2,
        r: 0.038,
      });
    }
  }
  for (let i = 0; i < 4; i += 1) {
    tables.push({
      id: `camarote-${i + 1}`,
      label: `Camarote ${i + 1}`,
      zone: 'camarote',
      capacity: 8,
      x: 0.14 + i * 0.22,
      y: 0.72,
      r: 0.05,
    });
  }
  return {
    width: 1000,
    height: 640,
    zones: {
      mesa: { label: 'Mesas' },
      camarote: { label: 'Camarotes' },
    },
    tables,
  };
}

export function normalizeReservationLayout(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tables = Array.isArray(raw.tables)
    ? raw.tables
      .map((table, idx) => {
        const id = String(table?.id || `table-${idx + 1}`).trim();
        if (!id) return null;
        const x = Number(table.x);
        const y = Number(table.y);
        return {
          id,
          label: String(table?.label || id),
          zone: String(table?.zone || 'mesa'),
          capacity: Number(table?.capacity) > 0 ? Number(table.capacity) : 4,
          x: Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5,
          y: Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : 0.5,
          r: Number(table?.r) > 0 ? Number(table.r) : 0.04,
        };
      })
      .filter(Boolean)
    : [];
  if (!tables.length) return null;
  return {
    width: Number(raw.width) > 0 ? Number(raw.width) : 1000,
    height: Number(raw.height) > 0 ? Number(raw.height) : 640,
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

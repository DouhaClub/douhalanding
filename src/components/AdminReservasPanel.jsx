import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReservationMap } from './ReservationMap';
import {
  buildDefaultReservationLayout,
  deleteReservation,
  fetchReservationsForEvent,
  formatEventReservationLabel,
  getBlockedTableIdSet,
  getOccupiedTableIds,
  isMissingReservationColumnsError,
  normalizeReservationLayout,
  RESERVATION_STATUS,
  saveEventReservationConfig,
  updateReservationStatus,
} from '../lib/reservations';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const DEFAULT_LAYOUT = buildDefaultReservationLayout();

function parseEventDateParts(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const dotted = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) {
    const y = dotted[3].length === 2 ? 2000 + Number(dotted[3]) : Number(dotted[3]);
    return { year: y, monthIndex: Number(dotted[2]) - 1, day: Number(dotted[1]), sort: y * 10000 + Number(dotted[2]) * 100 + Number(dotted[1]) };
  }
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return {
      year: Number(iso[1]),
      monthIndex: Number(iso[2]) - 1,
      day: Number(iso[3]),
      sort: Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]),
    };
  }
  return null;
}

function compareEventsByDate(a, b) {
  const pa = parseEventDateParts(a?.date);
  const pb = parseEventDateParts(b?.date);
  if (pa && pb) return pa.sort - pb.sort || String(a.lineup || '').localeCompare(String(b.lineup || ''));
  if (pa) return -1;
  if (pb) return 1;
  return String(a.date || '').localeCompare(String(b.date || ''));
}

/** Eventos de hoje em diante (fim do dia do evento ainda não passou). */
function isUpcomingEvent(event) {
  const parsed = parseEventDateParts(event?.date);
  if (!parsed) return false;
  const end = new Date(parsed.year, parsed.monthIndex, parsed.day);
  end.setHours(23, 59, 59, 999);
  return end.getTime() >= Date.now();
}

function formatReservationError(err) {
  const msg = String(err?.message || err);
  return isMissingReservationColumnsError(msg)
    ? 'Rode supabase/migrations/007_douha_reservations.sql no Supabase.'
    : msg;
}

export function AdminReservasPanel({ agendaEvents, setAgendaEvents }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [layoutJson, setLayoutJson] = useState('');
  const [spotBusyId, setSpotBusyId] = useState('');

  const upcomingEvents = useMemo(
    () => [...(agendaEvents || [])].filter(isUpcomingEvent).sort(compareEventsByDate),
    [agendaEvents],
  );

  const activeCount = useMemo(
    () => upcomingEvents.filter((event) => event.reservationsEnabled).length,
    [upcomingEvents],
  );

  const selectedEvent = useMemo(
    () => upcomingEvents.find((event) => event.id === selectedEventId) || null,
    [upcomingEvents, selectedEventId],
  );

  useEffect(() => {
    if (selectedEventId && !upcomingEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId('');
    }
    setCheckedIds((prev) => {
      const valid = new Set(upcomingEvents.map((event) => event.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [upcomingEvents, selectedEventId]);

  const previewLayout = useMemo(() => {
    if (selectedEvent) {
      return normalizeReservationLayout(selectedEvent.reservationLayout) || DEFAULT_LAYOUT;
    }
    return DEFAULT_LAYOUT;
  }, [selectedEvent]);

  const occupiedTableIds = useMemo(() => getOccupiedTableIds(reservations), [reservations]);

  const blockedTableIds = useMemo(() => getBlockedTableIdSet(previewLayout), [previewLayout]);

  /* No preview o mapa mostra como reservado tanto reservas reais quanto spots fechados. */
  const previewOccupiedIds = useMemo(() => {
    const set = new Set(occupiedTableIds);
    blockedTableIds.forEach((id) => set.add(id));
    return set;
  }, [occupiedTableIds, blockedTableIds]);

  const reservableSpots = useMemo(
    () => (previewLayout?.tables || []).filter((table) => table.reservable !== false),
    [previewLayout],
  );

  const patchLocalEvent = useCallback((eventId, patch) => {
    setAgendaEvents((prev) => prev.map((item) => (item.id === eventId ? { ...item, ...patch } : item)));
  }, [setAgendaEvents]);

  const loadReservations = useCallback(async (eventId) => {
    if (!eventId) {
      setReservations([]);
      return;
    }
    setIsLoadingReservations(true);
    try {
      const rows = await fetchReservationsForEvent(eventId);
      setReservations(rows);
    } catch (err) {
      setError(formatReservationError(err));
      setReservations([]);
    } finally {
      setIsLoadingReservations(false);
    }
  }, []);

  useEffect(() => {
    loadReservations(selectedEventId);
  }, [selectedEventId, loadReservations]);

  useEffect(() => {
    if (!selectedEvent) {
      setLayoutJson(JSON.stringify(DEFAULT_LAYOUT, null, 2));
      return;
    }
    const layout = normalizeReservationLayout(selectedEvent.reservationLayout) || DEFAULT_LAYOUT;
    setLayoutJson(JSON.stringify(layout, null, 2));
  }, [selectedEvent]);

  const setEventBusy = (eventId, busy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  };

  const applyReservationState = async (eventIds, enabled) => {
    if (!eventIds.length) return;
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    for (const eventId of eventIds) {
      const event = (agendaEvents || []).find((item) => item.id === eventId);
      if (!event) continue;
      /* Preserva o layout do evento (incl. spots fechados); só cria default se não houver. */
      const layout = normalizeReservationLayout(event.reservationLayout) || DEFAULT_LAYOUT;
      setEventBusy(eventId, true);
      try {
        await saveEventReservationConfig(eventId, { enabled, layout });
        patchLocalEvent(eventId, {
          reservationsEnabled: enabled,
          reservationLayout: layout,
        });
      } finally {
        setEventBusy(eventId, false);
      }
    }
  };

  /** Abre/fecha uma mesa ou camarote deste evento (fechado aparece como "Reservado" no site). */
  const onToggleSpotBlocked = async (table) => {
    if (!selectedEvent) return;
    setError('');
    setHint('');
    setSpotBusyId(table.id);
    try {
      const layout = normalizeReservationLayout(selectedEvent.reservationLayout) || DEFAULT_LAYOUT;
      const blocked = getBlockedTableIdSet(layout);
      const id = String(table.id);
      if (blocked.has(id)) blocked.delete(id);
      else blocked.add(id);
      const nextLayout = { ...layout, blockedTableIds: [...blocked] };
      await saveEventReservationConfig(selectedEvent.id, {
        enabled: Boolean(selectedEvent.reservationsEnabled),
        layout: nextLayout,
      });
      patchLocalEvent(selectedEvent.id, { reservationLayout: nextLayout });
      setHint(blocked.has(id)
        ? `${table.label} fechado — aparece como "Reservado" no site.`
        : `${table.label} aberto para pré-reserva.`);
    } catch (err) {
      setError(formatReservationError(err));
    } finally {
      setSpotBusyId('');
    }
  };

  const onToggleEvent = async (event, nextEnabled) => {
    setError('');
    setHint('');
    setEventBusy(event.id, true);
    try {
      await applyReservationState([event.id], nextEnabled);
      if (!selectedEventId) setSelectedEventId(event.id);
      setHint(nextEnabled
        ? `Pré-reserva ativada: ${formatEventReservationLabel(event)}`
        : `Pré-reserva desativada: ${formatEventReservationLabel(event)}`);
      if (selectedEventId === event.id) await loadReservations(event.id);
    } catch (err) {
      setError(formatReservationError(err));
    } finally {
      setEventBusy(event.id, false);
    }
  };

  const onBulkSet = async (enabled, ids = null) => {
    const targetIds = ids || upcomingEvents.map((event) => event.id);
    if (!targetIds.length) return;
    if (!enabled && !window.confirm(`Desativar pré-reserva em ${targetIds.length} evento(s)?`)) return;

    setIsBulkSaving(true);
    setError('');
    setHint('');
    try {
      await applyReservationState(targetIds, enabled);
      setHint(enabled
        ? `Pré-reserva ativada em ${targetIds.length} evento(s).`
        : `Pré-reserva desativada em ${targetIds.length} evento(s).`);
      if (selectedEventId) await loadReservations(selectedEventId);
    } catch (err) {
      setError(formatReservationError(err));
    } finally {
      setIsBulkSaving(false);
    }
  };

  const onToggleChecked = (eventId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const onToggleAllChecked = () => {
    if (checkedIds.size === upcomingEvents.length) {
      setCheckedIds(new Set());
      return;
    }
    setCheckedIds(new Set(upcomingEvents.map((event) => event.id)));
  };

  const onSaveAdvancedLayout = async () => {
    if (!selectedEvent) return;
    setIsBulkSaving(true);
    setError('');
    setHint('');
    try {
      const parsed = JSON.parse(layoutJson);
      const layout = normalizeReservationLayout(parsed);
      if (!layout) throw new Error('JSON do mapa inválido ou sem mesas.');
      await saveEventReservationConfig(selectedEvent.id, { enabled: true, layout });
      patchLocalEvent(selectedEvent.id, { reservationsEnabled: true, reservationLayout: layout });
      setHint('Mapa avançado salvo e ativado.');
    } catch (err) {
      setError(formatReservationError(err));
    } finally {
      setIsBulkSaving(false);
    }
  };

  const onSetStatus = async (reservationId, status) => {
    setError('');
    try {
      await updateReservationStatus(reservationId, status);
      await loadReservations(selectedEventId);
      setHint('Status da pré-reserva atualizado.');
    } catch (err) {
      setError(formatReservationError(err));
    }
  };

  /** Cancelar = excluir de vez (libera a mesa e não deixa registro morto). */
  const onCancelReservation = async (row) => {
    if (!window.confirm(`Cancelar e excluir a pré-reserva de ${row.guest_name} (${row.table_id})? A mesa volta a ficar disponível.`)) return;
    setError('');
    try {
      await deleteReservation(row.id);
      await loadReservations(selectedEventId);
      setHint('Pré-reserva cancelada e excluída — o lugar voltou a ficar disponível.');
    } catch (err) {
      setError(formatReservationError(err));
    }
  };

  const checkedCount = checkedIds.size;
  const previewTitle = selectedEvent
    ? formatEventReservationLabel(selectedEvent)
    : 'Mapa padrão Douha (mesas 1–14 + camarotes C1–C5)';

  return (
    <>
      <article className="admin-panel-card admin-res-preview-card">
        <div className="admin-res-preview-head">
          <div>
            <h3>Preview do mapa</h3>
            <p className="about-copy admin-muted">{previewTitle}</p>
          </div>
          {selectedEvent?.reservationsEnabled ? (
            <Link className="pill pill-light" to={`/reservas/${selectedEvent.id}`} target="_blank" rel="noopener noreferrer">
              Ver no site
            </Link>
          ) : null}
        </div>
        <ReservationMap
          layout={previewLayout}
          occupiedTableIds={previewOccupiedIds}
          preview
          hint="Áreas clicáveis invisíveis sobre a planta. Spots fechados ou com pré-reserva aparecem como reservados no site."
        />
      </article>

      <article className="admin-panel-card">
        <div className="admin-res-toolbar">
          <div>
            <h3>Pré-reserva por evento</h3>
            <p className="about-copy admin-muted">
              {activeCount} de {upcomingEvents.length} evento(s) futuros com pré-reserva aberta. Eventos já realizados não aparecem aqui.
            </p>
          </div>
          <div className="admin-actions admin-res-bulk-actions">
            <button
              type="button"
              className="pill pill-light"
              disabled={isBulkSaving || !upcomingEvents.length}
              onClick={() => onBulkSet(true)}
            >
              Ativar todos (futuros)
            </button>
            <button
              type="button"
              className="pill"
              disabled={isBulkSaving || !upcomingEvents.length}
              onClick={() => onBulkSet(false)}
            >
              Desativar todos (futuros)
            </button>
            {checkedCount > 0 ? (
              <>
                <button
                  type="button"
                  className="pill pill-light"
                  disabled={isBulkSaving}
                  onClick={() => onBulkSet(true, [...checkedIds])}
                >
                  Ativar selecionados ({checkedCount})
                </button>
                <button
                  type="button"
                  className="pill"
                  disabled={isBulkSaving}
                  onClick={() => onBulkSet(false, [...checkedIds])}
                >
                  Desativar selecionados
                </button>
              </>
            ) : null}
          </div>
        </div>

        {!upcomingEvents.length ? (
          <p className="about-copy admin-muted">Nenhum evento futuro na agenda. Cadastre datas em Agenda / Calendário.</p>
        ) : (
          <div className="admin-res-events-table-wrap">
            <table className="admin-res-events-table">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os eventos"
                      checked={checkedIds.size === upcomingEvents.length && upcomingEvents.length > 0}
                      onChange={onToggleAllChecked}
                    />
                  </th>
                  <th scope="col">Evento</th>
                  <th scope="col">Pré-reserva</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {upcomingEvents.map((event) => {
                  const isSelected = selectedEventId === event.id;
                  const isBusy = busyIds.has(event.id) || isBulkSaving;
                  return (
                    <tr
                      key={event.id}
                      className={`admin-res-event-row${isSelected ? ' is-selected' : ''}${event.reservationsEnabled ? ' is-active' : ''}`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${formatEventReservationLabel(event)}`}
                          checked={checkedIds.has(event.id)}
                          onChange={() => onToggleChecked(event.id)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-res-event-select"
                          onClick={() => setSelectedEventId(event.id)}
                        >
                          <strong>{event.date || 'Sem data'}</strong>
                          <span>{event.lineup || 'Sem lineup'}</span>
                          {event.time ? <small>{event.time}</small> : null}
                        </button>
                      </td>
                      <td>
                        <label className="admin-res-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(event.reservationsEnabled)}
                            disabled={isBusy}
                            onChange={(e) => onToggleEvent(event, e.target.checked)}
                          />
                          <span className="admin-res-toggle-ui" aria-hidden="true" />
                          <span className="admin-res-toggle-label">
                            {isBusy ? 'Salvando...' : event.reservationsEnabled ? 'Aberta' : 'Fechada'}
                          </span>
                        </label>
                      </td>
                      <td>
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="pill"
                            onClick={() => setSelectedEventId(event.id)}
                          >
                            Ver mapa
                          </button>
                          {event.reservationsEnabled ? (
                            <Link className="pill pill-light" to={`/reservas/${event.id}`} target="_blank" rel="noopener noreferrer">
                              Abrir /reservas
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {selectedEvent ? (
        <article className="admin-panel-card">
          <h3>Abrir / fechar mesas e camarotes</h3>
          <p className="about-copy admin-muted">
            {formatEventReservationLabel(selectedEvent)} — spot <strong>fechado</strong> aparece como
            {' '}<strong>"Reservado"</strong> quando o público passa o mouse no mapa.
          </p>
          <div className="admin-res-spots-grid">
            {reservableSpots.map((table) => {
              const hasGuestReservation = occupiedTableIds.has(table.id);
              const isClosed = blockedTableIds.has(table.id);
              const isSaving = spotBusyId === table.id;
              const statusLabel = isSaving
                ? 'Salvando...'
                : hasGuestReservation
                  ? 'Pré-reserva de cliente'
                  : isClosed ? 'Fechado' : 'Aberto';
              return (
                <button
                  key={table.id}
                  type="button"
                  className={`admin-res-spot${isClosed ? ' is-closed' : ''}${hasGuestReservation ? ' is-guest' : ''}`}
                  disabled={isSaving || hasGuestReservation}
                  title={hasGuestReservation
                    ? 'Há pré-reserva de cliente — gerencie na lista abaixo.'
                    : isClosed ? 'Clique para abrir' : 'Clique para fechar'}
                  onClick={() => onToggleSpotBlocked(table)}
                >
                  <strong>{table.label.replace(/^(Mesa|Camarote)\s*/i, '').replace(/\s*—.*$/, '')}</strong>
                  <span>{statusLabel}</span>
                </button>
              );
            })}
          </div>
          <p className="about-copy admin-muted admin-res-spots-note">
            Spots com pré-reserva de cliente já contam como reservados — confirme ou cancele na lista abaixo.
          </p>
        </article>
      ) : null}

      {selectedEvent ? (
        <article className="admin-panel-card">
          <h3>Pré-reservas recebidas</h3>
          <p className="about-copy admin-muted">{formatEventReservationLabel(selectedEvent)}</p>
          {isLoadingReservations ? <p className="admin-save-hint">Carregando...</p> : null}
          {!reservations.length && !isLoadingReservations ? (
            <p className="about-copy admin-muted">Nenhuma pré-reserva neste evento ainda.</p>
          ) : (
            <ul className="admin-res-list">
              {reservations.map((row) => (
                <li key={row.id} className={`admin-res-item admin-res-item--${row.status}`}>
                  <div>
                    <strong>{row.guest_name}</strong>
                    <span className="admin-res-meta">
                      {row.table_id} · {row.party_size} pessoas · {row.guest_phone}
                    </span>
                    {row.notes ? <p className="about-copy">{row.notes}</p> : null}
                    <span className="admin-res-status">{row.status}</span>
                  </div>
                  <div className="admin-actions">
                    {row.status !== RESERVATION_STATUS.CONFIRMED ? (
                      <button
                        type="button"
                        className="pill pill-light"
                        onClick={() => onSetStatus(row.id, RESERVATION_STATUS.CONFIRMED)}
                      >
                        Confirmar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="pill"
                      onClick={() => onCancelReservation(row)}
                    >
                      {row.status === RESERVATION_STATUS.CANCELLED ? 'Excluir' : 'Cancelar'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      <details
        className="admin-panel-card admin-res-advanced"
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced(e.target.open)}
      >
        <summary>Ajustes avançados do mapa (JSON)</summary>
        <p className="about-copy admin-muted">
          Só use se precisar mudar coordenadas manualmente. O mapa padrão já vem pronto ao ativar a pré-reserva.
        </p>
        {selectedEvent ? (
          <div className="admin-form">
            <label htmlFor="admin-res-layout-json">Layout — {formatEventReservationLabel(selectedEvent)}</label>
            <textarea
              id="admin-res-layout-json"
              className="admin-res-layout-json"
              rows={12}
              value={layoutJson}
              onChange={(e) => setLayoutJson(e.target.value)}
            />
            <div className="admin-actions">
              <button type="button" className="pill" onClick={() => setLayoutJson(JSON.stringify(DEFAULT_LAYOUT, null, 2))}>
                Restaurar mapa padrão
              </button>
              <button type="button" className="pill pill-light" onClick={onSaveAdvancedLayout} disabled={isBulkSaving}>
                Salvar JSON e ativar
              </button>
            </div>
          </div>
        ) : (
          <p className="about-copy admin-muted">Selecione um evento na tabela para editar o JSON.</p>
        )}
      </details>

      {hint ? <p className="admin-save-hint" role="status">{hint}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
    </>
  );
}

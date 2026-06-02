import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildDefaultReservationLayout,
  fetchReservationsForEvent,
  formatEventReservationLabel,
  isMissingReservationColumnsError,
  normalizeReservationLayout,
  RESERVATION_STATUS,
  saveEventReservationConfig,
  updateReservationStatus,
} from '../lib/reservations';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export function AdminReservasPanel({ agendaEvents, setAgendaEvents }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [layoutJson, setLayoutJson] = useState('');
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedEvent = useMemo(
    () => agendaEvents.find((event) => event.id === selectedEventId) || null,
    [agendaEvents, selectedEventId],
  );

  const syncLayoutEditor = useCallback((event) => {
    const layout = normalizeReservationLayout(event?.reservationLayout) || buildDefaultReservationLayout();
    setLayoutJson(JSON.stringify(layout, null, 2));
  }, []);

  const loadReservations = useCallback(async (eventId) => {
    if (!eventId) {
      setReservations([]);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const rows = await fetchReservationsForEvent(eventId);
      setReservations(rows);
    } catch (err) {
      setError(String(err?.message || err));
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEvent) syncLayoutEditor(selectedEvent);
    loadReservations(selectedEventId);
  }, [selectedEvent, selectedEventId, syncLayoutEditor, loadReservations]);

  const patchLocalEvent = (eventId, patch) => {
    setAgendaEvents((prev) => prev.map((item) => (item.id === eventId ? { ...item, ...patch } : item)));
  };

  const onApplyDefaultLayout = () => {
    setLayoutJson(JSON.stringify(buildDefaultReservationLayout(), null, 2));
  };

  const onSaveConfig = async () => {
    if (!selectedEvent) return;
    setIsSaving(true);
    setError('');
    setHint('');
    let layout = null;
    try {
      layout = JSON.parse(layoutJson);
      layout = normalizeReservationLayout(layout);
      if (!layout) throw new Error('JSON do mapa invalido ou sem mesas.');
    } catch (err) {
      setError(String(err?.message || 'JSON invalido'));
      setIsSaving(false);
      return;
    }
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase nao configurado.');
      await saveEventReservationConfig(selectedEvent.id, {
        enabled: true,
        layout,
      });
      patchLocalEvent(selectedEvent.id, {
        reservationsEnabled: true,
        reservationLayout: layout,
      });
      setHint('Mapa salvo e reservas ativadas para este evento.');
    } catch (err) {
      const msg = String(err?.message || err);
      setError(
        isMissingReservationColumnsError(msg)
          ? 'Rode supabase/migrations/007_douha_reservations.sql no Supabase.'
          : msg,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onDisableReservations = async () => {
    if (!selectedEvent || !window.confirm('Desativar pre-reservas neste evento?')) return;
    setIsSaving(true);
    setError('');
    try {
      await saveEventReservationConfig(selectedEvent.id, { enabled: false, layout: selectedEvent.reservationLayout });
      patchLocalEvent(selectedEvent.id, { reservationsEnabled: false });
      setHint('Pre-reservas desativadas.');
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const onSetStatus = async (reservationId, status) => {
    setError('');
    try {
      await updateReservationStatus(reservationId, status);
      await loadReservations(selectedEventId);
      setHint('Status atualizado.');
    } catch (err) {
      setError(String(err?.message || err));
    }
  };

  return (
    <>
      <article className="admin-panel-card">
        <h3>Mapa por evento</h3>
        <p className="about-copy">
          Ative o mapa no evento e publique. Visitantes acessam em /reservas.
        </p>
        <div className="admin-form">
          <label htmlFor="admin-res-event">Evento</label>
          <select
            id="admin-res-event"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">Selecione</option>
            {agendaEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {formatEventReservationLabel(event)}
                {event.reservationsEnabled ? ' (ativo)' : ''}
              </option>
            ))}
          </select>
          {selectedEvent ? (
            <>
              <p className="about-copy admin-muted">
                Status: {selectedEvent.reservationsEnabled ? 'Reservas ativas' : 'Reservas desativadas'}
              </p>
              <label htmlFor="admin-res-layout-json">Layout do mapa (JSON)</label>
              <textarea
                id="admin-res-layout-json"
                className="admin-res-layout-json"
                rows={14}
                value={layoutJson}
                onChange={(e) => setLayoutJson(e.target.value)}
              />
              <div className="admin-actions">
                <button type="button" className="pill" onClick={onApplyDefaultLayout}>
                  Mapa padrao (12 mesas + 4 camarotes)
                </button>
                <button type="button" className="pill pill-light" onClick={onSaveConfig} disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar mapa e ativar'}
                </button>
                <button type="button" className="pill" onClick={onDisableReservations} disabled={isSaving}>
                  Desativar reservas
                </button>
              </div>
            </>
          ) : null}
        </div>
      </article>

      {selectedEvent ? (
        <article className="admin-panel-card">
          <h3>Pre-reservas recebidas</h3>
          {isLoading ? <p className="admin-save-hint">Carregando...</p> : null}
          {!reservations.length && !isLoading ? (
            <p className="about-copy admin-muted">Nenhuma pre-reserva ainda.</p>
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
                    {row.status !== RESERVATION_STATUS.CANCELLED ? (
                      <button
                        type="button"
                        className="pill"
                        onClick={() => onSetStatus(row.id, RESERVATION_STATUS.CANCELLED)}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      {hint ? <p className="admin-save-hint" role="status">{hint}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
    </>
  );
}

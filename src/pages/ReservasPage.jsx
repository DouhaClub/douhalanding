import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ReservationMap } from '../components/ReservationMap';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  buildDefaultReservationLayout,
  createTableReservation,
  fetchReservationsForEvent,
  formatEventReservationLabel,
  getOccupiedTableIds,
  isMissingReservationColumnsError,
  normalizeReservationLayout,
} from '../lib/reservations';
import { isSupabaseConfigured } from '../lib/supabaseClient';

function parseEventDateParts(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const dotted = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) {
    const y = dotted[3].length === 2 ? 2000 + Number(dotted[3]) : Number(dotted[3]);
    return new Date(y, Number(dotted[2]) - 1, Number(dotted[1]));
  }
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

function isEventStillBookable(event) {
  const parsed = parseEventDateParts(event?.date);
  if (!parsed) return true;
  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);
  return end.getTime() >= Date.now();
}

export function ReservasPage({ agendaEvents }) {
  const { eventId: routeEventId } = useParams();
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState(routeEventId || '');
  const [reservations, setReservations] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useDocumentMeta({
    title: 'Pre-reservas | Douha Club',
    description: 'Escolha mesa ou camarote e faca sua pre-reserva para o evento.',
  });

  const bookableEvents = useMemo(
    () => (agendaEvents || []).filter(
      (event) => event.reservationsEnabled && isEventStillBookable(event),
    ),
    [agendaEvents],
  );

  const activeEvent = useMemo(
    () => bookableEvents.find((event) => event.id === selectedEventId) || null,
    [bookableEvents, selectedEventId],
  );

  const layout = useMemo(() => {
    const fromEvent = normalizeReservationLayout(activeEvent?.reservationLayout);
    return fromEvent || buildDefaultReservationLayout();
  }, [activeEvent?.reservationLayout]);

  const occupiedTableIds = useMemo(() => getOccupiedTableIds(reservations), [reservations]);

  const refreshReservations = useCallback(async (eventId) => {
    if (!eventId || !isSupabaseConfigured) {
      setReservations([]);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const rows = await fetchReservationsForEvent(eventId);
      setReservations(rows);
    } catch (error) {
      const msg = String(error?.message || error);
      setLoadError(
        isMissingReservationColumnsError(msg)
          ? 'Pre-reservas ainda nao configuradas no Supabase. Rode supabase/migrations/007_douha_reservations.sql'
          : `Nao foi possivel carregar reservas: ${msg}`,
      );
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (routeEventId) setSelectedEventId(routeEventId);
  }, [routeEventId]);

  useEffect(() => {
    if (!selectedEventId && bookableEvents.length === 1) {
      setSelectedEventId(bookableEvents[0].id);
    }
  }, [bookableEvents, selectedEventId]);

  useEffect(() => {
    if (selectedEventId) {
      refreshReservations(selectedEventId);
      setSelectedTable(null);
      setSuccessMessage('');
    }
  }, [selectedEventId, refreshReservations]);

  const onEventChange = (nextId) => {
    setSelectedEventId(nextId);
    setSelectedTable(null);
    setSuccessMessage('');
    if (nextId) navigate(`/reservas/${nextId}`, { replace: true });
    else navigate('/reservas', { replace: true });
  };

  const onSubmitReservation = async (event) => {
    event.preventDefault();
    if (!activeEvent || !selectedTable) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await createTableReservation({
        eventId: activeEvent.id,
        tableId: selectedTable.id,
        guestName,
        guestPhone,
        guestEmail,
        partySize,
        notes,
      });
      setSuccessMessage(
        `Pre-reserva enviada para ${selectedTable.label}. Nossa equipe confirma pelo WhatsApp em breve — sem pagamento neste site.`,
      );
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
      setNotes('');
      setPartySize(2);
      setSelectedTable(null);
      await refreshReservations(activeEvent.id);
    } catch (error) {
      const msg = String(error?.message || error);
      if (msg.includes('duplicate key') || msg.includes('unique')) {
        setSubmitError('Esta mesa acabou de ser reservada. Escolha outra.');
        await refreshReservations(activeEvent.id);
      } else {
        setSubmitError(msg || 'Nao foi possivel enviar a pre-reserva.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="reservas-page">
      <section className="section">
        <div className="container reservas-page__inner">
          <p className="eyebrow">Reservas</p>
          <h1>Pre-reserva de mesa</h1>
          <p className="reservas-page__lead">
            Escolha o evento, clique em uma mesa ou camarote disponivel e envie seus dados.
            Sem pagamento aqui — confirmamos com voce depois.
          </p>

          {bookableEvents.length === 0 ? (
            <div className="reservas-empty">
              <p className="about-copy">
                Nenhum evento com mapa de reservas aberto no momento.
                Confira o <Link to="/calendario">calendario</Link> ou fale no <Link to="/contato">contato</Link>.
              </p>
            </div>
          ) : (
            <>
              <label className="reservas-event-picker" htmlFor="reservas-event-select">
                Evento
                <select
                  id="reservas-event-select"
                  value={selectedEventId}
                  onChange={(e) => onEventChange(e.target.value)}
                >
                  <option value="">Selecione o evento</option>
                  {bookableEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {formatEventReservationLabel(event)}
                    </option>
                  ))}
                </select>
              </label>

              {activeEvent ? (
                <>
                  <div className="reservas-event-head">
                    <h2>{formatEventReservationLabel(activeEvent)}</h2>
                    {isLoading ? <p className="admin-save-hint" role="status">Atualizando mapa...</p> : null}
                    {loadError ? <p className="admin-error">{loadError}</p> : null}
                  </div>

                  <ReservationMap
                    layout={layout}
                    occupiedTableIds={occupiedTableIds}
                    selectedTableId={selectedTable?.id}
                    onSelectTable={(table) => {
                      setSelectedTable(table);
                      setSubmitError('');
                      setSuccessMessage('');
                    }}
                  />

                  {successMessage ? (
                    <p className="reservas-success" role="status">{successMessage}</p>
                  ) : null}

                  {selectedTable ? (
                    <form className="reservas-form admin-form" onSubmit={onSubmitReservation}>
                      <h3>Pre-reservar: {selectedTable.label}</h3>
                      <p className="about-copy">
                        Capacidade ate {selectedTable.capacity} pessoas · zona {selectedTable.zone}
                      </p>
                      <label htmlFor="res-guest-name">Nome completo</label>
                      <input
                        id="res-guest-name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required
                        autoComplete="name"
                      />
                      <label htmlFor="res-guest-phone">WhatsApp / telefone</label>
                      <input
                        id="res-guest-phone"
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        required
                        autoComplete="tel"
                      />
                      <label htmlFor="res-guest-email">E-mail (opcional)</label>
                      <input
                        id="res-guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        autoComplete="email"
                      />
                      <label htmlFor="res-party-size">Pessoas</label>
                      <input
                        id="res-party-size"
                        type="number"
                        min={1}
                        max={selectedTable.capacity}
                        value={partySize}
                        onChange={(e) => setPartySize(Number(e.target.value))}
                        required
                      />
                      <label htmlFor="res-notes">Observacoes (opcional)</label>
                      <textarea
                        id="res-notes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      {submitError ? <p className="admin-error">{submitError}</p> : null}
                      <div className="admin-actions">
                        <button type="submit" className="pill pill-light" disabled={isSubmitting}>
                          {isSubmitting ? 'Enviando...' : 'Enviar pre-reserva'}
                        </button>
                        <button
                          type="button"
                          className="pill"
                          onClick={() => setSelectedTable(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="about-copy reservas-hint">Toque em uma mesa ou camarote verde no mapa.</p>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

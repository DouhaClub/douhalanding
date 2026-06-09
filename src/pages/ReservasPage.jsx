import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReservationMap } from '../components/ReservationMap';
import { ReservationPackageCard } from '../components/ReservationPackageCard';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  buildDefaultReservationLayout,
  createTableReservation,
  enrichSpotWithPackage,
  fetchReservationsForEvent,
  formatEventReservationLabel,
  formatSpotPackageNote,
  getBlockedTableIdSet,
  getOccupiedTableIds,
  isMissingReservationColumnsError,
  normalizeReservationLayout,
} from '../lib/reservations';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export function ReservasPage({ agendaEvents, CalendarSection }) {
  const { eventId: routeEventId } = useParams();
  const mapBlockRef = useRef(null);
  const formBlockRef = useRef(null);
  const [selectedEventId, setSelectedEventId] = useState(routeEventId || '');
  const [reservations, setReservations] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useDocumentMeta({
    title: 'Pré-reservas | Douha Club',
    description: 'Escolha mesa ou camarote e faça sua pré-reserva para o evento.',
  });

  const selectedEvent = useMemo(
    () => (agendaEvents || []).find((event) => event.id === selectedEventId) || null,
    [agendaEvents, selectedEventId],
  );

  const activeEvent = useMemo(() => {
    if (!selectedEvent?.reservationsEnabled) return null;
    return selectedEvent;
  }, [selectedEvent]);

  const layout = useMemo(() => {
    const fromEvent = normalizeReservationLayout(activeEvent?.reservationLayout);
    return fromEvent || buildDefaultReservationLayout();
  }, [activeEvent?.reservationLayout]);

  /* Reservado = pré-reservas reais + spots fechados manualmente no admin. */
  const occupiedTableIds = useMemo(() => {
    const set = getOccupiedTableIds(reservations);
    getBlockedTableIdSet(layout).forEach((id) => set.add(id));
    return set;
  }, [reservations, layout]);

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
          ? 'Pré-reservas ainda não configuradas no Supabase. Rode supabase/migrations/007_douha_reservations.sql'
          : `Não foi possível carregar reservas: ${msg}`,
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
    if (!routeEventId || !activeEvent) return;
    mapBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [routeEventId, activeEvent?.id]);

  useEffect(() => {
    if (!selectedTable) return;
    formBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedTable?.id]);

  useEffect(() => {
    if (selectedEventId) {
      refreshReservations(selectedEventId);
      setSelectedTable(null);
      setSuccessMessage('');
    }
  }, [selectedEventId, refreshReservations]);

  const onSubmitReservation = async (event) => {
    event.preventDefault();
    if (!activeEvent || !selectedTable) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const pkg = enrichSpotWithPackage(selectedTable);
      await createTableReservation({
        eventId: activeEvent.id,
        tableId: selectedTable.id,
        guestName,
        guestPhone,
        partySize: pkg.entriesIncluded || pkg.capacity || 2,
        notes: formatSpotPackageNote(pkg),
      });
      setSuccessMessage(
        `Pré-reserva enviada para ${selectedTable.label}. Nossa equipe confirma pelo WhatsApp em breve — sem pagamento neste site.`,
      );
      setGuestName('');
      setGuestPhone('');
      setSelectedTable(null);
      await refreshReservations(activeEvent.id);
    } catch (error) {
      const msg = String(error?.message || error);
      if (msg.includes('duplicate key') || msg.includes('unique')) {
        setSubmitError('Esta mesa acabou de ser reservada. Escolha outra.');
        await refreshReservations(activeEvent.id);
      } else {
        setSubmitError(msg || 'Não foi possível enviar a pré-reserva.');
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
          <h1>Pré-reserva de mesa e camarote</h1>
          <p className="reservas-page__lead">
            Escolha o evento no calendário e passe o mouse na planta: o mapa mostra na hora se a mesa
            ou camarote está aberto. Clique para reservar e envie nome + WhatsApp — a equipe confirma,
            sem pagamento neste site.
          </p>
        </div>

        {CalendarSection ? (
          <CalendarSection
            agendaEvents={agendaEvents}
            embedded
            title="CALENDÁRIO DE RESERVAS"
            reservationMode
          />
        ) : (
          <div className="container reservas-page__inner">
            <p className="about-copy">
              Confira o <Link to="/calendario">calendário</Link> para escolher o evento.
            </p>
          </div>
        )}

        <div ref={mapBlockRef} className="container reservas-page__inner reservas-page__map-block">
          {selectedEventId && !activeEvent ? (
            <div className="reservas-empty">
              <p className="about-copy">
                {selectedEvent
                  ? 'Este evento não está com pré-reservas abertas no momento.'
                  : 'Evento não encontrado.'}
                {' '}
                Escolha outro no calendário ou fale no <Link to="/contato">contato</Link>.
              </p>
            </div>
          ) : null}

          {activeEvent ? (
            <>
              <div className="reservas-event-head">
                <h2>{formatEventReservationLabel(activeEvent)}</h2>
                {isLoading ? <p className="admin-save-hint" role="status">Atualizando mapa...</p> : null}
                {loadError ? <p className="admin-error">{loadError}</p> : null}
              </div>

              <div className="reservas-event-layout">
                <ReservationMap
                  layout={layout}
                  occupiedTableIds={occupiedTableIds}
                  selectedTableId={selectedTable?.id}
                  hint={false}
                  onSelectTable={(table) => {
                    if (table.reservable === false) return;
                    setSelectedTable(enrichSpotWithPackage(table));
                    setSubmitError('');
                    setSuccessMessage('');
                  }}
                />

                {successMessage ? (
                  <p className="reservas-success" role="status">{successMessage}</p>
                ) : null}

                {selectedTable ? (
                <form ref={formBlockRef} className="reservas-form admin-form" onSubmit={onSubmitReservation}>
                  <h3>Pré-reservar: {selectedTable.label}</h3>
                  <ReservationPackageCard table={selectedTable} />
                  <label htmlFor="res-guest-name">Nome completo</label>
                  <input
                    id="res-guest-name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                  <label htmlFor="res-guest-phone">WhatsApp</label>
                  <input
                    id="res-guest-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    placeholder="(44) 99999-9999"
                  />
                  {submitError ? <p className="admin-error">{submitError}</p> : null}
                  <div className="admin-actions">
                    <button type="submit" className="pill pill-light" disabled={isSubmitting}>
                      {isSubmitting ? 'Enviando...' : 'Enviar pré-reserva'}
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
                  <p className="about-copy reservas-hint">
                    Passe o mouse na planta para ver o que está aberto e clique para reservar.
                  </p>
                )}
              </div>
            </>
          ) : !selectedEventId ? (
            <p className="about-copy reservas-hint">
              Clique no poster de um evento no calendário de reservas acima para ver o mapa.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

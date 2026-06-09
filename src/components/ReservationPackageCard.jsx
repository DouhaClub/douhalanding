import { enrichSpotWithPackage, formatSpotPackageSummary } from '../lib/reservations';

function formatBrl(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function ReservationPackageCard({ table }) {
  const spot = enrichSpotWithPackage(table);
  if (!spot?.priceTotal) return null;

  return (
    <div className="reservas-package-card">
      <p className="reservas-package-card__price">
        <strong>{formatBrl(spot.priceTotal)}</strong>
        {spot.priceConsumption ? (
          <span>
            {' '}
            · {formatBrl(spot.priceConsumption)} em consumação
            {spot.entriesIncluded ? ` + ${spot.entriesIncluded} entrada${spot.entriesIncluded > 1 ? 's' : ''}` : ''}
          </span>
        ) : null}
      </p>
      {spot.capacity ? (
        <p className="reservas-package-card__meta">Até {spot.capacity} pessoas no espaço</p>
      ) : null}
      {Array.isArray(spot.perks) && spot.perks.length ? (
        <ul className="reservas-package-card__perks">
          {spot.perks.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
      ) : null}
      <p className="reservas-package-card__fine about-copy">
        {formatSpotPackageSummary(spot)} · pagamento e confirmação com a equipe Douha
      </p>
    </div>
  );
}

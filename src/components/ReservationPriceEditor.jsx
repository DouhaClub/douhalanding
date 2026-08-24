import { useEffect, useMemo, useState } from 'react';
import {
  applyReservationPriceGroups,
  formatPricePreview,
  getReservationPriceGroups,
  RESERVATION_PRICE_GROUP_LABELS,
  RESERVATION_PRICE_GROUP_ORDER,
} from '../lib/reservationPrices';
import { buildDefaultReservationLayout } from '../lib/reservations';

function PriceField({ id, label, value, onChange, disabled }) {
  return (
    <label className="admin-res-price-field" htmlFor={id}>
      <span>{label}</span>
      <div className="admin-res-price-input-wrap">
        <span className="admin-res-price-prefix" aria-hidden="true">R$</span>
        <input
          id={id}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

export function ReservationPriceEditor({ layout, disabled, saving, onSave, onResetDefaults }) {
  const [groups, setGroups] = useState(() => getReservationPriceGroups(layout));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setGroups(getReservationPriceGroups(layout));
    setDirty(false);
  }, [layout]);

  const previewLayout = useMemo(
    () => applyReservationPriceGroups(layout, groups),
    [layout, groups],
  );

  const updateGroup = (groupId, field, value) => {
    setGroups((prev) => ({
      ...prev,
      [groupId]: { ...prev[groupId], [field]: value },
    }));
    setDirty(true);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextLayout = applyReservationPriceGroups(layout, groups);
    await onSave(nextLayout);
    setDirty(false);
  };

  const onRestoreDefaults = () => {
    const defaults = getReservationPriceGroups(buildDefaultReservationLayout());
    setGroups(defaults);
    setDirty(true);
    onResetDefaults?.();
  };

  return (
    <form className="admin-res-prices" onSubmit={onSubmit}>
      <p className="about-copy admin-muted admin-res-prices-intro">
        Cada evento pode ter valores diferentes. Mesas 1–14 compartilham o mesmo pacote; cada camarote (C1–C5) tem preço próprio.
      </p>

      <div className="admin-res-prices-grid">
        {RESERVATION_PRICE_GROUP_ORDER.map((groupId) => {
          const g = groups[groupId] || {};
          return (
            <article key={groupId} className="admin-res-price-card">
              <header className="admin-res-price-card__head">
                <h4>{RESERVATION_PRICE_GROUP_LABELS[groupId]}</h4>
                <p className="admin-res-price-card__preview">
                  {formatPricePreview(g.priceTotal)}
                  {g.priceConsumption ? ` · ${formatPricePreview(g.priceConsumption)} consumação` : ''}
                  {g.entriesIncluded ? ` · ${g.entriesIncluded} entrada(s)` : ''}
                </p>
              </header>
              <div className="admin-res-price-card__fields">
                <PriceField
                  id={`price-total-${groupId}`}
                  label="Valor total"
                  value={g.priceTotal ?? ''}
                  disabled={disabled || saving}
                  onChange={(value) => updateGroup(groupId, 'priceTotal', value)}
                />
                <PriceField
                  id={`price-consumption-${groupId}`}
                  label="Consumação"
                  value={g.priceConsumption ?? ''}
                  disabled={disabled || saving}
                  onChange={(value) => updateGroup(groupId, 'priceConsumption', value)}
                />
                <PriceField
                  id={`price-entries-${groupId}`}
                  label="Entradas incluídas"
                  value={g.entriesIncluded ?? ''}
                  disabled={disabled || saving}
                  onChange={(value) => updateGroup(groupId, 'entriesIncluded', value)}
                />
              </div>
            </article>
          );
        })}
      </div>

      <details className="admin-res-prices-map-preview">
        <summary>Ver preview no mapa (valores digitados)</summary>
        <p className="about-copy admin-muted">
          Passe o mouse nos spots no preview acima após salvar — os tooltips usam estes valores.
        </p>
        <ul className="admin-res-prices-spot-list">
          {(previewLayout?.tables || [])
            .filter((table) => table.reservable !== false && !table.infoOnly)
            .map((table) => (
              <li key={table.id}>
                <strong>{table.label}</strong>
                {' — '}
                {formatPricePreview(table.priceTotal)}
              </li>
            ))}
        </ul>
      </details>

      <div className="admin-actions admin-res-prices-actions">
        <button type="submit" className="pill pill-light" disabled={disabled || saving || !dirty}>
          {saving ? 'Salvando preços...' : 'Salvar preços deste evento'}
        </button>
        <button type="button" className="pill" disabled={disabled || saving} onClick={onRestoreDefaults}>
          Restaurar valores padrão
        </button>
      </div>
    </form>
  );
}
